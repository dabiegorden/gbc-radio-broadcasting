import mongoose from "mongoose";

const analyticsSchema = new mongoose.Schema({
  program: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Program",
    required: true,
  },
  date: {
    type: Date,
    required: true,
    index: true,
  },
  metrics: {
    totalListeners: {
      type: Number,
      default: 0,
    },
    peakListeners: {
      type: Number,
      default: 0,
    },
    averageListeningDuration: {
      type: Number,
      default: 0, // in seconds
    },
    totalEngagements: {
      type: Number,
      default: 0,
    },
    engagementBreakdown: {
      comments: Number,
      likes: Number,
      shares: Number,
      follows: Number,
    },
    sentimentAnalysis: {
      positive: {
        type: Number,
        default: 0,
      },
      neutral: {
        type: Number,
        default: 0,
      },
      negative: {
        type: Number,
        default: 0,
      },
    },
    topKeywords: [
      {
        keyword: String,
        frequency: Number,
      },
    ],
    engagementScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  predictions: {
    expectedEngagement: {
      type: Number,
      default: 0,
    },
    engagementTrend: {
      type: String,
      enum: ["increasing", "stable", "decreasing"],
      default: "stable",
    },
    predictedAudience: {
      type: Number,
      default: 0,
    },
    riskFactors: [String],
    recommendations: [String],
  },
  comparisons: {
    previousSession: {
      listenerDifference: Number,
      engagementDifference: Number,
    },
    weeklyAverage: {
      listenerDifference: Number,
      engagementDifference: Number,
    },
    monthlyAverage: {
      listenerDifference: Number,
      engagementDifference: Number,
    },
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

// Index for finding analytics by program and date
analyticsSchema.index({ program: 1, date: -1 });

export default mongoose.models.Analytics ||
  mongoose.model("Analytics", analyticsSchema);
