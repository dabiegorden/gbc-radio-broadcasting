import express from "express";
import {
  generateStreamToken,
  startSession,
  endSession,
  getSession,
  listSessions,
  getLiveSessions,
  getPastRecordings,
} from "../controllers/Streamcontroller.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// ── Token ─────────────────────────────────────────────────────────────────────
/**
 * @route  POST /api/stream/token
 * @desc   Generate a GetStream user token (presenter + audience both need one)
 * @access Private (any authenticated user)
 */
router.post("/token", protect, generateStreamToken);

// ── Session lifecycle (admin / presenter) ─────────────────────────────────────
/**
 * @route  POST /api/stream/session/start
 * @desc   Start a new live session — creates GetStream call + LiveSession doc
 * @access Private/Admin
 * @body   { title?, description?, tags?, coverImage?, linkedProgram? }
 */
router.post("/session/start", protect, authorize("admin"), startSession);

/**
 * @route  POST /api/stream/session/:sessionId/end
 * @desc   End a live session — stops GetStream call, uploads recording to Cloudinary
 * @access Private/Admin
 */
router.post("/session/:sessionId/end", protect, authorize("admin"), endSession);

// ── Session queries ───────────────────────────────────────────────────────────
/**
 * @route  GET /api/stream/sessions/live
 * @desc   Get all currently live sessions (for the audience watch page)
 * @access Public
 */
router.get("/sessions/live", getLiveSessions);

/**
 * @route  GET /api/stream/sessions/recordings
 * @desc   Get past sessions that have a Cloudinary playback URL
 * @access Public
 */
router.get("/sessions/recordings", getPastRecordings);

/**
 * @route  GET /api/stream/sessions
 * @desc   List all sessions (filterable by ?status=live|available|ended)
 * @access Private/Admin
 */
router.get("/sessions", protect, authorize("admin"), listSessions);

/**
 * @route  GET /api/stream/session/:sessionId
 * @desc   Get a single session by ID
 * @access Public
 */
router.get("/session/:sessionId", getSession);

export default router;
