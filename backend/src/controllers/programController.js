import Program from "../models/Program.js";

/**
 * Program Controller
 * Handles radio program management
 */

/**
 * Create a new program
 * POST /api/programs
 */
export const createProgram = async (req, res) => {
  try {
    const {
      title,
      description,
      host,
      category,
      scheduleStartTime,
      scheduleEndTime,
      isRecurring,
      recurringDays,
      streamingUrl,
      tags,
    } = req.body;

    // Validate required fields
    if (
      !title ||
      !description ||
      !host ||
      !scheduleStartTime ||
      !scheduleEndTime
    ) {
      return res.status(400).json({
        message:
          "Title, description, host, scheduleStartTime, and scheduleEndTime are required",
      });
    }

    // Validate time range
    if (new Date(scheduleEndTime) <= new Date(scheduleStartTime)) {
      return res.status(400).json({
        message: "End time must be after start time",
      });
    }

    const program = new Program({
      title,
      description,
      host,
      category: category || "other",
      scheduleStartTime: new Date(scheduleStartTime),
      scheduleEndTime: new Date(scheduleEndTime),
      isRecurring: isRecurring || false,
      recurringDays: recurringDays || [],
      streamingUrl: streamingUrl || null,
      tags: tags || [],
      status: "scheduled",
      isLive: false,
      currentListeners: 0,
      totalListeners: 0,
      averageEngagementScore: 0,
      createdBy: req.user._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await program.save();

    res.status(201).json({
      message: "Program created successfully",
      program,
    });
  } catch (error) {
    console.error("Create program error:", error);
    res.status(500).json({
      message: "Server error creating program",
      error: error.message,
    });
  }
};

/**
 * Get all programs
 * GET /api/programs
 */
export const getAllPrograms = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      isLive,
      status,
      category,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const skip = (page - 1) * limit;

    let query = {};

    if (isLive !== undefined) {
      query.isLive = isLive === "true";
    }

    if (status) {
      query.status = status;
    }

    if (category) {
      query.category = category;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const programs = await Program.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("createdBy", "name email");

    const total = await Program.countDocuments(query);

    res.json({
      message: "Programs retrieved",
      programs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get programs error:", error);
    res.status(500).json({
      message: "Server error fetching programs",
      error: error.message,
    });
  }
};

/**
 * Get program by ID
 * GET /api/programs/:id
 */
export const getProgramById = async (req, res) => {
  try {
    const { id } = req.params;

    const program = await Program.findById(id).populate(
      "createdBy",
      "name email",
    );

    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    res.json({
      message: "Program retrieved",
      program,
    });
  } catch (error) {
    console.error("Get program error:", error);
    res.status(500).json({
      message: "Server error fetching program",
      error: error.message,
    });
  }
};

/**
 * Update program
 * PUT /api/programs/:id
 */
export const updateProgram = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      host,
      category,
      scheduleStartTime,
      scheduleEndTime,
      isRecurring,
      recurringDays,
      streamingUrl,
      tags,
      status,
    } = req.body;

    const program = await Program.findById(id);

    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    // Validate time range if both times are provided
    if (scheduleStartTime && scheduleEndTime) {
      if (new Date(scheduleEndTime) <= new Date(scheduleStartTime)) {
        return res.status(400).json({
          message: "End time must be after start time",
        });
      }
    }

    // Update fields
    if (title) program.title = title;
    if (description) program.description = description;
    if (host) program.host = host;
    if (category) program.category = category;
    if (scheduleStartTime)
      program.scheduleStartTime = new Date(scheduleStartTime);
    if (scheduleEndTime) program.scheduleEndTime = new Date(scheduleEndTime);
    if (isRecurring !== undefined) program.isRecurring = isRecurring;
    if (recurringDays) program.recurringDays = recurringDays;
    if (streamingUrl !== undefined) program.streamingUrl = streamingUrl;
    if (tags) program.tags = tags;
    if (status) program.status = status;

    program.updatedAt = new Date();

    await program.save();

    res.json({
      message: "Program updated successfully",
      program,
    });
  } catch (error) {
    console.error("Update program error:", error);
    res.status(500).json({
      message: "Server error updating program",
      error: error.message,
    });
  }
};

/**
 * Set program live status
 * PATCH /api/programs/:id/live
 */
export const setLiveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isLive } = req.body;

    const updateData = {
      isLive,
      updatedAt: new Date(),
    };

    // Update status based on live state
    if (isLive) {
      updateData.status = "live";
    } else {
      // Check if program should be completed based on end time
      const program = await Program.findById(id);
      if (program && new Date() > new Date(program.scheduleEndTime)) {
        updateData.status = "completed";
      } else {
        updateData.status = "scheduled";
      }
    }

    const program = await Program.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    res.json({
      message: `Program is now ${isLive ? "live" : "offline"}`,
      program,
    });
  } catch (error) {
    console.error("Set live status error:", error);
    res.status(500).json({
      message: "Server error updating live status",
      error: error.message,
    });
  }
};

/**
 * Update listener count
 * PATCH /api/programs/:id/listeners
 */
export const updateListenerCount = async (req, res) => {
  try {
    const { id } = req.params;
    const { count } = req.body;

    if (typeof count !== "number") {
      return res.status(400).json({
        message: "count must be a number",
      });
    }

    const program = await Program.findById(id);

    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    program.currentListeners = count;

    // Update total listeners if current is higher
    if (count > program.totalListeners) {
      program.totalListeners = count;
    }

    program.updatedAt = new Date();

    await program.save();

    res.json({
      message: "Listener count updated",
      program,
    });
  } catch (error) {
    console.error("Update listener count error:", error);
    res.status(500).json({
      message: "Server error updating listener count",
      error: error.message,
    });
  }
};

/**
 * Delete program
 * DELETE /api/programs/:id
 */
export const deleteProgram = async (req, res) => {
  try {
    const { id } = req.params;

    const program = await Program.findByIdAndDelete(id);

    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    res.json({
      message: "Program deleted successfully",
      program,
    });
  } catch (error) {
    console.error("Delete program error:", error);
    res.status(500).json({
      message: "Server error deleting program",
      error: error.message,
    });
  }
};

/**
 * Get featured programs
 * GET /api/programs/featured
 */
export const getFeaturedPrograms = async (req, res) => {
  try {
    // Get live programs first, then scheduled
    const livePrograms = await Program.find({ status: "live" })
      .sort({ currentListeners: -1 })
      .limit(3);

    const scheduledPrograms = await Program.find({ status: "scheduled" })
      .sort({ scheduleStartTime: 1 })
      .limit(3);

    const programs = [...livePrograms, ...scheduledPrograms].slice(0, 6);

    res.json({
      message: "Featured programs retrieved",
      programs,
    });
  } catch (error) {
    console.error("Get featured programs error:", error);
    res.status(500).json({
      message: "Server error fetching featured programs",
      error: error.message,
    });
  }
};

/**
 * Search programs
 * GET /api/programs/search
 */
export const searchPrograms = async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({
        message: "Search query is required",
      });
    }

    const skip = (page - 1) * limit;

    const searchQuery = {
      $or: [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { host: { $regex: q, $options: "i" } },
        { tags: { $in: [new RegExp(q, "i")] } },
      ],
    };

    const programs = await Program.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("createdBy", "name email");

    const total = await Program.countDocuments(searchQuery);

    res.json({
      message: "Programs found",
      programs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Search programs error:", error);
    res.status(500).json({
      message: "Server error searching programs",
      error: error.message,
    });
  }
};
