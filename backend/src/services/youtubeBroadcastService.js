import YoutubeLiveStream from "../models/YoutubeLiveStream.js";

/**
 * YouTube Broadcast Service
 * ─────────────────────────
 * Creates a live broadcast on the host's own channel using the YouTube Live
 * Streaming API (OAuth Bearer token — NOT the public API key), then hands the
 * resulting video id to the EXISTING analytics pipeline by writing a normal
 * YoutubeLiveStream record. No analytics logic is duplicated here.
 *
 * Flow:  liveBroadcasts.insert → liveStreams.insert → liveBroadcasts.bind
 */

const YT = "https://www.googleapis.com/youtube/v3";

/**
 * Authenticated fetch against the YouTube Data API using an OAuth access token.
 * Surfaces Google's error reason + message so callers can react (quota,
 * liveStreamingNotEnabled, etc.).
 */
async function googleFetch(url, { method = "GET", accessToken, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const reason = data?.error?.errors?.[0]?.reason || "unknown";
    const message = data?.error?.message || `YouTube API HTTP ${res.status}`;
    console.error("[YouTube Live API error]", {
      status: res.status,
      url: url.split("?")[0],
      reason,
      errorMessage: message,
    });
    const err = new Error(message);
    err.code = reason; // e.g. "liveStreamingNotEnabled", "quotaExceeded"
    err.status = res.status;
    throw err;
  }
  return data;
}

/**
 * Create the live broadcast (the "event"/video).
 * The returned broadcast id IS the YouTube video id used in watch/embed URLs.
 *
 * @returns {Promise<{ broadcastId, videoId, status, snippet }>}
 */
export async function createYoutubeBroadcast(
  accessToken,
  { title, description = "", scheduledStartTime },
) {
  const startTime =
    scheduledStartTime || new Date(Date.now() + 60_000).toISOString();

  const broadcast = await googleFetch(
    `${YT}/liveBroadcasts?part=snippet,status,contentDetails`,
    {
      method: "POST",
      accessToken,
      body: {
        snippet: {
          title: title || "Live Broadcast",
          description,
          scheduledStartTime: startTime,
        },
        status: {
          privacyStatus: "public",
          selfDeclaredMadeForKids: false,
        },
        contentDetails: {
          // Let YouTube start/stop the broadcast when the encoder connects.
          enableAutoStart: true,
          enableAutoStop: true,
        },
      },
    },
  );

  return {
    broadcastId: broadcast.id,
    videoId: broadcast.id, // broadcast id == video id
    status: broadcast.status?.lifeCycleStatus || "created",
    snippet: broadcast.snippet || {},
  };
}

/**
 * Create the RTMP live stream the encoder will push to.
 *
 * @returns {Promise<{ streamId, streamName, ingestionAddress }>}
 */
export async function createLiveStream(accessToken, { title } = {}) {
  const stream = await googleFetch(
    `${YT}/liveStreams?part=snippet,cdn,contentDetails`,
    {
      method: "POST",
      accessToken,
      body: {
        snippet: { title: title || "Live Broadcast stream" },
        cdn: {
          ingestionType: "rtmp",
          resolution: "variable",
          frameRate: "variable",
        },
        contentDetails: { isReusable: false },
      },
    },
  );

  const info = stream.cdn?.ingestionInfo || {};
  return {
    streamId: stream.id,
    streamName: info.streamName || null, // the secret RTMP key
    ingestionAddress: info.ingestionAddress || null, // public RTMP URL
  };
}

/** Bind the broadcast to the stream so video pushed to RTMP appears live. */
export async function bindBroadcast(accessToken, broadcastId, streamId) {
  return googleFetch(
    `${YT}/liveBroadcasts/bind?id=${encodeURIComponent(
      broadcastId,
    )}&streamId=${encodeURIComponent(streamId)}&part=id,contentDetails,status`,
    { method: "POST", accessToken },
  );
}

/**
 * Hand the new broadcast to the EXISTING analytics system by creating a
 * YoutubeLiveStream record. From here, the unchanged collector picks it up:
 * syncStreamStats() / syncStreamChat() / buildAnalytics() all work as-is.
 *
 * @returns {Promise<YoutubeLiveStream>}
 */
export async function createStreamRecordFromBroadcast({
  broadcast, // { broadcastId, videoId, status, snippet }
  stream, // { streamId, streamName, ingestionAddress }
  ownerUserId,
  channelTitle = null,
}) {
  const videoId = broadcast.videoId;
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Reuse the record shape the analytics pipeline already understands.
  return YoutubeLiveStream.findOneAndUpdate(
    { youtubeVideoId: videoId },
    {
      $setOnInsert: { youtubeVideoId: videoId },
      $set: {
        youtubeUrl: watchUrl,
        title: broadcast.snippet?.title || "Live Broadcast",
        channelTitle: channelTitle,
        liveStatus: "upcoming", // collector flips to "live" once it goes live
        isLiveNow: false,
        monitoringEnabled: true,

        // Phase 2 fields
        createdFromDashboard: true,
        youtubeBroadcastId: broadcast.broadcastId,
        youtubeStreamId: stream.streamId,
        streamKey: stream.streamName, // select:false → never sent to frontend
        ingestionUrl: stream.ingestionAddress,
        youtubeStatus: broadcast.status,
        oauthOwner: ownerUserId,
        createdBy: ownerUserId,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export default {
  createYoutubeBroadcast,
  createLiveStream,
  bindBroadcast,
  createStreamRecordFromBroadcast,
};
