import mongoose from "mongoose";

/**
 * YoutubeLiveStream Model
 * ───────────────────────
 * Represents one monitored YouTube Live / video. Mirrors the existing
 * LiveSession pattern: it can optionally be linked to a Program, but does
 * not require one. The background collector reads/writes these records to
 * keep YouTube statistics + chat in sync.
 *
 * NOTE: This does NOT replace Program.socialStreams — admins can still add
 * a YouTube URL to a Program. This model is the analytics-grade record that
 * powers chat tracking, sentiment, and engagement analytics.
 */

const engagementStatsSchema = new mongoose.Schema(
  {
    totalMessages: { type: Number, default: 0 },
    positiveCount: { type: Number, default: 0 },
    negativeCount: { type: Number, default: 0 },
    neutralCount: { type: Number, default: 0 },
    /** ((chatMessages + likes) / views) * 100 — see analytics service */
    engagementScore: { type: Number, default: 0 },
    lastComputedAt: { type: Date, default: null },
  },
  { _id: false },
);

const youtubeLiveStreamSchema = new mongoose.Schema(
  {
    // ── Source ────────────────────────────────────────────────────────────
    youtubeUrl: {
      type: String,
      required: [true, "A YouTube URL is required"],
      trim: true,
    },
    youtubeVideoId: {
      type: String,
      required: true,
      unique: true, // one record per video — prevents duplicate monitors
      index: true,
    },

    // ── Snapshot from videos.list (snippet) ──────────────────────────────
    title: { type: String, default: null },
    channelTitle: { type: String, default: null },
    thumbnail: { type: String, default: null },

    // ── Snapshot from videos.list (statistics + liveStreamingDetails) ────
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    currentViewers: { type: Number, default: 0 }, // live concurrent viewers

    liveStatus: {
      type: String,
      enum: ["upcoming", "live", "none", "ended", "unknown"],
      default: "unknown",
    },
    isLiveNow: { type: Boolean, default: false },

    // ── Live chat plumbing ───────────────────────────────────────────────
    youtubeLiveChatId: { type: String, default: null }, // activeLiveChatId
    /** Token from liveChatMessages.list — only fetch NEW messages next time */
    nextChatPageToken: { type: String, default: null },
    /** Google-provided minimum gap between chat polls */
    chatPollingIntervalMillis: { type: Number, default: 10000 },
    /** Earliest time we are allowed to poll chat again (quota safety) */
    nextChatPollAt: { type: Date, default: null },

    // ── Aggregated analytics counters ────────────────────────────────────
    engagementStats: { type: engagementStatsSchema, default: () => ({}) },

    // ── Sync / lifecycle ─────────────────────────────────────────────────
    lastSyncedAt: { type: Date, default: null },
    /** When true, the background collector keeps this stream up to date */
    monitoringEnabled: { type: Boolean, default: true },

    // ── Phase 2: broadcasts created from the host dashboard via OAuth ────
    /** True when this stream was created by our "Go Live" flow (not just monitored) */
    createdFromDashboard: { type: Boolean, default: false },
    /** liveBroadcasts resource id (YouTube). The broadcast id == the video id. */
    youtubeBroadcastId: { type: String, default: null },
    /** liveStreams resource id (the RTMP stream bound to the broadcast) */
    youtubeStreamId: { type: String, default: null },
    /**
     * RTMP stream key (cdn.ingestionInfo.streamName).
     * SECURITY: select:false → never returned by default queries, so it is
     * never leaked to the frontend. Only fetched explicitly server-side.
     */
    streamKey: { type: String, default: null, select: false },
    /** RTMP ingestion address (public, e.g. rtmp://a.rtmp.youtube.com/live2) */
    ingestionUrl: { type: String, default: null },
    /** liveBroadcasts lifeCycleStatus: created | ready | testing | live | complete */
    youtubeStatus: { type: String, default: null },
    /** The user whose Google account owns this broadcast */
    oauthOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ── Optional link back to a Program (informational, never required) ──
    linkedProgram: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Program",
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

// Common query patterns: "which streams should the collector poll right now?"
youtubeLiveStreamSchema.index({ monitoringEnabled: 1, liveStatus: 1 });
youtubeLiveStreamSchema.index({ linkedProgram: 1 });

export default mongoose.models.YoutubeLiveStream ||
  mongoose.model("YoutubeLiveStream", youtubeLiveStreamSchema);
