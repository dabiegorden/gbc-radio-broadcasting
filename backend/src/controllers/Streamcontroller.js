import { StreamClient } from "@stream-io/node-sdk";
import { v2 as cloudinary } from "cloudinary";
import { v4 as uuidv4 } from "uuid";
import LiveSession from "../models/LiveSession.js";
import User from "../models/User.js";

/**
 * Stream Controller  (v2 — program-independent)
 * ──────────────────────────────────────────────
 * Handles GetStream Video livestreaming without requiring a Program document.
 * Every broadcast creates / updates a LiveSession record in MongoDB.
 * When a session ends the GetStream recording is uploaded to Cloudinary so
 * viewers can watch the replay via a permanent URL.
 *
 * ENV vars required:
 *   STREAM_API_KEY        — your GetStream app key
 *   STREAM_API_SECRET     — your GetStream app secret
 *   CLOUDINARY_CLOUD_NAME — Cloudinary cloud name
 *   CLOUDINARY_API_KEY    — Cloudinary API key
 *   CLOUDINARY_API_SECRET — Cloudinary API secret
 */

// ─── Cloudinary config ────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Lazy-initialised GetStream client ───────────────────────────────────────
let _streamClient = null;
const getStreamClient = () => {
  if (_streamClient) return _streamClient;
  const { STREAM_API_KEY, STREAM_API_SECRET } = process.env;
  if (!STREAM_API_KEY || !STREAM_API_SECRET) {
    throw new Error("STREAM_API_KEY and STREAM_API_SECRET must be set in .env");
  }
  _streamClient = new StreamClient(STREAM_API_KEY, STREAM_API_SECRET);
  return _streamClient;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const buildStreamUserId = (user) =>
  `user-${user._id.toString().replace(/[^a-zA-Z0-9_-]/g, "")}`;

/**
 * Upload a video URL to Cloudinary under the `live-sessions/` folder.
 * Returns the Cloudinary upload result (publicId, secure_url, bytes …).
 */
const uploadRecordingToCloudinary = async (videoUrl, sessionId) => {
  const result = await cloudinary.uploader.upload(videoUrl, {
    resource_type: "video",
    folder: "live-sessions",
    public_id: `session-${sessionId}`,
    overwrite: true,
    // Eager transformation — generate an HLS stream + a thumbnail
    eager: [
      { streaming_profile: "hd", format: "m3u8" }, // HLS
      { width: 1280, height: 720, crop: "limit", format: "mp4" }, // fallback mp4
    ],
    eager_async: false,
    // Generate a poster/thumbnail at 5 s
    transformation: [{ start_offset: "5", crop: "limit" }],
  });
  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/stream/token
// Generate a GetStream token for the currently authenticated user.
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

    await client.upsertUsers([
      {
        id: streamUserId,
        name: displayName,
        role: user.role === "admin" ? "admin" : "user",
        custom: { mongoId: user._id.toString(), email: user.email },
      },
    ]);

    const expiresAt = Math.floor(Date.now() / 1000) + 6 * 60 * 60; // 6 h
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
// POST /api/stream/session/start
// Create a new LiveSession + GetStream call.  No Program required.
// Body (all optional): { title, description, tags, coverImage, linkedProgram }
// ─────────────────────────────────────────────────────────────────────────────
export const startSession = async (req, res) => {
  try {
    const client = getStreamClient();
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const {
      title = "Live Broadcast",
      description = "",
      tags = [],
      coverImage = null,
      linkedProgram = null,
    } = req.body;

    const streamUserId = buildStreamUserId(user);
    const callId = `session-${uuidv4()}`;

    // Create the call on GetStream
    await client.video.getOrCreateCall({
      type: "livestream",
      id: callId,
      data: {
        created_by_id: streamUserId,
        members: [{ user_id: streamUserId, role: "host" }],
        custom: { title, hostedBy: user._id.toString() },
        settings_override: {
          recording: { mode: "auto-on", quality: "1080p" },
          backstage: { enabled: false },
        },
      },
    });

    // Persist a LiveSession document
    const session = await LiveSession.create({
      title,
      description,
      hostedBy: user._id,
      hostDisplayName: `${user.firstName} ${user.lastName}`.trim(),
      streamCallId: callId,
      streamCallType: "livestream",
      status: "live",
      startedAt: new Date(),
      tags,
      coverImage,
      linkedProgram: linkedProgram || null,
    });

    // Emit real-time event if Socket.IO is available
    if (req.io) {
      req.io.emit("session-started", {
        sessionId: session._id,
        callId,
        title,
        host: session.hostDisplayName,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Live session started",
      session: {
        _id: session._id,
        title: session.title,
        callId,
        callType: "livestream",
        status: session.status,
        startedAt: session.startedAt,
      },
      stream: {
        callId,
        callType: "livestream",
        apiKey: process.env.STREAM_API_KEY,
      },
    });
  } catch (error) {
    console.error("startSession error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to start session",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/stream/session/:sessionId/end
// End a live session: leave the GetStream call, fetch the recording,
// upload it to Cloudinary, and update the LiveSession document.
// ─────────────────────────────────────────────────────────────────────────────
export const endSession = async (req, res) => {
  try {
    const client = getStreamClient();
    const { sessionId } = req.params;

    const session = await LiveSession.findById(sessionId);
    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });
    }

    const endedAt = new Date();
    const durationSeconds = session.startedAt
      ? Math.floor((endedAt - new Date(session.startedAt)) / 1000)
      : null;

    // Tell GetStream to end the call (triggers recording finalisation)
    try {
      const call = client.video.call(
        session.streamCallType,
        session.streamCallId,
      );
      await call.end();
    } catch (streamErr) {
      console.warn("GetStream end call warning:", streamErr.message);
    }

    // Mark session as ended while recording processes
    session.status = "processing";
    session.endedAt = endedAt;
    session.durationSeconds = durationSeconds;
    await session.save();

    // Emit real-time event
    if (req.io) {
      req.io.emit("session-ended", {
        sessionId: session._id,
        callId: session.streamCallId,
        title: session.title,
      });
    }

    // Attempt to fetch & upload recording (async — may not be ready immediately)
    // We do this in the background and update the session document when done.
    uploadSessionRecording(client, session).catch((err) =>
      console.error("Background recording upload error:", err),
    );

    return res.json({
      success: true,
      message: "Session ended. Recording will be available shortly.",
      session: {
        _id: session._id,
        title: session.title,
        status: session.status,
        endedAt: session.endedAt,
        durationSeconds: session.durationSeconds,
      },
    });
  } catch (error) {
    console.error("endSession error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to end session",
      error: error.message,
    });
  }
};

/**
 * Background job: poll GetStream for the recording, upload to Cloudinary,
 * update LiveSession.
 */
const uploadSessionRecording = async (client, session) => {
  const MAX_ATTEMPTS = 10;
  const POLL_INTERVAL_MS = 30_000; // 30 s

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await new Promise((r) =>
        setTimeout(r, attempt === 1 ? 15_000 : POLL_INTERVAL_MS),
      );

      const call = client.video.call(
        session.streamCallType,
        session.streamCallId,
      );
      const { recordings = [] } = await call.listRecordings();

      if (recordings.length === 0) {
        console.log(
          `Recording not ready yet (attempt ${attempt}/${MAX_ATTEMPTS})`,
        );
        continue;
      }

      // Take the most recent recording
      const latest = recordings[recordings.length - 1];
      const rawUrl = latest.url;

      console.log(
        `Uploading recording to Cloudinary for session ${session._id}…`,
      );
      const cldResult = await uploadRecordingToCloudinary(
        rawUrl,
        session._id.toString(),
      );

      // Build playback URL — prefer HLS eager, fall back to secure_url
      const hlsEager = cldResult.eager?.find((e) => e.format === "m3u8");
      const playbackUrl = hlsEager?.secure_url || cldResult.secure_url;

      // Thumbnail: replace extension with .jpg
      const thumbnailUrl = cloudinary.url(cldResult.public_id, {
        resource_type: "video",
        format: "jpg",
        start_offset: "5",
        width: 640,
        height: 360,
        crop: "limit",
      });

      await LiveSession.findByIdAndUpdate(session._id, {
        status: "available",
        rawRecordingUrl: rawUrl,
        "cloudinary.publicId": cldResult.public_id,
        "cloudinary.playbackUrl": playbackUrl,
        "cloudinary.thumbnailUrl": thumbnailUrl,
        "cloudinary.bytes": cldResult.bytes,
        "cloudinary.uploadedAt": new Date(),
      });

      console.log(
        `✓ Recording available for session ${session._id}: ${playbackUrl}`,
      );
      return; // Done
    } catch (err) {
      console.error(`Recording upload attempt ${attempt} failed:`, err.message);
    }
  }

  // If we never succeeded, mark the session so the admin knows
  await LiveSession.findByIdAndUpdate(session._id, { status: "ended" });
  console.warn(
    `Could not upload recording for session ${session._id} after ${MAX_ATTEMPTS} attempts`,
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stream/session/:sessionId
// Public — returns session info + playback URL if available.
// ─────────────────────────────────────────────────────────────────────────────
export const getSession = async (req, res) => {
  try {
    const session = await LiveSession.findById(req.params.sessionId).populate(
      "hostedBy",
      "firstName lastName email",
    );
    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });
    }

    return res.json({ success: true, session });
  } catch (error) {
    console.error("getSession error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch session",
        error: error.message,
      });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stream/sessions
