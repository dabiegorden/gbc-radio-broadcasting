import express from "express";
import {
  getDashboardAnalytics,
  getProgramAnalytics,
  getEngagementTrends,
  generatePDFReport,
  saveAnalyticsReport,
  getSavedReports,
} from "../controllers/analyticsController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route GET /api/analytics/dashboard
 * @desc Get dashboard analytics overview
 * @access Private/Admin
 */
router.get("/dashboard", protect, authorize("admin"), getDashboardAnalytics);

/**
 * @route GET /api/analytics/trends
 * @desc Get engagement trends
 * @access Private/Admin
 */
router.get("/trends", protect, authorize("admin"), getEngagementTrends);

/**
 * @route GET /api/analytics/report/pdf
 * @desc Generate and download PDF report
 * @access Private/Admin
 */
router.get("/report/pdf", protect, authorize("admin"), generatePDFReport);

/**
 * @route GET /api/analytics/reports
 * @desc Get saved analytics reports
 * @access Private/Admin
 */
router.get("/reports", protect, authorize("admin"), getSavedReports);

/**
 * @route GET /api/analytics/program/:programId
 * @desc Get analytics for a specific program
 * @access Public
 */
router.get("/program/:programId", getProgramAnalytics);

/**
 * @route POST /api/analytics/report
 * @desc Save analytics report
 * @access Private/Admin
 */
router.post("/report", protect, authorize("admin"), saveAnalyticsReport);

export default router;
