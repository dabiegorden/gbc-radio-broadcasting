import Meeting from "../models/Meeting.js";
import User from "../models/User.js";
import {
  sendMeetingConfirmation,
  sendMeetingCancellation,
  notifyAdminsNewMeeting,
} from "../services/emailService.js";

/**
 * Meeting Controller
 * Handles meeting scheduling and management
 */

/**
 * Create a new meeting
 * POST /api/meetings
 */
export const createMeeting = async (req, res) => {
  try {
    const {
      title,
      description,
      meetingType,
      scheduledDate,
      scheduledTime,
      duration,
      location,
      meetingLink,
      notes,
    } = req.body;

    const userId = req.user._id;

    // Validate required fields
    if (!title || !description || !scheduledDate || !scheduledTime) {
      return res.status(400).json({
        message: "Title, description, date, and time are required",
      });
    }

    // Check if meeting date is in the future
    const meetingDate = new Date(scheduledDate);
    if (meetingDate < new Date()) {
      return res.status(400).json({
        message: "Meeting date must be in the future",
      });
    }

    // Create meeting
    const meeting = new Meeting({
      user: userId,
      title,
      description,
      meetingType: meetingType || "consultation",
      scheduledDate: meetingDate,
      scheduledTime,
      duration: duration || 30,
      location: location || "GBC Radio Station",
      meetingLink: meetingLink || null,
      notes: notes || "",
      status: "pending",
    });

    await meeting.save();

    // Populate user details
    await meeting.populate("user", "firstName lastName email");

    // Send confirmation email to user
    try {
      await sendMeetingConfirmation(meeting, meeting.user);
    } catch (emailError) {
      console.error("Error sending confirmation email:", emailError);
    }

    // Notify all admins
    try {
      const admins = await User.find({ role: "admin", isActive: true });
      if (admins.length > 0) {
        await notifyAdminsNewMeeting(meeting, meeting.user, admins);
      }
    } catch (emailError) {
      console.error("Error notifying admins:", emailError);
    }

    res.status(201).json({
      message: "Meeting scheduled successfully",
      meeting,
    });
  } catch (error) {
    console.error("Create meeting error:", error);
    res.status(500).json({
      message: "Server error creating meeting",
      error: error.message,
    });
  }
};

/**
 * Get all meetings (Admin only)
 * GET /api/meetings
 */
export const getAllMeetings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      meetingType,
      sortBy = "scheduledDate",
      sortOrder = "asc",
      search,
    } = req.query;

    const skip = (page - 1) * limit;

    let query = {};

    if (status) {
      query.status = status;
    }

    if (meetingType) {
      query.meetingType = meetingType;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const meetings = await Meeting.find(query)
      .populate("user", "firstName lastName email")
      .populate("assignedAdmin", "firstName lastName email")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Meeting.countDocuments(query);

    res.json({
      message: "Meetings retrieved",
      meetings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all meetings error:", error);
    res.status(500).json({
      message: "Server error fetching meetings",
      error: error.message,
    });
  }
};

/**
 * Get user's own meetings
 * GET /api/meetings/my-meetings
 */
export const getMyMeetings = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const userId = req.user._id;

    const skip = (page - 1) * limit;

    let query = { user: userId };

    if (status) {
      query.status = status;
    }

    const meetings = await Meeting.find(query)
      .populate("assignedAdmin", "firstName lastName email")
      .sort({ scheduledDate: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Meeting.countDocuments(query);

    res.json({
      message: "Your meetings retrieved",
      meetings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get my meetings error:", error);
    res.status(500).json({
      message: "Server error fetching your meetings",
      error: error.message,
    });
  }
};

/**
 * Get meeting by ID
 * GET /api/meetings/:id
 */
export const getMeetingById = async (req, res) => {
  try {
    const { id } = req.params;

    const meeting = await Meeting.findById(id)
      .populate("user", "firstName lastName email")
      .populate("assignedAdmin", "firstName lastName email");

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    // Check if user owns this meeting or is admin
    if (
      meeting.user._id.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        message: "Not authorized to view this meeting",
      });
    }

    res.json({
      message: "Meeting retrieved",
      meeting,
    });
  } catch (error) {
    console.error("Get meeting error:", error);
    res.status(500).json({
      message: "Server error fetching meeting",
      error: error.message,
    });
  }
};

/**
 * Update meeting
 * PUT /api/meetings/:id
 */
export const updateMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      meetingType,
      scheduledDate,
      scheduledTime,
      duration,
      status,
      location,
      meetingLink,
      notes,
      adminNotes,
      assignedAdmin,
    } = req.body;

    const meeting = await Meeting.findById(id);

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    // Check permissions
    const isOwner = meeting.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        message: "Not authorized to update this meeting",
      });
    }

    // Update fields
    if (title) meeting.title = title;
    if (description) meeting.description = description;
    if (meetingType) meeting.meetingType = meetingType;
    if (scheduledDate) meeting.scheduledDate = new Date(scheduledDate);
    if (scheduledTime) meeting.scheduledTime = scheduledTime;
    if (duration) meeting.duration = duration;
    if (location) meeting.location = location;
    if (meetingLink !== undefined) meeting.meetingLink = meetingLink;
    if (notes !== undefined) meeting.notes = notes;

    // Admin-only fields
    if (isAdmin) {
      if (status) meeting.status = status;
      if (adminNotes !== undefined) meeting.adminNotes = adminNotes;

      if (assignedAdmin !== undefined) {
        meeting.assignedAdmin = assignedAdmin === "" ? null : assignedAdmin;
      }
    }

    meeting.updatedAt = new Date();

    await meeting.save();

    await meeting.populate("user", "firstName lastName email");
    await meeting.populate("assignedAdmin", "firstName lastName email");

    res.json({
      message: "Meeting updated successfully",
      meeting,
    });
  } catch (error) {
    console.error("Update meeting error:", error);
    res.status(500).json({
      message: "Server error updating meeting",
      error: error.message,
    });
  }
};

