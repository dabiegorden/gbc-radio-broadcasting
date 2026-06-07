/**
 * YouTube Analytics Service
 * ─────────────────────────
 * Turns stored chat messages + stream stats into the engagement analytics
 * described in the brief:
 *
 *   • Total Live Messages
 *   • Messages Per Minute
 *   • Most Active Users
 *   • Trending Keywords
 *   • Sentiment percentages (positive / negative / neutral)
 *   • Engagement Score   = ((chatMessages + likes) / views) * 100
 *   • Engagement Growth  (this minute vs the previous minute)
 *
 * All metrics are computed with MongoDB aggregation where possible so this
 * scales to high-volume chats without loading every message into memory.
 */

import mongoose from "mongoose";
import YoutubeLiveStream from "../models/YoutubeLiveStream.js";
import YoutubeChatMessage from "../models/YoutubeChatMessage.js";

// Words to ignore when building trending keywords.
const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "is",
  "are",
  "was",
  "were",
  "be",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "at",
  "by",
  "this",
  "that",
  "it",
  "i",
  "you",
  "he",
  "she",
  "we",
  "they",
  "me",
  "my",
  "your",
  "so",
  "no",
  "yes",
  "im",
  "its",
  "do",
  "does",
  "did",
  "have",
  "has",
  "not",
  "just",
  "can",
  "will",
  "what",
  "when",
  "how",
  "why",
  "all",
  "out",
  "up",
  "get",
]);

/**
 * Build the full analytics object for a stream.
 * @param {string} streamId
 * @param {object} [opts]
 * @param {number} [opts.topUsers=10]
 * @param {number} [opts.topKeywords=15]
 */
export async function buildAnalytics(streamId, opts = {}) {
  const { topUsers = 10, topKeywords = 15 } = opts;
  const id = new mongoose.Types.ObjectId(streamId);

  const stream = await YoutubeLiveStream.findById(id).lean();
  if (!stream) {
    const err = new Error("Stream not found");
    err.statusCode = 404;
    throw err;
  }

  // ── Sentiment breakdown + total messages (single aggregation) ──────────
  const sentimentAgg = await YoutubeChatMessage.aggregate([
    { $match: { stream: id } },
    { $group: { _id: "$sentiment", count: { $sum: 1 } } },
  ]);

  let positive = 0,
    negative = 0,
    neutral = 0;
  for (const row of sentimentAgg) {
    if (row._id === "positive") positive = row.count;
    else if (row._id === "negative") negative = row.count;
    else neutral = row.count;
  }
  const totalMessages = positive + negative + neutral;
  const pct = (n) =>
    totalMessages ? Math.round((n / totalMessages) * 1000) / 10 : 0;

  // ── Messages per minute ────────────────────────────────────────────────
  const perMinuteAgg = await YoutubeChatMessage.aggregate([
    { $match: { stream: id } },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d %H:%M", date: "$publishedAt" },
        },
        messages: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  const messagesPerMinute = perMinuteAgg.map((r) => ({
    minute: r._id,
    messages: r.messages,
  }));

  // ── Most active users ──────────────────────────────────────────────────
  const mostActiveUsers = (
    await YoutubeChatMessage.aggregate([
      { $match: { stream: id } },
      { $group: { _id: "$authorName", messages: { $sum: 1 } } },
      { $sort: { messages: -1 } },
      { $limit: topUsers },
    ])
  ).map((r) => ({ user: r._id, messages: r.messages }));

  // ── Trending keywords (tokenised in JS — chat messages are short) ──────
  const recentForKeywords = await YoutubeChatMessage.find({ stream: id })
    .select("message")
    .sort({ publishedAt: -1 })
    .limit(2000)
    .lean();

  const wordCounts = new Map();
  for (const m of recentForKeywords) {
    const words = (m.message || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w));
    for (const w of words) wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
  }
  const trendingKeywords = [...wordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topKeywords)
    .map(([word, count]) => ({ word, count }));

  // ── Engagement score = ((chatMessages + likes) / views) * 100 ──────────
  const views = stream.views || 0;
  const likes = stream.likes || 0;
  const engagementScore =
    views > 0
      ? Math.round(((totalMessages + likes) / views) * 100 * 100) / 100
      : 0;

  // ── Engagement growth: last minute vs the minute before it ─────────────
  const len = messagesPerMinute.length;
  const lastMinute = len >= 1 ? messagesPerMinute[len - 1].messages : 0;
  const prevMinute = len >= 2 ? messagesPerMinute[len - 2].messages : 0;
  const engagementGrowth =
    prevMinute > 0
      ? Math.round(((lastMinute - prevMinute) / prevMinute) * 100 * 10) / 10
      : lastMinute > 0
        ? 100
        : 0;

  return {
    totalMessages,
    positivePercentage: pct(positive),
    negativePercentage: pct(negative),
    neutralPercentage: pct(neutral),
    sentimentCounts: { positive, negative, neutral },
    messagesPerMinute,
    mostActiveUsers,
    topKeywords: trendingKeywords,
    engagementScore,
    engagementGrowth, // % change in chat volume, last minute vs previous
  };
}

/**
 * Recompute and store the engagement score + sentiment counters on the stream
 * doc (so the collector can broadcast a lightweight "analyticsUpdated" event
 * without rebuilding the full payload each tick).
 */
export async function refreshStoredAnalytics(streamId) {
  const analytics = await buildAnalytics(streamId, {
    topUsers: 5,
    topKeywords: 5,
  });

  await YoutubeLiveStream.updateOne(
    { _id: streamId },
    {
      $set: {
        "engagementStats.totalMessages": analytics.totalMessages,
        "engagementStats.positiveCount": analytics.sentimentCounts.positive,
        "engagementStats.negativeCount": analytics.sentimentCounts.negative,
        "engagementStats.neutralCount": analytics.sentimentCounts.neutral,
        "engagementStats.engagementScore": analytics.engagementScore,
        "engagementStats.lastComputedAt": new Date(),
      },
    },
  );

  return analytics;
}

/** Most recent chat messages for the unified stream response. */
export async function getRecentChats(streamId, limit = 50) {
  const id = new mongoose.Types.ObjectId(streamId);
  const chats = await YoutubeChatMessage.find({ stream: id })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .select("authorName message publishedAt sentiment sentimentConfidence")
    .lean();
  return chats.reverse(); // oldest → newest for display
}

export default { buildAnalytics, refreshStoredAnalytics, getRecentChats };
