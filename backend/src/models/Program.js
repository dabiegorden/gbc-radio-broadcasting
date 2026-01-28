import mongoose from "mongoose";

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
  streamingUrl: {
    type: String,
    default: null,
  },
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

// Index for finding live or upcoming programs
programSchema.index({ status: 1, scheduleStartTime: 1 });
programSchema.index({ isLive: 1 });

export default mongoose.models.Program ||
  mongoose.model("Program", programSchema);
