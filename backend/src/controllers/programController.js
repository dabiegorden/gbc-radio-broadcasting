import Program from "../models/Program.js";
import { deriveEmbedUrl, validateSocialUrl } from "../utils/embedUrl.js";
import {
  fetchSocialStats,
  fetchAllSocialStats,
} from "../utils/Socialstats .js";

// ─── In-memory stats cache ────────────────────────────────────────────────────
//
// Platform APIs have rate limits — we cache stats per (programId + platform)
// for CACHE_TTL_MS milliseconds so repeated requests don't hammer the APIs.
//
// Structure: Map<`${programId}:${platform}`, { stats, expiresAt }>
//
const statsCache = new Map();
const CACHE_TTL_MS = 60_000; // 60 seconds

function getCachedStats(programId, platform) {
  const key = `${programId}:${platform}`;
  const entry = statsCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    statsCache.delete(key);
    return null;
  }
  return entry.stats;
}

function setCachedStats(programId, platform, stats) {
  statsCache.set(`${programId}:${platform}`, {
    stats,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// ─── Social stream helpers ────────────────────────────────────────────────────

/**
 * Normalises and validates the socialStreams array coming from the request body.
 * Each item must have { platform, url } — label and isActive are optional.
 * Returns the enriched array (with embedUrl filled in) or throws.
 */
function normaliseSocialStreams(raw = []) {
  if (!Array.isArray(raw)) throw new Error("socialStreams must be an array");

  return raw.map((stream, i) => {
    const { platform, url, label, isActive } = stream;

    if (!platform || !url) {
      throw new Error(
        `socialStreams[${i}]: both platform and url are required`,
      );
    }

    const validPlatforms = ["tiktok", "facebook", "instagram", "youtube"];
    if (!validPlatforms.includes(platform)) {
      throw new Error(
        `socialStreams[${i}]: platform must be one of ${validPlatforms.join(", ")}`,
      );
    }

    validateSocialUrl(platform, url); // throws if URL looks wrong

    return {
      platform,
      url,
      embedUrl: deriveEmbedUrl(platform, url),
      label: label || null,
      isActive: isActive !== undefined ? isActive : true,
    };
  });
}

/**
 * Attaches live stats to each social stream object.
 * Uses the in-memory cache to avoid hammering platform APIs.
 *
 * @param {string} programId
 * @param {Array} socialStreams
 * @returns {Promise<Array>} streams with a `stats` field appended
 */
async function attachStats(programId, socialStreams = []) {
  const enriched = await Promise.all(
    socialStreams.map(async (stream) => {
      const cached = getCachedStats(programId, stream.platform);
      if (cached) {
        return { ...(stream.toObject?.() ?? stream), stats: cached };
      }

      const stats = await fetchSocialStats(stream);
      setCachedStats(programId, stream.platform, stats);
      return { ...(stream.toObject?.() ?? stream), stats };
    }),
  );
  return enriched;
}

// ─── Controllers ─────────────────────────────────────────────────────────────

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
      socialStreams,
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
      return res
        .status(400)
        .json({ message: "End time must be after start time" });
    }

    // Validate + enrich social streams
    let normalisedStreams = [];
    try {
      normalisedStreams = normaliseSocialStreams(socialStreams);
    } catch (err) {
      return res.status(400).json({ message: err.message });
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
      socialStreams: normalisedStreams,
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

    // Fetch initial stats for any social streams (fire-and-forget for speed)
    const streamsWithStats = await attachStats(
      program._id.toString(),
      normalisedStreams,
    );

    res.status(201).json({
      message: "Program created successfully",
      program: {
        ...program.toObject(),
        socialStreams: streamsWithStats,
      },
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
 * Query: ?withStats=true to attach social stats (slower, use sparingly)
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
      withStats = "false",
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    if (isLive !== undefined) query.isLive = isLive === "true";
    if (status) query.status = status;
    if (category) query.category = category;

    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const programs = await Program.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("createdBy", "name email");

    const total = await Program.countDocuments(query);

    // Optionally attach stats — only do this for small result sets or live programs
    let programsOut = programs;
    if (withStats === "true") {
      programsOut = await Promise.all(
        programs.map(async (p) => {
          const streamsWithStats = await attachStats(
            p._id.toString(),
            p.socialStreams,
          );
          return { ...p.toObject(), socialStreams: streamsWithStats };
        }),
      );
    }

    res.json({
      message: "Programs retrieved",
      programs: programsOut,
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
 * Always returns live social stats attached to each stream.
 */
export const getProgramById = async (req, res) => {
  try {
    const program = await Program.findById(req.params.id).populate(
      "createdBy",
      "name email",
    );

    if (!program) return res.status(404).json({ message: "Program not found" });

    const streamsWithStats = await attachStats(
      program._id.toString(),
      program.socialStreams,
    );

    res.json({
      message: "Program retrieved",
      program: {
        ...program.toObject(),
        socialStreams: streamsWithStats,
      },
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
      socialStreams,
      tags,
      status,
    } = req.body;

    const program = await Program.findById(id);
    if (!program) return res.status(404).json({ message: "Program not found" });

    // Validate time range if both times provided
    if (scheduleStartTime && scheduleEndTime) {
      if (new Date(scheduleEndTime) <= new Date(scheduleStartTime)) {
        return res
          .status(400)
          .json({ message: "End time must be after start time" });
      }
    }

    // Validate + enrich social streams if provided
    if (socialStreams !== undefined) {
      try {
        program.socialStreams = normaliseSocialStreams(socialStreams);
        // Bust cache for all platforms on this program since streams changed
        program.socialStreams.forEach((s) =>
          statsCache.delete(`${id}:${s.platform}`),
        );
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
    }

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

    const streamsWithStats = await attachStats(id, program.socialStreams);

    res.json({
      message: "Program updated successfully",
      program: {
        ...program.toObject(),
        socialStreams: streamsWithStats,
      },
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
 * Add or replace a single social stream entry
 * POST /api/programs/:id/social-streams
 * Body: { platform, url, label?, isActive? }
 */
export const addSocialStream = async (req, res) => {
  try {
    const { id } = req.params;
    const { platform, url, label, isActive } = req.body;

    if (!platform || !url) {
      return res.status(400).json({ message: "platform and url are required" });
    }

    let enriched;
    try {
      [enriched] = normaliseSocialStreams([{ platform, url, label, isActive }]);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    const program = await Program.findById(id);
    if (!program) return res.status(404).json({ message: "Program not found" });

    // Replace if platform already exists, otherwise push
    const idx = program.socialStreams.findIndex((s) => s.platform === platform);
    if (idx !== -1) {
      program.socialStreams[idx] = enriched;
    } else {
      program.socialStreams.push(enriched);
    }

    // Bust cache for this platform
    statsCache.delete(`${id}:${platform}`);

    program.updatedAt = new Date();
    await program.save();

    // Fetch fresh stats for the newly added stream
    const stats = await fetchSocialStats(enriched);
    setCachedStats(id, platform, stats);

    const streamsWithStats = await attachStats(id, program.socialStreams);

    res.json({
      message: `${platform} stream added/updated`,
      socialStreams: streamsWithStats,
    });
  } catch (error) {
    console.error("Add social stream error:", error);
    res.status(500).json({
      message: "Server error adding social stream",
      error: error.message,
    });
  }
};

/**
 * Remove a social stream by platform
 * DELETE /api/programs/:id/social-streams/:platform
 */
export const removeSocialStream = async (req, res) => {
  try {
    const { id, platform } = req.params;

    const program = await Program.findById(id);
    if (!program) return res.status(404).json({ message: "Program not found" });

    const before = program.socialStreams.length;
    program.socialStreams = program.socialStreams.filter(
      (s) => s.platform !== platform,
    );

    if (program.socialStreams.length === before) {
      return res
        .status(404)
        .json({ message: `No ${platform} stream found on this program` });
    }

    // Remove from cache
    statsCache.delete(`${id}:${platform}`);

    program.updatedAt = new Date();
    await program.save();

    res.json({
      message: `${platform} stream removed`,
      socialStreams: program.socialStreams,
    });
  } catch (error) {
    console.error("Remove social stream error:", error);
    res.status(500).json({
      message: "Server error removing social stream",
      error: error.message,
    });
  }
};

/**
 * Get all active social stream URLs for a program — with live stats
 * GET /api/programs/:id/social-streams
 *
 * This is the primary endpoint viewers hit to load the stream player.
 * Stats are always fresh (cache respected).
 */
export const getSocialStreams = async (req, res) => {
  try {
    const program = await Program.findById(req.params.id).select(
      "title socialStreams streamingUrl isLive",
    );

    if (!program) return res.status(404).json({ message: "Program not found" });

    const activeStreams = program.socialStreams.filter((s) => s.isActive);
    const streamsWithStats = await attachStats(
      program._id.toString(),
      activeStreams,
    );

    res.json({
      message: "Social streams retrieved",
      programTitle: program.title,
      isLive: program.isLive,
      streamingUrl: program.streamingUrl,
      socialStreams: streamsWithStats,
    });
  } catch (error) {
    console.error("Get social streams error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Refresh stats for a single platform on a program (bypasses cache)
 * POST /api/programs/:id/social-streams/:platform/refresh-stats
 *
 * Useful for a manual "Refresh stats" button in the UI.
 */
export const refreshStreamStats = async (req, res) => {
  try {
    const { id, platform } = req.params;

    const program = await Program.findById(id).select("socialStreams title");
    if (!program) return res.status(404).json({ message: "Program not found" });

    const stream = program.socialStreams.find((s) => s.platform === platform);
    if (!stream) {
      return res
        .status(404)
        .json({ message: `No ${platform} stream on this program` });
    }

    // Force-bust cache and re-fetch
    statsCache.delete(`${id}:${platform}`);
    const stats = await fetchSocialStats(stream);
    setCachedStats(id, platform, stats);

    res.json({
      message: `Stats refreshed for ${platform}`,
      platform,
      stats,
    });
  } catch (error) {
    console.error("Refresh stream stats error:", error);
    res.status(500).json({
      message: "Server error refreshing stats",
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

    const updateData = { isLive, updatedAt: new Date() };

    if (isLive) {
      updateData.status = "live";
    } else {
      const program = await Program.findById(id);
      updateData.status =
        program && new Date() > new Date(program.scheduleEndTime)
          ? "completed"
          : "scheduled";
    }

    const program = await Program.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    if (!program) return res.status(404).json({ message: "Program not found" });

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
      return res.status(400).json({ message: "count must be a number" });
    }

    const program = await Program.findById(id);
    if (!program) return res.status(404).json({ message: "Program not found" });

    program.currentListeners = count;
    if (count > program.totalListeners) program.totalListeners = count;
    program.updatedAt = new Date();
    await program.save();

    res.json({ message: "Listener count updated", program });
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
    const program = await Program.findByIdAndDelete(req.params.id);
    if (!program) return res.status(404).json({ message: "Program not found" });

    // Clean up any cached stats for this program
    for (const key of statsCache.keys()) {
      if (key.startsWith(`${req.params.id}:`)) statsCache.delete(key);
    }

    res.json({ message: "Program deleted successfully", program });
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
    const livePrograms = await Program.find({ status: "live" })
      .sort({ currentListeners: -1 })
      .limit(3);

    const scheduledPrograms = await Program.find({ status: "scheduled" })
      .sort({ scheduleStartTime: 1 })
      .limit(3);

    const programs = [...livePrograms, ...scheduledPrograms].slice(0, 6);

    // Attach stats for live programs (most valuable for featured view)
    const programsWithStats = await Promise.all(
      programs.map(async (p) => {
        const streams = p.isLive
          ? await attachStats(p._id.toString(), p.socialStreams)
          : p.socialStreams;
        return { ...p.toObject(), socialStreams: streams };
      }),
    );

    res.json({
      message: "Featured programs retrieved",
      programs: programsWithStats,
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

    if (!q)
      return res.status(400).json({ message: "Search query is required" });

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
