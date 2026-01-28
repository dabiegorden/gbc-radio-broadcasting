import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config({ quiet: true });
import { ENV } from "../libs/env.js";

/**
 * Email Service using Resend
 * Handles all email notifications for the platform
 */

const resend = new Resend(ENV.RESEND_API_KEY);

/**
 * Send meeting confirmation email to user
 */
export const sendMeetingConfirmation = async (meeting, user) => {
  try {
    const meetingDate = new Date(meeting.scheduledDate).toLocaleDateString(
      "en-US",
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      },
    );

    const { data, error } = await resend.emails.send({
      from: "GBC Radio <onboarding@resend.dev>",
      to: [user.email],
      subject: `Meeting Scheduled - ${meeting.title}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .content {
                background: white;
                padding: 30px;
                border-radius: 10px;
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
              }
              .logo {
                font-size: 28px;
                font-weight: bold;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
              }
              .details {
                background: #f7f7f7;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
              }
              .detail-row {
                margin: 10px 0;
              }
              .label {
                font-weight: bold;
                color: #667eea;
              }
              .footer {
                text-align: center;
                margin-top: 30px;
                font-size: 12px;
                color: #666;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="content">
                <div class="header">
                  <div class="logo">📻 GBC Radio</div>
                  <h2>Meeting Confirmed!</h2>
                </div>
                
                <p>Dear ${user.firstName} ${user.lastName},</p>
                
                <p>Your meeting has been successfully scheduled with GBC Radio Station.</p>
                
                <div class="details">
                  <div class="detail-row">
                    <span class="label">Meeting Title:</span> ${meeting.title}
                  </div>
                  <div class="detail-row">
                    <span class="label">Type:</span> ${meeting.meetingType}
                  </div>
                  <div class="detail-row">
                    <span class="label">Date:</span> ${meetingDate}
                  </div>
                  <div class="detail-row">
                    <span class="label">Time:</span> ${meeting.scheduledTime}
                  </div>
                  <div class="detail-row">
                    <span class="label">Duration:</span> ${meeting.duration} minutes
                  </div>
                  <div class="detail-row">
                    <span class="label">Location:</span> ${meeting.location}
                  </div>
                  ${meeting.meetingLink ? `<div class="detail-row"><span class="label">Meeting Link:</span> <a href="${meeting.meetingLink}">${meeting.meetingLink}</a></div>` : ""}
                </div>
                
                <p><strong>Description:</strong><br>${meeting.description}</p>
                
                ${meeting.notes ? `<p><strong>Additional Notes:</strong><br>${meeting.notes}</p>` : ""}
                
                <p>We look forward to meeting with you. If you need to reschedule or cancel, please contact us as soon as possible.</p>
                
                <div class="footer">
                  <p>© 2025 GBC Radio Analytics Platform. All rights reserved.</p>
                  <p>Powered by AI • Built with ❤️ for Broadcasters</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("Email send error:", error);
      return { success: false, error };
    }

    console.log("Meeting confirmation email sent:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Email service error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Send meeting reminder to user (1 hour before)
 */
export const sendMeetingReminder = async (meeting, user) => {
  try {
    const meetingDate = new Date(meeting.scheduledDate).toLocaleDateString(
      "en-US",
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      },
    );

    const { data, error } = await resend.emails.send({
      from: "GBC Radio <onboarding@resend.dev>",
      to: [user.email],
      subject: `Reminder: Meeting in 1 Hour - ${meeting.title}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .content {
                background: white;
                padding: 30px;
                border-radius: 10px;
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
              }
              .logo {
                font-size: 28px;
                font-weight: bold;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
              }
              .alert {
                background: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
              }
              .details {
                background: #f7f7f7;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
              }
              .detail-row {
                margin: 10px 0;
              }
              .label {
                font-weight: bold;
                color: #667eea;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="content">
                <div class="header">
                  <div class="logo">📻 GBC Radio</div>
                  <h2>🔔 Meeting Reminder</h2>
                </div>
                
                <div class="alert">
                  <strong>⏰ Your meeting is starting in 1 hour!</strong>
                </div>
                
                <p>Dear ${user.firstName} ${user.lastName},</p>
                
                <p>This is a friendly reminder about your upcoming meeting with GBC Radio Station.</p>
                
                <div class="details">
                  <div class="detail-row">
                    <span class="label">Meeting Title:</span> ${meeting.title}
                  </div>
                  <div class="detail-row">
                    <span class="label">Date:</span> ${meetingDate}
                  </div>
                  <div class="detail-row">
                    <span class="label">Time:</span> ${meeting.scheduledTime}
                  </div>
                  <div class="detail-row">
                    <span class="label">Location:</span> ${meeting.location}
                  </div>
                  ${meeting.meetingLink ? `<div class="detail-row"><span class="label">Meeting Link:</span> <a href="${meeting.meetingLink}">${meeting.meetingLink}</a></div>` : ""}
                </div>
                
                <p>Please make sure you're prepared and arrive on time. We look forward to seeing you!</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("Reminder email error:", error);
      return { success: false, error };
    }

    console.log("Meeting reminder email sent:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Email service error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Notify all admins about new meeting
 */
export const notifyAdminsNewMeeting = async (meeting, user, admins) => {
  try {
    const meetingDate = new Date(meeting.scheduledDate).toLocaleDateString(
      "en-US",
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      },
    );

    const adminEmails = admins.map((admin) => admin.email);

    const { data, error } = await resend.emails.send({
      from: "GBC Radio <support@jssolutionshub.com>",
      to: adminEmails,
      subject: `New Meeting Request - ${meeting.title}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .content {
                background: white;
                padding: 30px;
                border-radius: 10px;
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
              }
              .logo {
                font-size: 28px;
                font-weight: bold;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
              }
              .new-badge {
                background: #28a745;
                color: white;
                padding: 5px 15px;
                border-radius: 20px;
                display: inline-block;
                margin: 10px 0;
              }
              .details {
                background: #f7f7f7;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
              }
              .detail-row {
                margin: 10px 0;
              }
              .label {
                font-weight: bold;
                color: #667eea;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="content">
                <div class="header">
                  <div class="logo">📻 GBC Radio</div>
                  <h2>New Meeting Request</h2>
                  <span class="new-badge">⚠️ Requires Attention</span>
                </div>
                
                <p>Dear Admin Team,</p>
                
                <p>A new meeting has been scheduled by <strong>${user.firstName} ${user.lastName}</strong> (${user.email}).</p>
                
                <div class="details">
                  <div class="detail-row">
                    <span class="label">Meeting Title:</span> ${meeting.title}
                  </div>
                  <div class="detail-row">
                    <span class="label">Type:</span> ${meeting.meetingType}
                  </div>
                  <div class="detail-row">
                    <span class="label">Date:</span> ${meetingDate}
                  </div>
                  <div class="detail-row">
                    <span class="label">Time:</span> ${meeting.scheduledTime}
                  </div>
                  <div class="detail-row">
                    <span class="label">Duration:</span> ${meeting.duration} minutes
                  </div>
                  <div class="detail-row">
                    <span class="label">Status:</span> <span style="color: orange;">${meeting.status}</span>
                  </div>
                </div>
                
                <p><strong>Description:</strong><br>${meeting.description}</p>
                
                <p>Please review this meeting request and confirm or reschedule as needed through the admin dashboard.</p>
                
                <p style="text-align: center; margin-top: 30px;">
                  <a href="${process.env.FRONTEND_URL}/dashboard/meetings" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">View in Dashboard</a>
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("Admin notification error:", error);
      return { success: false, error };
    }

    console.log("Admin notification email sent:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Email service error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Notify admins about upcoming meeting (1 hour before)
 */
export const notifyAdminsUpcomingMeeting = async (meeting, user, admins) => {
  try {
    const meetingDate = new Date(meeting.scheduledDate).toLocaleDateString(
      "en-US",
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      },
    );

    const adminEmails = admins.map((admin) => admin.email);

    const { data, error } = await resend.emails.send({
      from: "GBC Radio <support@jssolutionshub.com>",
      to: adminEmails,
      subject: `Reminder: Meeting in 1 Hour with ${user.firstName} ${user.lastName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .content {
                background: white;
                padding: 30px;
                border-radius: 10px;
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
              }
              .logo {
                font-size: 28px;
                font-weight: bold;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
              }
              .alert {
                background: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
              }
              .details {
                background: #f7f7f7;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
              }
              .detail-row {
                margin: 10px 0;
              }
              .label {
                font-weight: bold;
                color: #667eea;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="content">
                <div class="header">
                  <div class="logo">📻 GBC Radio</div>
                  <h2>🔔 Meeting Reminder</h2>
                </div>
                
                <div class="alert">
                  <strong>⏰ Meeting starting in 1 hour!</strong>
                </div>
                
                <p>Dear Admin Team,</p>
                
                <p>You have an upcoming meeting with <strong>${user.firstName} ${user.lastName}</strong> (${user.email}).</p>
                
                <div class="details">
                  <div class="detail-row">
                    <span class="label">Meeting Title:</span> ${meeting.title}
                  </div>
                  <div class="detail-row">
                    <span class="label">Type:</span> ${meeting.meetingType}
                  </div>
                  <div class="detail-row">
                    <span class="label">Date:</span> ${meetingDate}
                  </div>
                  <div class="detail-row">
                    <span class="label">Time:</span> ${meeting.scheduledTime}
                  </div>
                  <div class="detail-row">
                    <span class="label">Location:</span> ${meeting.location}
                  </div>
                  ${meeting.meetingLink ? `<div class="detail-row"><span class="label">Meeting Link:</span> <a href="${meeting.meetingLink}">${meeting.meetingLink}</a></div>` : ""}
                </div>
                
                <p><strong>Description:</strong><br>${meeting.description}</p>
                
                ${meeting.adminNotes ? `<p><strong>Admin Notes:</strong><br>${meeting.adminNotes}</p>` : ""}
                
                <p>Please ensure you're prepared for this meeting.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("Admin reminder error:", error);
      return { success: false, error };
    }

    console.log("Admin reminder email sent:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Email service error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Send meeting cancellation email
 */
export const sendMeetingCancellation = async (meeting, user) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "GBC Radio <onboarding@resend.dev>",
      to: [user.email],
      subject: `Meeting Cancelled - ${meeting.title}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .content {
                background: white;
                padding: 30px;
                border-radius: 10px;
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
              }
              .logo {
                font-size: 28px;
                font-weight: bold;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
              }
              .alert {
                background: #f8d7da;
                border-left: 4px solid #dc3545;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
                color: #721c24;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="content">
                <div class="header">
                  <div class="logo">📻 GBC Radio</div>
                  <h2>Meeting Cancelled</h2>
                </div>
                
                <div class="alert">
                  <strong>⚠️ Your meeting has been cancelled</strong>
                </div>
                
                <p>Dear ${user.firstName} ${user.lastName},</p>
                
                <p>We regret to inform you that your meeting "<strong>${meeting.title}</strong>" has been cancelled.</p>
                
                <p>If you would like to reschedule, please contact us or book a new meeting through our platform.</p>
                
                <p>We apologize for any inconvenience.</p>
                
                <p>Best regards,<br>GBC Radio Team</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("Cancellation email error:", error);
      return { success: false, error };
    }

    console.log("Cancellation email sent:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Email service error:", error);
    return { success: false, error: error.message };
  }
};

export default {
  sendMeetingConfirmation,
  sendMeetingReminder,
  notifyAdminsNewMeeting,
  notifyAdminsUpcomingMeeting,
  sendMeetingCancellation,
};
