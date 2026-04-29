import { StreamClient } from "@stream-io/node-sdk";
import Program from "../models/Program.js";
import User from "../models/User.js";

/**
 * Stream Controller
 * Handles GetStream Video livestreaming — token generation, call management,
 * recording retrieval, and call cleanup.
 *
 * All routes are protected by your existing auth middleware.
 *
 * ENV vars required:
 *   STREAM_API_KEY   — your GetStream app key
 *   STREAM_API_SECRET — your GetStream app secret
 */

// ─── Lazy-initialised client ──────────────────────────────────────────────────
let _streamClient = null;

const getStreamClient = () => {
  if (_streamClient) return _streamClient;

  const { STREAM_API_KEY, STREAM_API_SECRET } = process.env;

  if (!STREAM_API_KEY || !STREAM_API_SECRET) {
    throw new Error(
      "STREAM_API_KEY and STREAM_API_SECRET must be set in your .env",
    );
  }

  _streamClient = new StreamClient(STREAM_API_KEY, STREAM_API_SECRET);
  return _streamClient;
};

// ─── Helper: build a stable call-id from a program ───────────────────────────
const buildCallId = (programId) => `radio-program-${programId}`;

// ─── Helper: build a GetStream user id from a MongoDB user ───────────────────
const buildStreamUserId = (user) =>
  `user-${user._id.toString().replace(/[^a-zA-Z0-9_-]/g, "")}`;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/stream/token
