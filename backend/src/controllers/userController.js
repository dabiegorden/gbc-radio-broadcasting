import User from "../models/User.js";
import bcryptjs from "bcryptjs";

/**
 * User Controller
 * Handles user profile and management operations
 */

/**
 * Get all users (admin only)
 * GET /api/users
 */
export const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      isActive,
      search,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    // Build filter object
    const filter = {};

    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === "desc" ? -1 : 1;

    // Get users with pagination
    const users = await User.find(filter)
      .select("-password")
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await User.countDocuments(filter);

    // Emit WebSocket event for real-time updates
    if (req.io) {
      req.io.emit("users-fetched", {
        count: users.length,
        total,
      });
    }

    res.json({
      success: true,
      data: users,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching users",
      error: error.message,
    });
  }
};

/**
 * Get user by ID
 * GET /api/users/:id
 */
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Get user by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching user",
      error: error.message,
    });
  }
};

/**
 * Create new user (admin only)
 * POST /api/users
 */
export const createUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, profileImage } =
      req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // Hash password
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: role || "users",
      profileImage: profileImage || "",
      isActive: true,
    });

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    // Emit WebSocket event
    if (req.io) {
      req.io.emit("user-created", {
        user: userResponse,
        message: `New user "${firstName} ${lastName}" has been created`,
      });
    }

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: userResponse,
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(400).json({
      success: false,
      message: "Error creating user",
      error: error.message,
    });
  }
};

/**
 * Update user
 * PUT /api/users/:id
 */
export const updateUser = async (req, res) => {
  try {
    const { firstName, lastName, email, role, profileImage, isActive } =
      req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) {
      // Check if email is already taken by another user
      const existingUser = await User.findOne({
        email,
        _id: { $ne: req.params.id },
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already in use",
        });
      }
      user.email = email;
    }
    if (role) user.role = role;
    if (profileImage !== undefined) user.profileImage = profileImage;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    // Emit WebSocket event
    if (req.io) {
      req.io.emit("user-updated", {
        user: userResponse,
        message: `User "${user.firstName} ${user.lastName}" has been updated`,
      });
    }

    res.json({
      success: true,
      message: "User updated successfully",
      data: userResponse,
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(400).json({
      success: false,
      message: "Error updating user",
      error: error.message,
    });
  }
};

/**
 * Delete user
 * DELETE /api/users/:id
 */
export const deleteUser = async (req, res) => {
  try {
    // Prevent deleting self
    if (req.user.id === req.params.id) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete your own account",
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await user.deleteOne();

    // Emit WebSocket event
    if (req.io) {
      req.io.emit("user-deleted", {
        userId: req.params.id,
        message: `User "${user.firstName} ${user.lastName}" has been deleted`,
      });
    }

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message,
    });
  }
};

/**
 * Toggle user active status
 * PATCH /api/users/:id/toggle-active
 */
export const toggleActiveStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    // Emit WebSocket event
    if (req.io) {
      req.io.emit("user-status-changed", {
        userId: user._id,
        isActive: user.isActive,
        message: `User "${user.firstName} ${user.lastName}" has been ${user.isActive ? "activated" : "deactivated"}`,
      });
    }

    res.json({
      success: true,
      message: `User ${user.isActive ? "activated" : "deactivated"} successfully`,
      data: userResponse,
    });
  } catch (error) {
    console.error("Toggle active status error:", error);
    res.status(500).json({
      success: false,
      message: "Error toggling user status",
      error: error.message,
    });
  }
};

/**
 * Get user statistics
 * GET /api/users/stats
 */
export const getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const inactiveUsers = await User.countDocuments({ isActive: false });
    const adminUsers = await User.countDocuments({ role: "admin" });
    const regularUsers = await User.countDocuments({ role: "users" });

    // Recent users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentUsers = await User.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
    });

    res.json({
      success: true,
      data: {
        total: totalUsers,
        active: activeUsers,
        inactive: inactiveUsers,
        admins: adminUsers,
        users: regularUsers,
        recentUsers,
      },
    });
  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user statistics",
      error: error.message,
    });
  }
};

export default {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleActiveStatus,
  getUserStats,
};
