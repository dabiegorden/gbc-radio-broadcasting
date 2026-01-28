import cron from "node-cron";
import Meeting from "../models/Meeting.js";
import User from "../models/User.js";
import {
  sendMeetingReminder,
  notifyAdminsUpcomingMeeting,
} from "../services/emailService.js";

/**
 * Meeting Notification Scheduler
 * Runs every 15 minutes to check for upcoming meetings
 * Sends reminders 1 hour before meeting time
 */

export const initializeMeetingScheduler = () => {
  // Run every 15 minutes
  cron.schedule("*/15 * * * *", async () => {
    try {
      console.log("🔔 Running meeting reminder check...");

      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

      // Find meetings that are:
      // 1. Scheduled between now and 1 hour from now
      // 2. Status is confirmed or pending
      // 3. Reminder not sent yet
      const upcomingMeetings = await Meeting.find({
        scheduledDate: {
          $gte: now,
          $lte: oneHourLater,
        },
        status: { $in: ["confirmed", "pending"] },
        reminderSent: false,
      }).populate("user assignedAdmin");

      console.log(
        `📧 Found ${upcomingMeetings.length} meetings requiring reminders`,
      );

      for (const meeting of upcomingMeetings) {
        try {
          // Send reminder to user
          if (meeting.user) {
            await sendMeetingReminder(meeting, meeting.user);
            console.log(`✅ Reminder sent to user: ${meeting.user.email}`);
          }

          // Send reminder to all admins
          const admins = await User.find({ role: "admin", isActive: true });
          if (admins.length > 0) {
            await notifyAdminsUpcomingMeeting(meeting, meeting.user, admins);
            console.log(`✅ Reminder sent to ${admins.length} admins`);
          }

          // Mark reminder as sent
          meeting.reminderSent = true;
          await meeting.save();

          console.log(`✅ Reminder processed for meeting: ${meeting.title}`);
        } catch (error) {
          console.error(
            `❌ Error sending reminder for meeting ${meeting._id}:`,
            error,
          );
        }
      }

      console.log("✅ Meeting reminder check completed");
    } catch (error) {
      console.error("❌ Error in meeting scheduler:", error);
    }
  });

  // Mark meetings as completed (runs every hour)
  cron.schedule("0 * * * *", async () => {
    try {
      console.log("🔄 Checking for completed meetings...");

      const now = new Date();

      // Find meetings that have passed and are not marked as completed
      const pastMeetings = await Meeting.find({
        scheduledDate: { $lt: now },
        status: { $in: ["confirmed", "pending"] },
      });

      for (const meeting of pastMeetings) {
        meeting.status = "completed";
        await meeting.save();
      }

      console.log(`✅ Marked ${pastMeetings.length} meetings as completed`);
    } catch (error) {
      console.error("❌ Error marking meetings as completed:", error);
    }
  });

  console.log("✅ Meeting scheduler initialized");
};

/**
 * Send immediate notification for new meeting
 * Called when a meeting is created
 */
export const sendNewMeetingNotifications = async (meetingId) => {
  try {
    const meeting = await Meeting.findById(meetingId).populate("user");

    if (!meeting) {
      throw new Error("Meeting not found");
    }

    // Get all admins
    const admins = await User.find({ role: "admin", isActive: true });

    // Notify admins
    if (admins.length > 0) {
      const { notifyAdminsNewMeeting } =
        await import("../services/emailService.js");
      await notifyAdminsNewMeeting(meeting, meeting.user, admins);
      console.log(`✅ Notified ${admins.length} admins about new meeting`);
    }

    return { success: true };
  } catch (error) {
    console.error("Error sending new meeting notifications:", error);
    return { success: false, error: error.message };
  }
};

export default {
  initializeMeetingScheduler,
  sendNewMeetingNotifications,
};