// Generate a GetStream token for the currently authenticated user.
// Called by both the presenter (admin) and audience members.
// ─────────────────────────────────────────────────────────────────────────────
export const generateStreamToken = async (req, res) => {
  try {
    const client = getStreamClient();
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const streamUserId = buildStreamUserId(user);
    const displayName = `${user.firstName} ${user.lastName}`.trim();

    // Upsert the user on GetStream's side so their profile is up-to-date
    await client.upsertUsers([
      {
        id: streamUserId,
        name: displayName,
        role: user.role === "admin" ? "admin" : "user",
        custom: {
          mongoId: user._id.toString(),
          email: user.email,
        },
      },
    ]);

    // Token valid for 6 hours — enough for a broadcast session
    const expiresAt = Math.floor(Date.now() / 1000) + 6 * 60 * 60;
    const token = client.generateUserToken({
      user_id: streamUserId,
      exp: expiresAt,
    });

    return res.json({
      success: true,
      token,
      streamUserId,
      displayName,
      apiKey: process.env.STREAM_API_KEY,
      expiresAt,
    });
  } catch (error) {
    console.error("generateStreamToken error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate stream token",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/stream/call/:programId
// Create (or fetch) a livestream call tied to a Program document.
// Admin only. Marks the program as live in MongoDB.
// ─────────────────────────────────────────────────────────────────────────────
export const createOrGetCall = async (req, res) => {
  try {
    const client = getStreamClient();
    const { programId } = req.params;

    const program = await Program.findById(programId);
    if (!program) {
      return res
        .status(404)
        .json({ success: false, message: "Program not found" });
    }

    const callId = buildCallId(programId);
    const presenterStreamId = buildStreamUserId(req.user);

    // Create the call on GetStream — idempotent, safe to call repeatedly
    const callResponse = await client.video.getOrCreateCall({
      type: "livestream",
      id: callId,
      data: {
        created_by_id: presenterStreamId,
        members: [{ user_id: presenterStreamId, role: "host" }],
        custom: {
          programId: programId,
          programTitle: program.title,
          programHost: program.host,
          programCategory: program.category,
        },
        settings_override: {
          recording: {
            mode: "auto-on", // record every session automatically
            quality: "1080p",
          },
          backstage: {
            enabled: false, // go live immediately on join
          },
        },
      },
    });

    // Mark the program as live in your DB
    program.isLive = true;
    program.status = "live";
    program.updatedAt = new Date();
    await program.save();

    return res.json({
      success: true,
      message: "Livestream call ready",
      call: {
        callId,
        callType: "livestream",
        programId,
        programTitle: program.title,
      },
      streamData: callResponse,
    });
  } catch (error) {
    console.error("createOrGetCall error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create livestream call",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stream/call/:programId
// Lightweight — just returns the call metadata so the audience page can join.
// ─────────────────────────────────────────────────────────────────────────────
export const getCallInfo = async (req, res) => {
  try {
    const { programId } = req.params;

    const program = await Program.findById(programId);
    if (!program) {
      return res
        .status(404)
        .json({ success: false, message: "Program not found" });
    }

    return res.json({
      success: true,
      call: {
        callId: buildCallId(programId),
        callType: "livestream",
        programId,
        programTitle: program.title,
        programHost: program.host,
        programCategory: program.category,
        isLive: program.isLive,
        currentListeners: program.currentListeners,
        apiKey: process.env.STREAM_API_KEY,
      },
    });
  } catch (error) {
    console.error("getCallInfo error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get call info",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/stream/call/:programId/end
// Admin ends the broadcast. Marks the program offline in MongoDB.
// ─────────────────────────────────────────────────────────────────────────────
export const endCall = async (req, res) => {
  try {
    const client = getStreamClient();
    const { programId } = req.params;

    const program = await Program.findById(programId);
    if (!program) {
      return res
        .status(404)
        .json({ success: false, message: "Program not found" });
    }

    const callId = buildCallId(programId);

    // Tell GetStream to end the call — this also triggers recording finalisation
    try {
      const call = client.video.call("livestream", callId);
      await call.end();
    } catch (streamErr) {
      // If the call doesn't exist on GetStream it's already ended — that's fine
      console.warn("GetStream end call warning:", streamErr.message);
    }

    // Update MongoDB
    program.isLive = false;
    program.status =
      new Date() > new Date(program.scheduleEndTime)
        ? "completed"
        : "scheduled";
    program.updatedAt = new Date();
    await program.save();

    return res.json({
      success: true,
      message: "Livestream ended successfully",
      program,
    });
  } catch (error) {
    console.error("endCall error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to end call",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stream/recordings/:programId
// Returns the list of recordings for a program so audiences can watch replays.
// ─────────────────────────────────────────────────────────────────────────────
export const getRecordings = async (req, res) => {
  try {
    const client = getStreamClient();
    const { programId } = req.params;

    const program = await Program.findById(programId);
    if (!program) {
      return res
        .status(404)
        .json({ success: false, message: "Program not found" });
    }

    const callId = buildCallId(programId);

    let recordings = [];
    try {
      const call = client.video.call("livestream", callId);
      const response = await call.listRecordings();
      recordings = response.recordings || [];
    } catch (streamErr) {
      // Call may not exist yet if it was never started
      console.warn("No recordings found:", streamErr.message);
    }

    return res.json({
      success: true,
      programId,
      programTitle: program.title,
      recordings: recordings.map((r) => ({
        filename: r.filename,
        url: r.url,
        startTime: r.start_time,
        endTime: r.end_time,
        duration:
          r.end_time && r.start_time
            ? Math.round(
                (new Date(r.end_time) - new Date(r.start_time)) / 1000 / 60,
              )
            : null,
      })),
      total: recordings.length,
    });
  } catch (error) {
    console.error("getRecordings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch recordings",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stream/recordings  (no programId — all programs)
// Aggregate recordings across every program — useful for an admin dashboard.
// ─────────────────────────────────────────────────────────────────────────────
export const getAllRecordings = async (req, res) => {
  try {
    const client = getStreamClient();
    const { page = 1, limit = 20 } = req.query;

    // Fetch programs that have ever been live
    const programs = await Program.find({
      $or: [{ status: "completed" }, { isLive: true }],
    })
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const results = await Promise.all(
      programs.map(async (program) => {
        const callId = buildCallId(program._id.toString());
        try {
          const call = client.video.call("livestream", callId);
          const response = await call.listRecordings();
          return {
            programId: program._id,
            programTitle: program.title,
            programHost: program.host,
            programCategory: program.category,
            recordings: (response.recordings || []).map((r) => ({
              filename: r.filename,
              url: r.url,
              startTime: r.start_time,
              endTime: r.end_time,
            })),
          };
        } catch {
          return {
            programId: program._id,
            programTitle: program.title,
            programHost: program.host,
            programCategory: program.category,
            recordings: [],
          };
        }
      }),
    );

    return res.json({
      success: true,
      data: results.filter((r) => r.recordings.length > 0),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: programs.length,
      },
    });
  } catch (error) {
    console.error("getAllRecordings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch all recordings",
      error: error.message,
    });
  }
};

export default {
  generateStreamToken,
  createOrGetCall,
  getCallInfo,
  endCall,
  getRecordings,
  getAllRecordings,
};
