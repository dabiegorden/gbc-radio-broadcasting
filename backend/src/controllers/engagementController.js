import Engagement from "../models/Engagement.js";
import { getGeminiClient } from "../config/gemini.js";
import { analyzeSentiment } from "../services/sentimentService.js";
import Program from "../models/Program.js";
import mongoose from "mongoose";

// Gemini model used for comment analysis. Keep in sync with config/gemini.js.
const GEMINI_MODEL = "gemini-3.5-flash";

/**
 * Engagement Controller
 * Handles user engagement tracking and AI-powered analysis
 */

/**
 * Create a new engagement (comment/like/reaction)
 * POST /api/engagement
 */
export const createEngagement = async (req, res) => {
  try {
    const {
      programId,
      engagementType,
      comment,
      listeningDuration,
      sessionId,
      deviceInfo,
      location,
    } = req.body;
    const userId = req.user._id;

    // Validate program exists
    const program = await Program.findById(programId);
    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    // Create engagement record
    const engagement = new Engagement({
      user: userId,
      program: programId,
      engagementType,
      comment: comment
        ? {
            text: comment,
            sentiment: null,
            engagementScore: 0,
            aiAnalysis: {},
          }
        : undefined,
      listeningDuration: listeningDuration || 0,
      sessionId: sessionId || `session_${Date.now()}`,
      deviceInfo: deviceInfo || null,
      location: location || null,
      timestamp: new Date(),
    });

    // If it's a comment, analyze with Gemini AI
    if (engagementType === "comment" && comment) {
      try {
        const analysis = await analyzeCommentWithGemini(comment);
        engagement.comment = {
          text: comment,
          sentiment: analysis.sentiment,
          engagementScore: analysis.score,
          aiAnalysis: {
            summary: analysis.summary,
            keywords: analysis.keywords,
            predictedFollowUp: analysis.predictedFollowUp,
          },
        };
      } catch (aiError) {
        console.error("Gemini AI analysis error:", aiError);
        // Continue without analysis if AI fails
      }
    }

    await engagement.save();

    // Populate user details for response
    await engagement.populate("user", "fullName email");
    await engagement.populate("program", "title");

    // Emit real-time update via Socket.IO if available
    if (req.io) {
      req.io.emit("engagement-created", {
        engagement: engagement.toObject(),
        programId,
      });
    }

    res.status(201).json({
      message: "Engagement created successfully",
      engagement,
    });
  } catch (error) {
    console.error("Create engagement error:", error);
    res.status(500).json({
      message: "Server error creating engagement",
      error: error.message,
    });
  }
};

/**
 * Get all engagements with filtering
 * GET /api/engagement
 */