// List sessions — supports ?status=live|available|ended&page=1&limit=20
// ─────────────────────────────────────────────────────────────────────────────
export const listSessions = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;

    const sessions = await LiveSession.find(query)
      .sort({ startedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("hostedBy", "firstName lastName");

    const total = await LiveSession.countDocuments(query);

    return res.json({
      success: true,
      sessions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("listSessions error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to list sessions",
        error: error.message,
      });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stream/sessions/live
// Returns only currently live sessions (public — for viewers).
// ─────────────────────────────────────────────────────────────────────────────
export const getLiveSessions = async (req, res) => {
  try {
    const sessions = await LiveSession.find({ status: "live" })
      .sort({ startedAt: -1 })
      .populate("hostedBy", "firstName lastName");

    return res.json({
      success: true,
      sessions,
      count: sessions.length,
      apiKey: process.env.STREAM_API_KEY,
    });
  } catch (error) {
    console.error("getLiveSessions error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch live sessions",
        error: error.message,
      });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stream/sessions/recordings
// Returns past sessions that have a Cloudinary playback URL.
// ─────────────────────────────────────────────────────────────────────────────
export const getPastRecordings = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const sessions = await LiveSession.find({ status: "available" })
      .sort({ endedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("hostedBy", "firstName lastName");

    const total = await LiveSession.countDocuments({ status: "available" });

    return res.json({
      success: true,
      recordings: sessions.map((s) => ({
        _id: s._id,
        title: s.title,
        description: s.description,
        host: s.hostDisplayName,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        durationSeconds: s.durationSeconds,
        playbackUrl: s.cloudinary.playbackUrl,
        thumbnailUrl: s.cloudinary.thumbnailUrl,
        tags: s.tags,
        coverImage: s.coverImage,
        linkedProgram: s.linkedProgram,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getPastRecordings error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch recordings",
        error: error.message,
      });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/stream/token  (kept for backwards compat — same as before)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Legacy program-based helpers (kept so existing routes don't break) ───────

export const createOrGetCall = async (req, res) => {
  return res.status(410).json({
    success: false,
    message:
      "This endpoint is deprecated. Use POST /api/stream/session/start instead.",
  });
};

export const getCallInfo = async (req, res) => {
  return res.status(410).json({
    success: false,
    message:
      "This endpoint is deprecated. Use GET /api/stream/session/:sessionId instead.",
  });
};

export const endCall = async (req, res) => {
  return res.status(410).json({
    success: false,
    message:
      "This endpoint is deprecated. Use POST /api/stream/session/:sessionId/end instead.",
  });
};

export const getRecordings = async (req, res) => {
  return res.status(410).json({
    success: false,
    message:
      "This endpoint is deprecated. Use GET /api/stream/sessions/recordings instead.",
  });
};

export const getAllRecordings = async (req, res) => {
  return res.status(410).json({
    success: false,
    message:
      "This endpoint is deprecated. Use GET /api/stream/sessions/recordings instead.",
  });
};

export default {
  generateStreamToken,
  startSession,
  endSession,
  getSession,
  listSessions,
  getLiveSessions,
  getPastRecordings,
  // legacy stubs
  createOrGetCall,
  getCallInfo,
  endCall,
  getRecordings,
  getAllRecordings,
};
