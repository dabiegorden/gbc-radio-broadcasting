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
} from "../controllers/programController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route GET /api/programs
 * @desc Get all programs
 * @access Public
 */
router.get("/", getAllPrograms);

/**
 * @route GET /api/programs/featured
 * @desc Get featured programs
 * @access Public
 */
router.get("/featured", getFeaturedPrograms);

/**
 * @route GET /api/programs/search
 * @desc Search programs
 * @access Public
 */
router.get("/search", searchPrograms);

/**
 * @route GET /api/programs/:id
 * @desc Get single program
 * @access Public
 */
router.get("/:id", getProgramById);

/**
 * @route POST /api/programs
 * @desc Create new program
 * @access Private/Staff
 */
router.post("/", protect, authorize("admin"), createProgram);

/**
 * @route PUT /api/programs/:id
 * @desc Update program
 * @access Private/Staff
 */
router.put("/:id", protect, authorize("admin"), updateProgram);

/**
 * @route PATCH /api/programs/:id/live
 * @desc Set program live status
 * @access Private/Staff
 */
router.patch("/:id/live", protect, authorize("admin"), setLiveStatus);

/**
 * @route PATCH /api/programs/:id/listeners
 * @desc Update listener count
 * @access Private/Staff
 */
router.patch(
  "/:id/listeners",
  protect,
  authorize("admin"),
  updateListenerCount,
);

/**
 * @route DELETE /api/programs/:id
 * @desc Delete program
 * @access Private/Admin
 */
router.delete("/:id", protect, authorize("admin"), deleteProgram);

export default router;