export const getAllEngagements = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      engagementType,
      programId,
      sentiment,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const skip = (page - 1) * limit;

    let query = {};

    if (engagementType) {
      query.engagementType = engagementType;
    }

    if (programId) {
      query.program = programId;
    }

    if (sentiment) {
      query["comment.sentiment"] = sentiment;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const engagements = await Engagement.find(query)
      .populate("user", "fullName email")
      .populate("program", "title category")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Engagement.countDocuments(query);

    res.json({
      message: "Engagements retrieved",
      engagements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all engagements error:", error);
    res.status(500).json({
      message: "Server error fetching engagements",
      error: error.message,
    });
  }
};

/**
 * Get engagements for a program
 * GET /api/engagement/program/:programId
 */
export const getEngagementsByProgram = async (req, res) => {
  try {
    const { programId } = req.params;
    const { page = 1, limit = 20, engagementType } = req.query;

    const skip = (page - 1) * limit;

    const query = { program: programId };
    if (engagementType) query.engagementType = engagementType;

    const engagements = await Engagement.find(query)
      .populate("user", "fullName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Engagement.countDocuments(query);

    res.json({
      message: "Engagements retrieved",
      engagements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get engagements error:", error);
    res.status(500).json({
      message: "Server error fetching engagements",
      error: error.message,
    });
  }
};

/**
 * Get user's engagements
 * GET /api/engagement/user/:userId
 */
export const getUserEngagements = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const skip = (page - 1) * limit;

    const engagements = await Engagement.find({ user: userId })
      .populate("program", "title description")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Engagement.countDocuments({ user: userId });

    res.json({
      message: "User engagements retrieved",
      engagements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get user engagements error:", error);
    res.status(500).json({
      message: "Server error fetching user engagements",
      error: error.message,
    });
  }
};

/**
 * Get engagement statistics
 * GET /api/engagement/stats/:programId
 */
export const getEngagementStats = async (req, res) => {
  try {
    const { programId } = req.params;

    const objectId = new mongoose.Types.ObjectId(programId);

    const stats = await Engagement.aggregate([
      { $match: { program: objectId } },
      {
        $group: {
          _id: null,
          totalEngagements: { $sum: 1 },
          commentCount: {
            $sum: { $cond: [{ $eq: ["$engagementType", "comment"] }, 1, 0] },
          },
          likeCount: {
            $sum: { $cond: [{ $eq: ["$engagementType", "like"] }, 1, 0] },
          },
          shareCount: {
            $sum: { $cond: [{ $eq: ["$engagementType", "share"] }, 1, 0] },
          },
          followCount: {
            $sum: { $cond: [{ $eq: ["$engagementType", "follow"] }, 1, 0] },
          },
          averageListeningDuration: {
            $avg: "$listeningDuration",
          },
          totalListeningTime: {
            $sum: "$listeningDuration",
          },
        },
      },
    ]);

    const sentimentBreakdown = await Engagement.aggregate([
      {
        $match: {
          program: objectId,
          "comment.sentiment": { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: "$comment.sentiment",
          count: { $sum: 1 },
          avgScore: { $avg: "$comment.engagementScore" },
        },
      },
    ]);

    // Get recent engagement trend (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const trend = await Engagement.aggregate([
      {
        $match: {
          program: objectId,
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      message: "Engagement statistics retrieved",
      stats: stats[0] || {
        totalEngagements: 0,
        commentCount: 0,
        likeCount: 0,
        shareCount: 0,
        followCount: 0,
        averageListeningDuration: 0,
        totalListeningTime: 0,
      },
      sentimentBreakdown,
      trend,
    });
  } catch (error) {
    console.error("Get engagement stats error:", error);
    res.status(500).json({
      message: "Server error fetching engagement stats",
      error: error.message,
    });
  }
};

/**
 * Get overall engagement insights (for all programs)
 * GET /api/engagement/insights
 */
export const getEngagementInsights = async (req, res) => {
  try {
    const totalEngagements = await Engagement.countDocuments();

    const engagementByType = await Engagement.aggregate([
      {
        $group: {
          _id: "$engagementType",
          count: { $sum: 1 },
        },
      },
    ]);

    const sentimentDistribution = await Engagement.aggregate([
      {
        $match: {
          "comment.sentiment": { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: "$comment.sentiment",
          count: { $sum: 1 },
          avgScore: { $avg: "$comment.engagementScore" },
        },
      },
    ]);

    const topPrograms = await Engagement.aggregate([
      {
        $group: {
          _id: "$program",
          engagementCount: { $sum: 1 },
        },
      },
      { $sort: { engagementCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "programs",
          localField: "_id",
          foreignField: "_id",
          as: "programInfo",
        },
      },
      { $unwind: "$programInfo" },
      {
        $project: {
          programId: "$_id",
          title: "$programInfo.title",
          engagementCount: 1,
        },
      },
    ]);

    res.json({
      message: "Engagement insights retrieved",
      insights: {
        totalEngagements,
        engagementByType,
        sentimentDistribution,
        topPrograms,
      },
    });
  } catch (error) {
    console.error("Get engagement insights error:", error);
    res.status(500).json({
      message: "Server error fetching engagement insights",
      error: error.message,
    });
  }
};

/**
 * Analyze comment with Gemini AI
 * Helper function
 */
export const analyzeCommentWithGemini = async (comment) => {
  try {
    const client = getGeminiClient();

    if (!client) {
      // No Gemini key configured — fall back to the offline lexicon analyzer
      // so sentiment/score are still populated instead of staying null.
      return lexiconAnalysis(comment);
    }

    const prompt = `Analyze the following radio listener comment and provide detailed insights:

Comment: "${comment}"

Please analyze and respond in JSON format with:
{
  "sentiment": "positive|negative|neutral",
  "score": <number 0-100, where 100 is highly engaged>,
  "summary": "brief 1-2 sentence summary of the comment",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "predictedFollowUp": <boolean, true if user is likely to engage again>,
  "reasoning": "brief explanation of the analysis"
}

Consider tone, enthusiasm level, constructive feedback, and engagement likelihood.`;

    // Correct way to get the model from Gemini client
    const model = client.getGenerativeModel({ model: GEMINI_MODEL });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse AI response");
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return {
      sentiment: analysis.sentiment || "neutral",
      score: analysis.score || 50,
      summary: analysis.summary || "No summary available",
      keywords: analysis.keywords || [],
      predictedFollowUp: analysis.predictedFollowUp || false,
    };
  } catch (error) {
    console.error("Gemini analysis error:", error);
    // Fall back to the offline lexicon analyzer so sentiment/score are still
    // populated (instead of a flat "neutral") when the AI call fails.
    return lexiconAnalysis(comment);
  }
};

/**
 * Offline fallback analysis using the lexicon sentiment service.
 * Produces the same shape as analyzeCommentWithGemini so callers are unchanged.
 */
function lexiconAnalysis(comment = "") {
  const { sentiment, confidence } = analyzeSentiment(comment);

  // Map confidence (0.5–0.95) to an engagement score (0–100), nudged by polarity.
  let score = Math.round(confidence * 100);
  if (sentiment === "negative") score = Math.max(0, 100 - score);
  if (sentiment === "neutral") score = 50;

  const keywords = String(comment)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5);

  return {
    sentiment,
    score,
    summary: comment
      ? `Listener comment classified as ${sentiment}.`
      : "No comment text provided.",
    keywords,
    predictedFollowUp: sentiment === "positive",
  };
}

/**
 * Batch analyze comments
 * POST /api/engagement/analyze-batch
 */
export const analyzeBatchComments = async (req, res) => {
  try {
    const { engagementIds } = req.body;

    if (!Array.isArray(engagementIds)) {
      return res.status(400).json({
        message: "engagementIds must be an array",
      });
    }

    const engagements = await Engagement.find({
      _id: { $in: engagementIds },
      engagementType: "comment",
      "comment.text": { $exists: true, $ne: null },
    });

    const results = [];

    for (const engagement of engagements) {
      try {
        const analysis = await analyzeCommentWithGemini(
          engagement.comment.text,
        );
        engagement.comment.sentiment = analysis.sentiment;
        engagement.comment.engagementScore = analysis.score;
        engagement.comment.aiAnalysis = {
          summary: analysis.summary,
          keywords: analysis.keywords,
          predictedFollowUp: analysis.predictedFollowUp,
        };
        engagement.updatedAt = new Date();
        await engagement.save();

        results.push({
          id: engagement._id,
          status: "success",
          analysis,
        });
      } catch (error) {
        results.push({
          id: engagement._id,
          status: "failed",
          error: error.message,
        });
      }
    }

    res.json({
      message: "Batch analysis completed",
      results,
      summary: {
        total: engagementIds.length,
        processed: results.length,
        successful: results.filter((r) => r.status === "success").length,
      },
    });
  } catch (error) {
    console.error("Batch analysis error:", error);
    res.status(500).json({
      message: "Server error during batch analysis",
      error: error.message,
    });
  }
};

/**
 * Backfill sentiment/AI analysis for comment engagements that are missing it.
 * Useful for records created before analysis was working. Uses the same
 * analyzer (Gemini with offline lexicon fallback) so it never fails hard.
 * POST /api/engagement/backfill-sentiment
 */
export const backfillSentiment = async (req, res) => {
  try {
    const { limit = 500 } = req.body || {};

    const pending = await Engagement.find({
      engagementType: "comment",
      "comment.text": { $exists: true, $ne: null },
      $or: [
        { "comment.sentiment": null },
        { "comment.sentiment": { $exists: false } },
      ],
    }).limit(parseInt(limit));

    let updated = 0;
    for (const engagement of pending) {
      const analysis = await analyzeCommentWithGemini(engagement.comment.text);
      engagement.comment.sentiment = analysis.sentiment;
      engagement.comment.engagementScore = analysis.score;
      engagement.comment.aiAnalysis = {
        summary: analysis.summary,
        keywords: analysis.keywords,
        predictedFollowUp: analysis.predictedFollowUp,
      };
      engagement.updatedAt = new Date();
      await engagement.save();
      updated++;
    }

    res.json({
      message: "Sentiment backfill completed",
      matched: pending.length,
      updated,
    });
  } catch (error) {
    console.error("Backfill sentiment error:", error);
    res.status(500).json({
      message: "Server error during sentiment backfill",
      error: error.message,
    });
  }
};

/**
 * Update engagement
 * PUT /api/engagement/:id
 */
export const updateEngagement = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const userId = req.user._id;

    const engagement = await Engagement.findById(id);

    if (!engagement) {
      return res.status(404).json({ message: "Engagement not found" });
    }

    // Check if user owns this engagement
    if (engagement.user.toString() !== userId.toString()) {
      return res.status(403).json({
        message: "Not authorized to update this engagement",
      });
    }

    // Update comment if provided
    if (comment && engagement.engagementType === "comment") {
      // Re-analyze with AI
      try {
        const analysis = await analyzeCommentWithGemini(comment);
        engagement.comment = {
          text: comment,
          sentiment: analysis.sentiment,
          engagementScore: analysis.score,
          aiAnalysis: {
            summary: analysis.summary,
            keywords: analysis.keywords,
            predictedFollowUp: analysis.predictedFollowUp,
          },
        };
      } catch (aiError) {
        console.error("AI analysis error:", aiError);
        engagement.comment.text = comment;
      }
    }

    engagement.updatedAt = new Date();
    await engagement.save();

    await engagement.populate("user", "fullName email");
    await engagement.populate("program", "title");

    // Emit real-time update
    if (req.io) {
      req.io.emit("engagement-updated", {
        engagement: engagement.toObject(),
      });
    }

    res.json({
      message: "Engagement updated successfully",
      engagement,
    });
  } catch (error) {
    console.error("Update engagement error:", error);
    res.status(500).json({
      message: "Server error updating engagement",
      error: error.message,
    });
  }
};

/**
 * Delete engagement
 * DELETE /api/engagement/:id
 */
export const deleteEngagement = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const engagement = await Engagement.findById(id);

    if (!engagement) {
      return res.status(404).json({ message: "Engagement not found" });
    }

    // Check if user owns this engagement or is admin
    if (
      engagement.user.toString() !== userId.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        message: "Not authorized to delete this engagement",
      });
    }

    await Engagement.findByIdAndDelete(id);

    // Emit real-time update
    if (req.io) {
      req.io.emit("engagement-deleted", {
        engagementId: id,
      });
    }

    res.json({
      message: "Engagement deleted successfully",
    });
  } catch (error) {
    console.error("Delete engagement error:", error);
    res.status(500).json({
      message: "Server error deleting engagement",
      error: error.message,
    });
  }
};
