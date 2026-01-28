import express from "express";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleActiveStatus,
  getUserStats,
} from "../controllers/userController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route GET /api/users/stats
 * @desc Get user statistics
 * @access Private/Admin
 */
router.get("/stats", protect, authorize("admin"), getUserStats);

/**
 * @route GET /api/users
 * @desc Get all users with pagination and filters
 * @access Private/Admin
 */
router.get("/", protect, authorize("admin"), getAllUsers);

/**
 * @route GET /api/users/:id
 * @desc Get single user by ID
 * @access Private/Admin
 */
router.get("/:id", protect, authorize("admin"), getUserById);

/**
 * @route POST /api/users
 * @desc Create new user
 * @access Private/Admin
 */
router.post("/", protect, authorize("admin"), createUser);

/**
 * @route PUT /api/users/:id
 * @desc Update user
 * @access Private/Admin
 */
router.put("/:id", protect, authorize("admin"), updateUser);

/**
 * @route DELETE /api/users/:id
 * @desc Delete user
 * @access Private/Admin
 */
router.delete("/:id", protect, authorize("admin"), deleteUser);

/**
 * @route PATCH /api/users/:id/toggle-active
 * @desc Toggle user active status
 * @access Private/Admin
 */
router.patch(
  "/:id/toggle-active",
  protect,
  authorize("admin"),
  toggleActiveStatus,
);

export default router;
