import mongoose from "mongoose";
import dotenv from "dotenv";
import { ENV } from "./src/libs/env.js";

dotenv.config();

// Program Schema (copy from your model)
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

const Program =
  mongoose.models.Program || mongoose.model("Program", programSchema);

async function addLiveProgram() {
  try {
    // Connect to MongoDB
    await mongoose.connect(ENV.MONGODB_URL);
    console.log("✓ Connected to MongoDB");

    // You'll need to replace this with an actual user ID from your database
    // Run this query in MongoDB to get a user ID: db.users.findOne({}, {_id: 1})
    const userId = "6978a2e03df5d4b600d6a893"; // REPLACE THIS!

    // Create a default live program
    const liveProgram = await Program.create({
      title: "24/7 Live Radio Stream",
      description:
        "Your favorite music and talk shows broadcasting live around the clock. Tune in for the latest hits, news updates, and engaging conversations.",
      host: "Radio Station Team",
      category: "music",
      scheduleStartTime: new Date(), // Now
      scheduleEndTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      isLive: true,
      isRecurring: true,
      recurringDays: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      streamingUrl: "http://stream.zeno.fm/7ans4am829duv",
      status: "live",
      currentListeners: 0,
      totalListeners: 0,
      averageEngagementScore: 0,
      tags: ["live", "24/7", "music", "radio"],
      createdBy: userId,
    });

    console.log("✓ Live program created successfully!");
    console.log("Program ID:", liveProgram._id);
    console.log("Title:", liveProgram.title);
    console.log("Status:", liveProgram.status);
    console.log("Is Live:", liveProgram.isLive);

    await mongoose.connection.close();
    console.log("✓ Database connection closed");
  } catch (error) {
    console.error("Error creating live program:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

addLiveProgram();
