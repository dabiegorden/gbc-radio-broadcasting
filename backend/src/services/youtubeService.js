/**
 * YouTube Service
 * ───────────────
 * Orchestrates everything between the raw YouTube API wrapper (utils/youtube.js)
 * and the database models. Three jobs:
 *
 *   1. createStreamFromUrl  — admin adds a URL → fetch details → persist
 *   2. syncStreamStats      — refresh views/likes/viewers/live status
 *   3. syncStreamChat       — pull NEW chat messages, dedup, run sentiment
 *
 * Socket.IO events (emitted when an `io` instance is passed in):
 *   liveStatsUpdated     — stats changed for a stream
 *   newLiveChatMessage   — one or more new chat messages stored
 */

import YoutubeLiveStream from "../models/YoutubeLiveStream.js";
import YoutubeChatMessage from "../models/YoutubeChatMessage.js";
import {
  extractYouTubeId,
  getVideoDetails,
  getLiveChatMessages,
} from "../utils/youtube.js";
import { analyzeSentiment } from "./sentimentService.js";

/** Emit helper that no-ops safely when io is not provided. */
function emit(io, event, payload, room) {
  if (!io) return;
  if (room) io.to(room).emit(event, payload);
  else io.emit(event, payload);
}

/**
 * Create (or return existing) a monitored stream from a YouTube URL.
 *
 * @param {object} opts
 * @param {string} opts.url            YouTube watch/live URL
 * @param {string} [opts.createdBy]    User id
 * @param {string} [opts.linkedProgram] optional Program id
 * @param {object} [opts.io]           socket.io instance
 * @returns {Promise<YoutubeLiveStream>}
 */
export async function createStreamFromUrl({
  url,
  createdBy = null,
  linkedProgram = null,
  io = null,
}) {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    const err = new Error("Could not extract a YouTube video ID from the URL");
    err.statusCode = 400;
    throw err;
  }

  // If we already monitor this video, return it (idempotent).
  const existing = await YoutubeLiveStream.findOne({ youtubeVideoId: videoId });
  if (existing) return existing;

  // Pull the first snapshot from YouTube.
  const details = await getVideoDetails(videoId);
  if (!details) {
    const err = new Error("YouTube video not found or is not accessible");
    err.statusCode = 404;
    throw err;
  }

  const stream = await YoutubeLiveStream.create({
    youtubeUrl: url,
    youtubeVideoId: videoId,
    title: details.title,
    channelTitle: details.channelTitle,
    thumbnail: details.thumbnail,
    views: details.views || 0,
    likes: details.likes || 0,
    commentCount: details.commentCount || 0,
    currentViewers: details.currentViewers || 0,
    liveStatus: details.liveStatus,
    isLiveNow: details.isLiveNow,
    youtubeLiveChatId: details.activeLiveChatId,
    lastSyncedAt: new Date(),
    createdBy,
    linkedProgram,
  });

  emit(io, "liveStatsUpdated", {
    streamId: stream._id,
    stats: publicStats(stream),
  });
  return stream;
}

/**
 * Refresh statistics + live status for a stream from videos.list.
 * @returns {Promise<YoutubeLiveStream>} the updated stream
 */
export async function syncStreamStats(stream, io = null) {
  const details = await getVideoDetails(stream.youtubeVideoId);
  if (!details) return stream;

  stream.title = details.title ?? stream.title;
  stream.channelTitle = details.channelTitle ?? stream.channelTitle;
  stream.thumbnail = details.thumbnail ?? stream.thumbnail;
  stream.views = details.views ?? stream.views;
  stream.likes = details.likes ?? stream.likes;
  stream.commentCount = details.commentCount ?? stream.commentCount;
  stream.currentViewers = details.currentViewers ?? 0;
  stream.liveStatus = details.liveStatus;
  stream.isLiveNow = details.isLiveNow;

  // Capture the chat id the first time it appears; if the broadcast has ended
  // YouTube stops returning it, so we keep the last known value.
  if (details.activeLiveChatId) {
    stream.youtubeLiveChatId = details.activeLiveChatId;
  }
  if (details.liveStatus === "none" && details.actualEndTime) {
    stream.liveStatus = "ended";
    stream.isLiveNow = false;
  }

  stream.lastSyncedAt = new Date();
  await stream.save();

  emit(
    io,
    "liveStatsUpdated",
    { streamId: stream._id, stats: publicStats(stream) },
    `youtube-${stream._id}`,
  );
  return stream;
}

