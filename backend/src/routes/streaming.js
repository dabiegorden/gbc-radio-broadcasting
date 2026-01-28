import express from "express";
import {
  getStreamUrl,
  checkStreamStatus,
  updateStreamStatus,
  getLiveStreams,
  getStreamMetadata,
  recordStreamInfo,
  getStreamHealthMetrics,
  joinStream,
  leaveStream,
} from "../controllers/streamingController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route GET /api/streaming/live
 * @desc Get all live streams
 * @access Public
 */
router.get("/live", getLiveStreams);

/**
 * @route GET /api/streaming/health/metrics
 * @desc Get stream health metrics
 */
router.get(
  "/health/metrics",
  protect,
  authorize("admin"),
  getStreamHealthMetrics,
);

/**
 * @route GET /api/streaming/:programId
 * @desc Get stream URL for a program
 * @access Public
 */
router.get("/:programId", getStreamUrl);

/**
 * @route GET /api/streaming/:programId/status
 * @desc Check stream availability/status
 * @access Public
 */
router.get("/:programId/status", checkStreamStatus);

/**
 * @route PATCH /api/streaming/:programId/update-status
 * @desc Update stream status (live/offline)
 */
router.patch(
  "/:programId/update-status",
  protect,
  authorize("admin"),
  updateStreamStatus,
);

/**
 * @route GET /api/streaming/:programId/metadata
 * @desc Get stream metadata
 * @access Public
 */
router.get("/:programId/metadata", getStreamMetadata);

/**
 * @route POST /api/streaming/:programId/record
 * @desc Record stream information
 */
router.post(
  "/:programId/record",
  protect,
  authorize("admin"),
  recordStreamInfo,
);

/**
 * @route POST /api/streaming/:programId/join
 * @desc Increment listener count when user joins
 * @access Public
 */
router.post("/:programId/join", joinStream);

/**
 * @route POST /api/streaming/:programId/leave
 * @desc Decrement listener count when user leaves
 * @access Public
 */
router.post("/:programId/leave", leaveStream);

export default router;
