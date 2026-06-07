import mongoose from "mongoose";

/**
 * YoutubeChatMessage Model
 * ────────────────────────
 * One document per YouTube live chat message we have stored.
 *
 * Duplicate prevention: YouTube's liveChatMessages.list can re-deliver
 * messages across polls. The compound unique index { stream, youtubeMessageId }
 * guarantees we never store the same message twice — the collector uses an
 * upsert bulkWrite keyed on these fields, so duplicates are silently ignored.
 */

const youtubeChatMessageSchema = new mongoose.Schema(
  {
    stream: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "YoutubeLiveStream",
      required: true,
      index: true,
    },

    // YouTube's own message id — the dedup key
    youtubeMessageId: {
      type: String,
      required: true,
    },

    authorName: { type: String, default: "Unknown" },
    authorChannelId: { type: String, default: null },
    message: { type: String, default: "" },

    // Original time the message was posted on YouTube
    publishedAt: { type: Date, required: true, index: true },

    // ── Sentiment (filled by the replaceable sentiment service) ──────────
    sentiment: {
      type: String,
      enum: ["positive", "negative", "neutral"],
      default: "neutral",
    },
    sentimentConfidence: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Dedup guarantee + fast "messages for this stream" queries
youtubeChatMessageSchema.index(
  { stream: 1, youtubeMessageId: 1 },
  { unique: true },
);
youtubeChatMessageSchema.index({ stream: 1, publishedAt: -1 });

export default mongoose.models.YoutubeChatMessage ||
  mongoose.model("YoutubeChatMessage", youtubeChatMessageSchema);
