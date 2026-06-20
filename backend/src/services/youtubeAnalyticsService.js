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

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGATE INSIGHTS (across ALL monitored YouTube streams)
// Mirrors the Radio "Analytics & Insights" dashboard but sourced from YouTube
// streams + live chat. Powers /dashboard/youtube-analysis-insight + PDF export.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the platform-wide YouTube analytics overview.
 *
 * @param {object} [opts]
 * @param {string|Date} [opts.startDate]  filter chat messages from this date
 * @param {string|Date} [opts.endDate]    filter chat messages up to this date
 * @param {number}      [opts.topUsers=10]
 * @param {number}      [opts.topKeywords=15]
 * @param {number}      [opts.topStreams=10]
 */
export async function buildDashboardInsights(opts = {}) {
  const { startDate, endDate, topUsers = 10, topKeywords = 15, topStreams = 10 } =
    opts;

  // Chat messages are filtered by their original YouTube publish time.
  const msgMatch = {};
  if (startDate || endDate) {
    msgMatch.publishedAt = {};
    if (startDate) msgMatch.publishedAt.$gte = new Date(startDate);
    if (endDate) msgMatch.publishedAt.$lte = new Date(endDate);
  }

  // ── Stream-level totals ─────────────────────────────────────────────────
  const streamAgg = await YoutubeLiveStream.aggregate([
    {
      $group: {
        _id: null,
        totalStreams: { $sum: 1 },
        liveStreams: {
          $sum: { $cond: [{ $eq: ["$liveStatus", "live"] }, 1, 0] },
        },
        endedStreams: {
          $sum: { $cond: [{ $eq: ["$liveStatus", "ended"] }, 1, 0] },
        },
        totalViews: { $sum: "$views" },
        totalLikes: { $sum: "$likes" },
        totalComments: { $sum: "$commentCount" },
        currentViewers: { $sum: "$currentViewers" },
        avgEngagementScore: { $avg: "$engagementStats.engagementScore" },
      },
    },
  ]);
  const s = streamAgg[0] || {};

  // ── Message totals + sentiment (date-filtered) ──────────────────────────
  const sentimentAgg = await YoutubeChatMessage.aggregate([
    { $match: msgMatch },
    { $group: { _id: "$sentiment", count: { $sum: 1 } } },
  ]);
  const sentimentBreakdown = sentimentAgg.map((r) => ({
    _id: r._id || "neutral",
    count: r.count,
  }));
  const totalMessages = sentimentBreakdown.reduce((a, b) => a + b.count, 0);

  // ── Most active users (date-filtered) ───────────────────────────────────
  const mostActiveUsers = (
    await YoutubeChatMessage.aggregate([
      { $match: msgMatch },
      { $group: { _id: "$authorName", messages: { $sum: 1 } } },
      { $sort: { messages: -1 } },
      { $limit: topUsers },
    ])
  ).map((r) => ({ user: r._id || "Unknown", messages: r.messages }));

  // ── Trending keywords (tokenised in JS over a recent window) ────────────
  const recentForKeywords = await YoutubeChatMessage.find(msgMatch)
    .select("message")
    .sort({ publishedAt: -1 })
    .limit(3000)
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

  // ── Top streams by total views ──────────────────────────────────────────
  const topStreamDocs = await YoutubeLiveStream.find()
    .sort({ views: -1, "engagementStats.totalMessages": -1 })
    .limit(topStreams)
    .select(
      "title channelTitle views likes currentViewers liveStatus engagementStats thumbnail youtubeUrl",
    )
    .lean();
  const topStreamsList = topStreamDocs.map((d) => ({
    _id: d._id,
    title: d.title || "Untitled stream",
    channelTitle: d.channelTitle || "—",
    views: d.views || 0,
    likes: d.likes || 0,
    currentViewers: d.currentViewers || 0,
    liveStatus: d.liveStatus || "unknown",
    totalMessages: d.engagementStats?.totalMessages || 0,
    engagementScore: d.engagementStats?.engagementScore || 0,
  }));

  const positive =
    sentimentBreakdown.find((x) => x._id === "positive")?.count || 0;
  const negative =
    sentimentBreakdown.find((x) => x._id === "negative")?.count || 0;
  const neutral =
    sentimentBreakdown.find((x) => x._id === "neutral")?.count || 0;

  const summary = {
    totalStreams: s.totalStreams || 0,
    liveStreams: s.liveStreams || 0,
    endedStreams: s.endedStreams || 0,
    totalViews: s.totalViews || 0,
    totalLikes: s.totalLikes || 0,
    totalComments: s.totalComments || 0,
    currentViewers: s.currentViewers || 0,
    totalMessages,
    avgEngagementScore:
      Math.round((s.avgEngagementScore || 0) * 100) / 100,
  };

  const insights = generateYoutubeInsights(summary, {
    positive,
    negative,
    neutral,
  });

  return {
    summary,
    sentimentBreakdown,
    mostActiveUsers,
    trendingKeywords,
    topStreams: topStreamsList,
    insights,
  };
}

