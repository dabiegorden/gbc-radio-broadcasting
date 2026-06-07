import YoutubeLiveStream from "../models/YoutubeLiveStream.js";
import YoutubeChatMessage from "../models/YoutubeChatMessage.js";
import {
  createStreamFromUrl,
  syncStreamStats,
  syncStreamChat,
  publicStats,
} from "../services/youtubeService.js";
import {
  buildAnalytics,
  getRecentChats,
} from "../services/youtubeAnalyticsService.js";

/**
 * YouTube Stream Controller
 * ─────────────────────────
 * REST surface for the YouTube Live monitoring + analytics feature.
 * Admin-only for create/update/delete/manual-sync; reads are public so the
 * frontend watch page can render embed + analytics without auth.
 */

/**
 * Create a monitored YouTube stream from a URL.
 * POST /api/youtube
 * Body: { youtubeUrl, linkedProgram? }
 */
export const createYoutubeStream = async (req, res) => {
  try {
    const { youtubeUrl, linkedProgram } = req.body;

    if (!youtubeUrl) {
      return res
        .status(400)
        .json({ success: false, message: "youtubeUrl is required" });
    }

    const stream = await createStreamFromUrl({
      url: youtubeUrl,
      createdBy: req.user?._id || null,
      linkedProgram: linkedProgram || null,
      io: req.io,
    });

    res.status(201).json({
      success: true,
      message: "YouTube stream is now being monitored",
      stream,
    });
  } catch (error) {
    console.error("createYoutubeStream error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Server error creating YouTube stream",
    });
  }
};

/**
 * List monitored streams.
 * GET /api/youtube?status=live&page=1&limit=20
 */
export const getYoutubeStreams = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.liveStatus = status;

    const streams = await YoutubeLiveStream.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("linkedProgram", "title")
      .lean();

    const total = await YoutubeLiveStream.countDocuments(query);

    res.json({
      success: true,
      message: "YouTube streams retrieved",
      streams,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getYoutubeStreams error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching YouTube streams",
      error: error.message,
    });
  }
};

/**
 * Get one stream WITH analytics + recent chats (the unified response).
 * GET /api/youtube/:id
 *
 * Response shape matches the brief:
 * { stream, analytics, recentChats }
 */
export const getYoutubeStreamById = async (req, res) => {
  try {
    const stream = await YoutubeLiveStream.findById(req.params.id).lean();
    if (!stream) {
      return res
        .status(404)
        .json({ success: false, message: "Stream not found" });
    }

    const [analytics, recentChats] = await Promise.all([
      buildAnalytics(stream._id),
      getRecentChats(stream._id, 50),
    ]);

    res.json({
      success: true,
      message: "Stream retrieved",
      stream: {
        ...stream,
        // convenient flat fields for the frontend player header
        title: stream.title,
        youtubeUrl: stream.youtubeUrl,
        viewers: stream.currentViewers,
        likes: stream.likes,
        views: stream.views,
      },
      analytics,
      recentChats,
    });
  } catch (error) {
    console.error("getYoutubeStreamById error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Server error fetching stream",
    });
  }
};

/**
 * Analytics only (lighter than the full stream payload).
 * GET /api/youtube/:id/analytics
 */
export const getYoutubeStreamAnalytics = async (req, res) => {
  try {
    const analytics = await buildAnalytics(req.params.id);
    res.json({ success: true, message: "Analytics retrieved", analytics });
  } catch (error) {
    console.error("getYoutubeStreamAnalytics error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Server error building analytics",
    });
  }
};

/**
 * Manually force a sync of stats + chat (admin "Refresh" button).
 * POST /api/youtube/:id/sync
 */
export const syncYoutubeStreamNow = async (req, res) => {
  try {
    const stream = await YoutubeLiveStream.findById(req.params.id);
    if (!stream) {
      return res
        .status(404)
        .json({ success: false, message: "Stream not found" });
    }

    await syncStreamStats(stream, req.io);

    // Bypass the poll-window guard for a manual refresh.
    stream.nextChatPollAt = null;
    let chatResult = { stored: 0 };
    try {
      chatResult = await syncStreamChat(stream, req.io);
    } catch (chatErr) {
      // Stats already saved; surface chat issue without failing the request.
      console.warn("Manual chat sync warning:", chatErr.message);
    }

    res.json({
      success: true,
      message: "Stream synced",
      newMessages: chatResult.stored,
      stats: publicStats(stream),
    });
  } catch (error) {
    console.error("syncYoutubeStreamNow error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Server error syncing stream",
    });
  }
};

/**
 * Update a stream (toggle monitoring, change URL link, etc).
 * PUT /api/youtube/:id
 * Body: { monitoringEnabled?, linkedProgram? }
 */
export const updateYoutubeStream = async (req, res) => {
  try {
    const { monitoringEnabled, linkedProgram } = req.body;
    const stream = await YoutubeLiveStream.findById(req.params.id);
    if (!stream) {
      return res
        .status(404)
        .json({ success: false, message: "Stream not found" });
    }

    if (monitoringEnabled !== undefined)
      stream.monitoringEnabled = monitoringEnabled;
    if (linkedProgram !== undefined)
      stream.linkedProgram = linkedProgram || null;

    await stream.save();

    res.json({ success: true, message: "Stream updated", stream });
  } catch (error) {
    console.error("updateYoutubeStream error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating stream",
      error: error.message,
    });
  }
};

/**
 * Delete a stream and its stored chat messages.
 * DELETE /api/youtube/:id
 */
export const deleteYoutubeStream = async (req, res) => {
  try {
    const stream = await YoutubeLiveStream.findByIdAndDelete(req.params.id);
    if (!stream) {
      return res
        .status(404)
        .json({ success: false, message: "Stream not found" });
    }

    // Clean up associated chat messages.
    await YoutubeChatMessage.deleteMany({ stream: stream._id });

    res.json({ success: true, message: "Stream deleted" });
  } catch (error) {
    console.error("deleteYoutubeStream error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting stream",
      error: error.message,
    });
  }
};

export default {
  createYoutubeStream,
  getYoutubeStreams,
  getYoutubeStreamById,
  getYoutubeStreamAnalytics,
  syncYoutubeStreamNow,
  updateYoutubeStream,
  deleteYoutubeStream,
};
