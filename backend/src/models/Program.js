import mongoose from "mongoose";

const socialStreamSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ["tiktok", "facebook", "instagram", "youtube"],
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    embedUrl: {
      type: String,
      default: null, // Auto-derived embed URL for in-app watching
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    label: {
      type: String,
      default: null, // e.g. "Main YouTube Stream", "TikTok Live"
    },
  },
  { _id: true },
);

const programSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Please provide program title"],
  },
  description: {
    type: String,
    required: [true, "Please provide program description"],
  },
  host: {
    type: String,
    required: [true, "Please provide host name"],
  },
  category: {
    type: String,
    enum: [
      "news",
      "music",
      "talk-show",
      "drama",
      "sports",
      "educational",
      "entertainment",
      "other",
    ],
    default: "other",
  },
  scheduleStartTime: {
    type: Date,
    required: [true, "Please provide start time"],
  },
  scheduleEndTime: {
    type: Date,
    required: [true, "Please provide end time"],
  },
  isLive: {
    type: Boolean,
    default: false,
  },
  isRecurring: {
    type: Boolean,
    default: false,
  },
  recurringDays: [
    {
      type: String,
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
    },
  ],

  // ── Streaming / Broadcast URLs ──────────────────────────────────────────
  streamingUrl: {
    type: String,
    default: null, // Primary live broadcast URL (radio/HLS/RTMP etc.)
  },
  socialStreams: {
    type: [socialStreamSchema],
    default: [],
    // Array of { platform, url, embedUrl, isActive, label }
  },
  // ────────────────────────────────────────────────────────────────────────

  status: {
    type: String,
    enum: ["scheduled", "live", "completed", "cancelled"],
    default: "scheduled",
  },
  currentListeners: {
    type: Number,
    default: 0,
  },
  totalListeners: {
    type: Number,
    default: 0,
  },
  averageEngagementScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  coverImage: {
    type: String,
    default: null,
  },
  tags: [
    {
      type: String,
    },
  ],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

programSchema.index({ status: 1, scheduleStartTime: 1 });
programSchema.index({ isLive: 1 });

export default mongoose.models.Program ||
  mongoose.model("Program", programSchema);
