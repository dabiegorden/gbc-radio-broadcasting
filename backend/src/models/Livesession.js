import mongoose from "mongoose";

/**
 * LiveSession Model
 * ─────────────────
 * Stores every broadcast session independently — no Program required.
 * When a session ends, the GetStream recording URL is uploaded to
 * Cloudinary and the resulting playback URL is stored here so viewers
 * can watch past sessions any time.
 */

const liveSessionSchema = new mongoose.Schema(
  {
    // ── Identity ────────────────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, "Session title is required"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },

    // ── Host / presenter ────────────────────────────────────────────────────
    hostedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hostDisplayName: {
      type: String,
      required: true,
    },

    // ── GetStream call details ───────────────────────────────────────────────
    /**
     * A stable, unique call-id used on the GetStream side.
     * We generate it as  `session-<uuid>`  so it is independent
     * of any Program document.
     */
    streamCallId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    streamCallType: {
      type: String,
      default: "livestream",
    },

    // ── Lifecycle ────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["scheduled", "live", "ended", "processing", "available"],
      default: "scheduled",
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    /** Duration in seconds — calculated when session ends */
    durationSeconds: {
      type: Number,
      default: null,
    },

    // ── Audience ─────────────────────────────────────────────────────────────
    peakListeners: {
      type: Number,
      default: 0,
    },
    totalListeners: {
      type: Number,
      default: 0,
    },

    // ── Recording / Cloudinary ───────────────────────────────────────────────
    /**
     * Raw recording URL handed back by GetStream after the session ends.
     * This is the source we upload to Cloudinary.
     */
    rawRecordingUrl: {
      type: String,
      default: null,
    },
    /**
     * After upload to Cloudinary these fields are populated so the
     * recording can be streamed via the Cloudinary video player or a
     * plain <video> tag.
     */
    cloudinary: {
      publicId: { type: String, default: null },
      /** Optimised HLS / mp4 playback URL from Cloudinary */
      playbackUrl: { type: String, default: null },
      /** Thumbnail image URL */
      thumbnailUrl: { type: String, default: null },
      /** File size in bytes */
      bytes: { type: Number, default: null },
      /** Upload timestamp */
      uploadedAt: { type: Date, default: null },
    },

    // ── Optional link back to a scheduled Program ────────────────────────────
    /**
     * Purely informational — a session CAN be linked to a Program but is
     * never required to be.  Leave null for ad-hoc broadcasts.
     */
    linkedProgram: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Program",
      default: null,
    },

    // ── Misc ─────────────────────────────────────────────────────────────────
    tags: [{ type: String }],
    coverImage: { type: String, default: null },
    isPublic: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // createdAt + updatedAt managed by Mongoose
  },
);

// Indexes for common query patterns
liveSessionSchema.index({ status: 1, startedAt: -1 });
liveSessionSchema.index({ hostedBy: 1, status: 1 });
liveSessionSchema.index({ linkedProgram: 1 });

export default mongoose.models.LiveSession ||
  mongoose.model("LiveSession", liveSessionSchema);