/**
 * Daily YouTube chat trends across all streams (message volume + sentiment),
 * mirroring the Radio engagement-trends endpoint.
 *
 * @param {object} [opts]
 * @param {number} [opts.days=30]
 * @param {string} [opts.period="daily"]  daily | weekly | monthly
 */
export async function buildTrends(opts = {}) {
  const { days = 30, period = "daily" } = opts;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days, 10));

  let dateFormat = "%Y-%m-%d";
  if (period === "weekly") dateFormat = "%Y-W%V";
  if (period === "monthly") dateFormat = "%Y-%m";

  const trends = await YoutubeChatMessage.aggregate([
    { $match: { publishedAt: { $gte: startDate } } },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: "$publishedAt" } },
        totalMessages: { $sum: 1 },
        positiveCount: {
          $sum: { $cond: [{ $eq: ["$sentiment", "positive"] }, 1, 0] },
        },
        negativeCount: {
          $sum: { $cond: [{ $eq: ["$sentiment", "negative"] }, 1, 0] },
        },
        neutralCount: {
          $sum: { $cond: [{ $eq: ["$sentiment", "neutral"] }, 1, 0] },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return trends;
}

/**
 * Derive risk factors + recommendations from the aggregated YouTube summary
 * and sentiment counts, so the admin insight panels always have content.
 */
export function generateYoutubeInsights(summary, sentiment = {}) {
  const riskFactors = [];
  const recommendations = [];

  const { positive = 0, negative = 0, neutral = 0 } = sentiment;
  const sentimentTotal = positive + negative + neutral;
  const negativeRatio = sentimentTotal > 0 ? negative / sentimentTotal : 0;
  const positiveRatio = sentimentTotal > 0 ? positive / sentimentTotal : 0;

  const {
    totalStreams = 0,
    liveStreams = 0,
    totalMessages = 0,
    currentViewers = 0,
    avgEngagementScore = 0,
  } = summary;

  // ── Risk factors ────────────────────────────────────────────────────────
  if (totalStreams === 0) {
    riskFactors.push("No YouTube streams are being monitored yet");
  }
  if (totalStreams > 0 && liveStreams === 0) {
    riskFactors.push("No YouTube streams are currently live");
  }
  if (liveStreams > 0 && currentViewers < 10) {
    riskFactors.push(
      `Low concurrent viewership (${currentViewers}) across live streams`,
    );
  }
  if (sentimentTotal > 0 && negativeRatio > 0.3) {
    riskFactors.push(
      `High negative chat sentiment (${(negativeRatio * 100).toFixed(0)}% of messages)`,
    );
  }
  if (totalMessages === 0) {
    riskFactors.push("No live chat messages recorded in the selected period");
  }
  if (avgEngagementScore > 0 && avgEngagementScore < 1) {
    riskFactors.push(
      `Low average engagement score (${avgEngagementScore.toFixed(2)}%)`,
    );
  }

  // ── Recommendations ─────────────────────────────────────────────────────
  if (totalMessages < 100) {
    recommendations.push(
      "Promote the live chat and encourage viewers to participate",
    );
  }
  if (liveStreams < 1) {
    recommendations.push(
      "Schedule and start a YouTube live broadcast to grow real-time engagement",
    );
  }
  if (negativeRatio > 0.3) {
    recommendations.push(
      "Review recurring negative feedback in chat and address listener concerns",
    );
  }
  if (positiveRatio > 0.6) {
    recommendations.push(
      "Chat sentiment is strongly positive — amplify the content formats driving it",
    );
  }
  if (avgEngagementScore > 5) {
    recommendations.push(
      "Strong engagement — consider streaming more frequently and at peak hours",
    );
  }

  return {
    riskFactors:
      riskFactors.length > 0 ? riskFactors : ["No major risks identified"],
    recommendations:
      recommendations.length > 0
        ? recommendations
        : ["Continue current strategies and monitor engagement"],
    sentimentSummary: {
      total: sentimentTotal,
      positive,
      negative,
      neutral,
      positiveRatio,
      negativeRatio,
    },
  };
}

export default {
  buildAnalytics,
  refreshStoredAnalytics,
  getRecentChats,
  buildDashboardInsights,
  buildTrends,
  generateYoutubeInsights,
};
