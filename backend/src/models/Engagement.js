import mongoose from "mongoose";

const engagementSchema = new mongoose.Schema({
  program: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Program",
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  engagementType: {
    type: String,
    enum: ["listening", "comment", "like", "share", "follow"],
    required: true,
  },
  comment: {
    text: String,
    sentiment: {
      type: String,
      enum: ["positive", "neutral", "negative"],
      default: null,
    },
    engagementScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    aiAnalysis: {
      summary: String,
      keywords: [String],
      predictedFollowUp: Boolean,
    },
  },
  listeningDuration: {
    type: Number,
    default: 0, // in seconds
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  sessionId: {
    type: String,
    required: true,
  },
  deviceInfo: {
    type: String,
    default: null,
  },
  location: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for analytics queries
engagementSchema.index({ program: 1, createdAt: -1 });
engagementSchema.index({ user: 1, createdAt: -1 });
engagementSchema.index({ sessionId: 1 });
engagementSchema.index({ engagementType: 1 });

export default mongoose.models.Engagement ||
  mongoose.model("Engagement", engagementSchema);
