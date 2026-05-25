import express from "express";
import {
  createProgram,
  getAllPrograms,
  getProgramById,
  updateProgram,
  setLiveStatus,
  updateListenerCount,
  deleteProgram,
  getFeaturedPrograms,
  searchPrograms,
  addSocialStream,
  removeSocialStream,
  getSocialStreams,
  refreshStreamStats,
} from "../controllers/programController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// ── Public routes ─────────────────────────────────────────────────────────────

router.get("/", getAllPrograms);
router.get("/featured", getFeaturedPrograms);
router.get("/search", searchPrograms);

/**
 * @route  GET /api/programs/:id
 * @desc   Get a single program — socialStreams include live stats
 * @access Public
 */
router.get("/:id", getProgramById);

/**
 * @route  GET /api/programs/:id/social-streams
 * @desc   Get all active social stream URLs + live engagement stats
 *         (likes, comments, shares, views per platform)
 * @access Public (viewers need this to watch)
 */
router.get("/:id/social-streams", getSocialStreams);

// ── Admin/Staff routes ────────────────────────────────────────────────────────

router.post("/", protect, authorize("admin"), createProgram);
router.put("/:id", protect, authorize("admin"), updateProgram);
router.patch("/:id/live", protect, authorize("admin"), setLiveStatus);
router.patch(
  "/:id/listeners",
  protect,
  authorize("admin"),
  updateListenerCount,
);
router.delete("/:id", protect, authorize("admin"), deleteProgram);

/**
 * @route  POST /api/programs/:id/social-streams
 * @desc   Add or replace a single social stream (by platform) on a program.
 *         Response includes freshly fetched stats for the new stream.
 * @access Private/Admin
 * @body   { platform: "youtube"|"facebook"|"instagram"|"tiktok", url, label?, isActive? }
 */
router.post(
  "/:id/social-streams",
  protect,
  authorize("admin"),
  addSocialStream,
);

/**
 * @route  DELETE /api/programs/:id/social-streams/:platform
 * @desc   Remove a social stream by platform
 * @access Private/Admin
 */
router.delete(
  "/:id/social-streams/:platform",
  protect,
  authorize("admin"),
  removeSocialStream,
);

/**
 * @route  POST /api/programs/:id/social-streams/:platform/refresh-stats
 * @desc   Force-refresh engagement stats for one platform, bypassing the cache.
 *         Use this for a manual "Refresh" button in the admin dashboard.
 * @access Private/Admin
 * @returns { platform, stats: { likes, comments, shares, views, fetchedAt } }
 */
router.post(
  "/:id/social-streams/:platform/refresh-stats",
  protect,
  authorize("admin"),
  refreshStreamStats,
);

export default router;