/**
 * Cancel meeting
 * PATCH /api/meetings/:id/cancel
 */
export const cancelMeeting = async (req, res) => {
  try {
    const { id } = req.params;

    const meeting = await Meeting.findById(id).populate(
      "user",
      "firstName lastName email",
    );

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    // Check permissions
    const isOwner = meeting.user._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        message: "Not authorized to cancel this meeting",
      });
    }

    meeting.status = "cancelled";
    meeting.updatedAt = new Date();

    await meeting.save();

    // Send cancellation email
    try {
      await sendMeetingCancellation(meeting, meeting.user);
    } catch (emailError) {
      console.error("Error sending cancellation email:", emailError);
    }

    res.json({
      message: "Meeting cancelled successfully",
      meeting,
    });
  } catch (error) {
    console.error("Cancel meeting error:", error);
    res.status(500).json({
      message: "Server error cancelling meeting",
      error: error.message,
    });
  }
};

/**
 * Delete meeting
 * DELETE /api/meetings/:id
 */
export const deleteMeeting = async (req, res) => {
  try {
    const { id } = req.params;

    const meeting = await Meeting.findById(id);

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    // Only admins can delete meetings
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can delete meetings",
      });
    }

    await Meeting.findByIdAndDelete(id);

    res.json({
      message: "Meeting deleted successfully",
    });
  } catch (error) {
    console.error("Delete meeting error:", error);
    res.status(500).json({
      message: "Server error deleting meeting",
      error: error.message,
    });
  }
};

/**
 * Get meeting statistics
 * GET /api/meetings/stats
 */
export const getMeetingStats = async (req, res) => {
  try {
    const totalMeetings = await Meeting.countDocuments();
    const pendingMeetings = await Meeting.countDocuments({ status: "pending" });
    const confirmedMeetings = await Meeting.countDocuments({
      status: "confirmed",
    });
    const completedMeetings = await Meeting.countDocuments({
      status: "completed",
    });
    const cancelledMeetings = await Meeting.countDocuments({
      status: "cancelled",
    });

    // Upcoming meetings (future dates)
    const upcomingMeetings = await Meeting.countDocuments({
      scheduledDate: { $gte: new Date() },
      status: { $in: ["pending", "confirmed"] },
    });

    // Meetings by type
    const meetingsByType = await Meeting.aggregate([
      {
        $group: {
          _id: "$meetingType",
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      message: "Meeting statistics retrieved",
      stats: {
        total: totalMeetings,
        pending: pendingMeetings,
        confirmed: confirmedMeetings,
        completed: completedMeetings,
        cancelled: cancelledMeetings,
        upcoming: upcomingMeetings,
        byType: meetingsByType,
      },
    });
  } catch (error) {
    console.error("Get meeting stats error:", error);
    res.status(500).json({
      message: "Server error fetching meeting stats",
      error: error.message,
    });
  }
};

export default {
  createMeeting,
  getAllMeetings,
  getMyMeetings,
  getMeetingById,
  updateMeeting,
  cancelMeeting,
  deleteMeeting,
  getMeetingStats,
};
