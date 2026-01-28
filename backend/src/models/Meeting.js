import mongoose from "mongoose";

const meetingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    title: {
      type: String,
      required: [true, "Meeting title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Meeting description is required"],
    },
    meetingType: {
      type: String,
      enum: [
        "consultation",
        "program-pitch",
        "sponsorship",
        "interview",
        "other",
      ],
      default: "consultation",
    },
    scheduledDate: {
      type: Date,
      required: [true, "Meeting date is required"],
    },
    scheduledTime: {
      type: String,
      required: [true, "Meeting time is required"],
    },
    duration: {
      type: Number, // in minutes
      default: 30,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed"],
      default: "pending",
    },
    location: {
      type: String,
      default: "GBC Radio Station",
    },
    meetingLink: {
      type: String, // For virtual meetings
      default: null,
    },
    notes: {
      type: String,
      default: "",
    },
    adminNotes: {
      type: String,
      default: "",
    },
    notificationSent: {
      type: Boolean,
      default: false,
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },
    assignedAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Index for efficient querying
meetingSchema.index({ scheduledDate: 1, status: 1 });
meetingSchema.index({ user: 1 });
meetingSchema.index({ assignedAdmin: 1 });

const Meeting =
  mongoose.models.Meeting || mongoose.model("Meeting", meetingSchema);

export default Meeting;
