import express from "express";
import {
  createEngagement,
  getAllEngagements,
  getEngagementsByProgram,
  getUserEngagements,
  getEngagementStats,
  getEngagementInsights,
  analyzeBatchComments,
  updateEngagement,
  deleteEngagement,
} from "../controllers/engagementController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route GET /api/engagement
 * @desc Get all engagements with filtering
 * @access Private/Admin
 */
router.get("/", protect, authorize("admin"), getAllEngagements);

/**
 * @route POST /api/engagement
 * @desc Create new engagement (comment/like/reaction)
 * @access Private
 */
router.post("/", protect, createEngagement);

/**
 * @route GET /api/engagement/insights
 * @desc Get overall engagement insights
 * @access Private/Admin
 */
router.get("/insights", protect, authorize("admin"), getEngagementInsights);

/**
 * @route GET /api/engagement/program/:programId
 * @desc Get engagements for a program
 * @access Public
 */
router.get("/program/:programId", getEngagementsByProgram);

/**
 * @route GET /api/engagement/user/:userId
 * @desc Get user's engagements
 * @access Private
 */
router.get("/user/:userId", protect, getUserEngagements);

/**
 * @route GET /api/engagement/stats/:programId
 * @desc Get engagement statistics for a program
 * @access Public
 */
router.get("/stats/:programId", getEngagementStats);

/**
 * @route POST /api/engagement/analyze-batch
 * @desc Batch analyze comments with Gemini AI
 * @access Private/Admin
 */
router.post(
  "/analyze-batch",
  protect,
  authorize("admin"),
  analyzeBatchComments,
);

/**
 * @route PUT /api/engagement/:id
 * @desc Update engagement
 * @access Private
 */
router.put("/:id", protect, updateEngagement);

/**
 * @route DELETE /api/engagement/:id
 * @desc Delete engagement
 * @access Private
 */
router.delete("/:id", protect, deleteEngagement);

export default router;
