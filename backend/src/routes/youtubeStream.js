import express from "express";
import {
  createYoutubeStream,
  getYoutubeStreams,
  getYoutubeStreamById,
  getYoutubeStreamAnalytics,
  syncYoutubeStreamNow,
  updateYoutubeStream,
  deleteYoutubeStream,
} from "../controllers/youtubeStreamController.js";
// Phase 2: dashboard "Go Live" via OAuth + YouTube Live Streaming API
import {
  startYoutubeAuth,
  youtubeAuthCallback,
  goLive,
  connectionStatus,
} from "../controllers/youtubeBroadcastController.js";
// Aggregate (platform-wide) YouTube analytics + PDF report
import {
  getYoutubeDashboard,
  getYoutubeTrends,
  generateYoutubePDFReport,
} from "../controllers/youtubeInsightController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — OAuth + Go Live
// IMPORTANT: these literal routes are declared BEFORE "/:id" so that paths like
// "/auth" and "/connection" are not captured as an :id param.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route GET /api/youtube/auth
 * @desc  Return the Google OAuth consent URL (frontend redirects to it)
 * @access Private
 */
router.get("/auth", protect, startYoutubeAuth);

/**
 * @route GET /api/youtube/callback
 * @desc  Google OAuth redirect target — stores tokens, bounces to dashboard
 * @access Public (Google calls this)
 */
router.get("/callback", youtubeAuthCallback);

/**
 * @route GET /api/youtube/connection
 * @desc  Whether the current user has connected their Google/YouTube account
 * @access Private
 */
router.get("/connection", protect, connectionStatus);

/**
 * @route POST /api/youtube/go-live
 * @desc  Create a YouTube live broadcast + RTMP stream, bind, start monitoring
 * @access Private/Admin
 * @body  { title, description?, scheduledStartTime? }
 */
router.post("/go-live", protect, authorize("admin"), goLive);

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGATE INSIGHTS — platform-wide YouTube analytics for the admin
// /dashboard/youtube-analysis-insight page. Declared BEFORE "/:id" so the
// "insights" literal segment is not captured as a stream :id.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route GET /api/youtube/insights/dashboard
 * @desc  Aggregated analytics across all YouTube streams
 * @access Private/Admin
 */
router.get(
  "/insights/dashboard",
  protect,
  authorize("admin"),
  getYoutubeDashboard,
);

/**
 * @route GET /api/youtube/insights/trends
 * @desc  Daily chat/sentiment trends across all YouTube streams
 * @access Private/Admin
 */
router.get("/insights/trends", protect, authorize("admin"), getYoutubeTrends);

/**
 * @route GET /api/youtube/insights/report/pdf
 * @desc  Downloadable PDF report of the YouTube analytics overview
 * @access Private/Admin
 */
router.get(
  "/insights/report/pdf",
  protect,
  authorize("admin"),
  generateYoutubePDFReport,
);

// ── Public reads (frontend watch page: embed + live analytics) ───────────────

/**
 * @route GET /api/youtube
 * @desc  List monitored YouTube streams (?status=live|upcoming|ended)
 * @access Public
 */
router.get("/", getYoutubeStreams);

/**
 * @route GET /api/youtube/:id
 * @desc  Single stream + analytics + recent chats (unified response)
 * @access Public
 */
router.get("/:id", getYoutubeStreamById);

/**
 * @route GET /api/youtube/:id/analytics
 * @desc  Engagement analytics only
 * @access Public
 */
router.get("/:id/analytics", getYoutubeStreamAnalytics);

// ── Admin: create / update / delete / manual sync ────────────────────────────

/**
 * @route POST /api/youtube
 * @desc  Start monitoring a YouTube URL
 * @access Private/Admin
 * @body  { youtubeUrl, linkedProgram? }
 */
router.post("/", protect, authorize("admin"), createYoutubeStream);

/**
 * @route POST /api/youtube/:id/sync
 * @desc  Force an immediate stats + chat sync (manual "Refresh")
 * @access Private/Admin
 */
router.post("/:id/sync", protect, authorize("admin"), syncYoutubeStreamNow);

/**
 * @route PUT /api/youtube/:id
 * @desc  Update stream (toggle monitoring, link a program)
 * @access Private/Admin
 */
router.put("/:id", protect, authorize("admin"), updateYoutubeStream);

/**
 * @route DELETE /api/youtube/:id
 * @desc  Stop monitoring + delete stored chat
 * @access Private/Admin
 */
router.delete("/:id", protect, authorize("admin"), deleteYoutubeStream);

export default router;
