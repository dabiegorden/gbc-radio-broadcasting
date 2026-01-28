import Program from "../models/Program.js";
import axios from "axios";

/**
 * Streaming Controller
 * Handles radio stream management and status
 */

/**
 * Get stream URL for a program
 * GET /api/streaming/:programId
 */
export const getStreamUrl = async (req, res) => {
  try {
    const { programId } = req.params;

    const program = await Program.findById(programId);

    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    res.json({
      message: "Stream URL retrieved",
      streamData: {
        programId: program._id,
        title: program.title,
        streamUrl: program.streamingUrl,
        isLive: program.isLive,
        listenerCount: program.currentListeners,
      },
    });
  } catch (error) {
    console.error("Get stream URL error:", error);
    res.status(500).json({
      message: "Server error fetching stream URL",
      error: error.message,
    });
  }
};

/**
 * Check stream availability
 * GET /api/streaming/:programId/status
 */
export const checkStreamStatus = async (req, res) => {
  try {
    const { programId } = req.params;

    const program = await Program.findById(programId);

    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    // Try to check if stream is reachable
    let streamStatus = {
      available: false,
      statusCode: null,
      error: null,
    };

    try {
      const response = await axios.head(program.streamingUrl, {
        timeout: 5000,
      });
      streamStatus.available =
        response.status === 200 || response.status === 206;
      streamStatus.statusCode = response.status;
    } catch (error) {
      streamStatus.error = error.message;
      // Even if HEAD fails, we assume stream might be available
      // as some streaming servers don't support HEAD
      streamStatus.available = true;
    }

    res.json({
      message: "Stream status retrieved",
      program: {
        id: program._id,
        title: program.title,
        isLive: program.isLive,
      },
      stream: streamStatus,
    });
  } catch (error) {
    console.error("Check stream status error:", error);
    res.status(500).json({
      message: "Server error checking stream status",
      error: error.message,
    });
  }
};

/**
 * Update stream status
 * PATCH /api/streaming/:programId/update-status
 */
export const updateStreamStatus = async (req, res) => {
  try {
    const { programId } = req.params;
    const { isLive, listenerCount } = req.body;

    const updateData = {};
    if (isLive !== undefined) updateData.isLive = isLive;
    if (listenerCount !== undefined)
      updateData.currentListeners = listenerCount;

    const program = await Program.findByIdAndUpdate(programId, updateData, {
      new: true,
    });

    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    // Emit real-time update via Socket.IO if available
    if (req.io) {
      req.io.emit("stream-status-updated", {
        programId,
        isLive: program.isLive,
        listenerCount: program.currentListeners,
        title: program.title,
        host: program.host,
      });
    }

    res.json({
      message: "Stream status updated",
      program,
    });
  } catch (error) {
    console.error("Update stream status error:", error);
    res.status(500).json({
      message: "Server error updating stream status",
      error: error.message,
    });
  }
};

/**
 * Get all live streams
 * GET /api/streaming/live
 */
export const getLiveStreams = async (req, res) => {
  try {
    const livePrograms = await Program.find({ isLive: true }).sort({
      scheduleStartTime: -1,
    });

    res.json({
      message: "Live streams retrieved",
      streams: livePrograms,
      count: livePrograms.length,
    });
  } catch (error) {
    console.error("Get live streams error:", error);
    res.status(500).json({
      message: "Server error fetching live streams",
      error: error.message,
    });
  }
};

/**
 * Get stream metadata
 * GET /api/streaming/:programId/metadata
 */
export const getStreamMetadata = async (req, res) => {
  try {
    const { programId } = req.params;

    const program = await Program.findById(programId);

    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    const metadata = {
      id: program._id,
      title: program.title,
      description: program.description,
      host: program.host,
      category: program.category,
      scheduleStartTime: program.scheduleStartTime,
      scheduleEndTime: program.scheduleEndTime,
      streamingUrl: program.streamingUrl,
      isLive: program.isLive,
      listenerCount: program.currentListeners,
      totalListeners: program.totalListeners,
      status: program.status,
      coverImage: program.coverImage,
      tags: program.tags,
      createdAt: program.createdAt,
      updatedAt: program.updatedAt,
    };

    res.json({
      message: "Stream metadata retrieved",
      metadata,
    });
  } catch (error) {
    console.error("Get stream metadata error:", error);
    res.status(500).json({
      message: "Server error fetching stream metadata",
      error: error.message,
    });
  }
};

/**
 * Record stream information
 * POST /api/streaming/:programId/record
 */
export const recordStreamInfo = async (req, res) => {
  try {
    const { programId } = req.params;
    const { duration, recordingUrl, quality } = req.body;

    const program = await Program.findById(programId);

    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    // Add to recordings array if it exists
    if (!program.recordings) {
      program.recordings = [];
    }

    program.recordings.push({
      date: new Date(),
      duration,
      recordingUrl,
      quality,
    });

    await program.save();

    res.json({
      message: "Recording info saved",
      program,
    });
  } catch (error) {
    console.error("Record stream info error:", error);
    res.status(500).json({
      message: "Server error recording stream info",
      error: error.message,
    });
  }
};

/**
 * Get stream health metrics
 * GET /api/streaming/health/metrics
 */
export const getStreamHealthMetrics = async (req, res) => {
  try {
    const livePrograms = await Program.find({ isLive: true });

    const metrics = {
      totalLiveStreams: livePrograms.length,
      totalListeners: livePrograms.reduce(
        (sum, program) => sum + program.currentListeners,
        0,
      ),
      streamDetails: livePrograms.map((program) => ({
        id: program._id,
        title: program.title,
        listeners: program.currentListeners,
        uptime: program.scheduleStartTime
          ? Math.floor(
              (new Date() - new Date(program.scheduleStartTime)) / 1000 / 60,
            ) // minutes
          : 0,
      })),
    };

    res.json({
      message: "Stream health metrics retrieved",
      metrics,
    });
  } catch (error) {
    console.error("Get stream health metrics error:", error);
    res.status(500).json({
      message: "Server error fetching stream health metrics",
      error: error.message,
    });
  }
};

/**
 * Increment listener count
 * POST /api/streaming/:programId/join
 */
export const joinStream = async (req, res) => {
  try {
    const { programId } = req.params;

    const program = await Program.findByIdAndUpdate(
      programId,
      {
        $inc: { currentListeners: 1, totalListeners: 1 },
      },
      { new: true },
    );

    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    // Emit real-time update
    if (req.io) {
      req.io.emit("listener-joined", {
        programId,
        currentListeners: program.currentListeners,
      });
    }

    res.json({
      message: "Joined stream",
      listenerCount: program.currentListeners,
    });
  } catch (error) {
    console.error("Join stream error:", error);
    res.status(500).json({
      message: "Server error joining stream",
      error: error.message,
    });
  }
};

/**
 * Decrement listener count
 * POST /api/streaming/:programId/leave
 */
export const leaveStream = async (req, res) => {
  try {
    const { programId } = req.params;

    const program = await Program.findByIdAndUpdate(
      programId,
      {
        $inc: { currentListeners: -1 },
      },
      { new: true },
    );

    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    // Ensure listeners don't go below 0
    if (program.currentListeners < 0) {
      program.currentListeners = 0;
      await program.save();
    }

    // Emit real-time update
    if (req.io) {
      req.io.emit("listener-left", {
        programId,
        currentListeners: program.currentListeners,
      });
    }

    res.json({
      message: "Left stream",
      listenerCount: program.currentListeners,
    });
  } catch (error) {
    console.error("Leave stream error:", error);
    res.status(500).json({
      message: "Server error leaving stream",
      error: error.message,
    });
  }
};