/**
 * Pull new live chat messages, dedup, classify sentiment, and persist.
 * Respects YouTube's pollingIntervalMillis to stay within quota.
 *
 * @returns {Promise<{stored: number}>} count of newly stored messages
 */
export async function syncStreamChat(stream, io = null) {
  // No chat id → nothing to do (video not live, or chat disabled).
  if (!stream.youtubeLiveChatId || !stream.isLiveNow) {
    return { stored: 0 };
  }

  // Quota guard: don't poll before YouTube says we may.
  if (stream.nextChatPollAt && stream.nextChatPollAt > new Date()) {
    return { stored: 0 };
  }

  let page;
  try {
    page = await getLiveChatMessages(
      stream.youtubeLiveChatId,
      stream.nextChatPageToken,
    );
  } catch (err) {
    // If the live chat ended, YouTube returns an error — stop polling chat.
    if (err.status === 403 || err.status === 404) {
      stream.isLiveNow = false;
      stream.liveStatus = "ended";
      await stream.save();
    }
    throw err;
  }

  // Always advance the token + poll window, even if no new messages, so the
  // next poll only asks for messages newer than this batch.
  stream.nextChatPageToken = page.nextPageToken;
  stream.chatPollingIntervalMillis = page.pollingIntervalMillis;
  stream.nextChatPollAt = new Date(Date.now() + page.pollingIntervalMillis);

  let stored = 0;
  if (page.messages.length > 0) {
    // Classify sentiment for each message (replaceable backend).
    const docs = page.messages.map((m) => {
      const s = analyzeSentiment(m.message);
      return {
        ...m,
        stream: stream._id,
        sentiment: s.sentiment,
        sentimentConfidence: s.confidence,
      };
    });

    // Upsert keyed on the unique (stream, youtubeMessageId) index → dedup.
    const ops = docs.map((d) => ({
      updateOne: {
        filter: { stream: d.stream, youtubeMessageId: d.youtubeMessageId },
        update: { $setOnInsert: d },
        upsert: true,
      },
    }));

    const result = await YoutubeChatMessage.bulkWrite(ops, { ordered: false });
    stored = result.upsertedCount || 0;

    // Keep rolling sentiment counters on the stream in sync.
    if (stored > 0) {
      // bulkWrite.upsertedIds maps the OPERATION INDEX → new _id, so the keys
      // tell us exactly which docs were freshly inserted (vs. dedup-skipped).
      const insertedIndexes = Object.keys(result.upsertedIds || {}).map(Number);
      const batch = insertedIndexes.length
        ? insertedIndexes.map((i) => docs[i])
        : docs.slice(0, stored);

      const inc = { "engagementStats.totalMessages": batch.length };
      inc["engagementStats.positiveCount"] = batch.filter(
        (d) => d.sentiment === "positive",
      ).length;
      inc["engagementStats.negativeCount"] = batch.filter(
        (d) => d.sentiment === "negative",
      ).length;
      inc["engagementStats.neutralCount"] = batch.filter(
        (d) => d.sentiment === "neutral",
      ).length;

      await YoutubeLiveStream.updateOne({ _id: stream._id }, { $inc: inc });

      emit(
        io,
        "newLiveChatMessage",
        {
          streamId: stream._id,
          messages: batch.map((d) => ({
            authorName: d.authorName,
            message: d.message,
            publishedAt: d.publishedAt,
            sentiment: d.sentiment,
          })),
        },
        `youtube-${stream._id}`,
      );
    }
  }

  await stream.save();
  return { stored };
}

/** A compact, client-safe view of the live stats (no API keys, no tokens). */
export function publicStats(stream) {
  return {
    title: stream.title,
    channelTitle: stream.channelTitle,
    thumbnail: stream.thumbnail,
    youtubeUrl: stream.youtubeUrl,
    youtubeVideoId: stream.youtubeVideoId,
    views: stream.views,
    likes: stream.likes,
    currentViewers: stream.currentViewers,
    liveStatus: stream.liveStatus,
    isLiveNow: stream.isLiveNow,
    lastSyncedAt: stream.lastSyncedAt,
  };
}

export default {
  createStreamFromUrl,
  syncStreamStats,
  syncStreamChat,
  publicStats,
};
