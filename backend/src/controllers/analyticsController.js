import Analytics from "../models/Analytics.js";
import Engagement from "../models/Engagement.js";
import Program from "../models/Program.js";
import User from "../models/User.js";
import PDFDocument from "pdfkit";

/**
 * Analytics Controller
 * Handles analytics and reporting with PDF generation
 */

/**
 * Get dashboard analytics
 * GET /api/analytics/dashboard
 */
export const getDashboardAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Get total users
    const totalUsers = await User.countDocuments({ role: "users" });
    const activeUsers = await User.countDocuments({
      role: "users",
      isActive: true,
    });

    // Get total programs
    const totalPrograms = await Program.countDocuments();

    // Get total engagements
    const totalEngagements = await Engagement.countDocuments(dateFilter);

    // Get live programs count
    const livePrograms = await Program.countDocuments({ isLive: true });

    // Get total listeners across all programs
    const listenerStats = await Program.aggregate([
      {
        $group: {
          _id: null,
          totalListeners: { $sum: "$totalListeners" },
          currentListeners: { $sum: "$currentListeners" },
        },
      },
    ]);

    // Get engagement breakdown
    const engagementBreakdown = await Engagement.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get sentiment breakdown
    const sentimentBreakdown = await Engagement.aggregate([
      { $match: { ...dateFilter, sentiment: { $ne: null } } },
      {
        $group: {
          _id: "$sentiment",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get average engagement score
    const avgEngagementScore = await Engagement.aggregate([
      { $match: { ...dateFilter, engagementScore: { $ne: null } } },
      {
        $group: {
          _id: null,
          avgScore: { $avg: "$engagementScore" },
        },
      },
    ]);

    // Get category performance
    const categoryPerformance = await Program.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          totalListeners: { $sum: "$totalListeners" },
          avgEngagement: { $avg: "$averageEngagementScore" },
        },
      },
      { $sort: { totalListeners: -1 } },
    ]);

    res.json({
      success: true,
      message: "Dashboard analytics retrieved",
      analytics: {
        summary: {
          totalUsers,
          activeUsers,
          totalPrograms,
          totalEngagements,
          livePrograms,
          totalListeners: listenerStats[0]?.totalListeners || 0,
          currentListeners: listenerStats[0]?.currentListeners || 0,
          avgEngagementScore: avgEngagementScore[0]?.avgScore || 0,
        },
        engagementBreakdown,
        sentimentBreakdown,
        categoryPerformance,
      },
    });
  } catch (error) {
    console.error("Dashboard analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching dashboard analytics",
      error: error.message,
    });
  }
};

/**
 * Get program analytics
 * GET /api/analytics/program/:programId
 */
export const getProgramAnalytics = async (req, res) => {
  try {
    const { programId } = req.params;
    const { startDate, endDate } = req.query;

    // Verify program exists
    const program = await Program.findById(programId);
    if (!program) {
      return res.status(404).json({
        success: false,
        message: "Program not found",
      });
    }

    let dateFilter = { program: program._id };
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Get engagement metrics
    const engagementMetrics = await Engagement.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalEngagements: { $sum: 1 },
          avgScore: { $avg: "$engagementScore" },
          maxScore: { $max: "$engagementScore" },
          minScore: { $min: "$engagementScore" },
        },
      },
    ]);

    // Get daily engagement trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyTrend = await Engagement.aggregate([
      {
        $match: {
          program: program._id,
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
          avgScore: { $avg: "$engagementScore" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get sentiment analysis
    const sentimentAnalysis = await Engagement.aggregate([
      { $match: { ...dateFilter, sentiment: { $ne: null } } },
      {
        $group: {
          _id: "$sentiment",
          count: { $sum: 1 },
          avgScore: { $avg: "$engagementScore" },
        },
      },
    ]);

    // Get engagement type breakdown
    const typeBreakdown = await Engagement.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
    ]);

    // Calculate predictions
    const predictions = calculatePredictions(dailyTrend, program);

    res.json({
      success: true,
      message: "Program analytics retrieved",
      programId,
      analytics: {
        program: {
          title: program.title,
          isLive: program.isLive,
          currentListeners: program.currentListeners,
          totalListeners: program.totalListeners,
          category: program.category,
        },
        engagementMetrics: engagementMetrics[0] || {
          totalEngagements: 0,
          avgScore: 0,
          maxScore: 0,
          minScore: 0,
        },
        dailyTrend,
        sentimentAnalysis,
        typeBreakdown,
        predictions,
      },
    });
  } catch (error) {
    console.error("Program analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching program analytics",
      error: error.message,
    });
  }
};

/**
 * Get engagement trends
 * GET /api/analytics/trends
 */
export const getEngagementTrends = async (req, res) => {
  try {
    const { days = 30, period = "daily" } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    let dateFormat = "%Y-%m-%d";
    if (period === "weekly") dateFormat = "%Y-W%V";
    if (period === "monthly") dateFormat = "%Y-%m";

    const trends = await Engagement.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: dateFormat, date: "$createdAt" },
          },
          totalEngagements: { $sum: 1 },
          avgScore: { $avg: "$engagementScore" },
          positiveCount: {
            $sum: {
              $cond: [{ $eq: ["$sentiment", "positive"] }, 1, 0],
            },
          },
          negativeCount: {
            $sum: {
              $cond: [{ $eq: ["$sentiment", "negative"] }, 1, 0],
            },
          },
          neutralCount: {
            $sum: {
              $cond: [{ $eq: ["$sentiment", "neutral"] }, 1, 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      message: "Engagement trends retrieved",
      trends,
      period,
      days: parseInt(days),
    });
  } catch (error) {
    console.error("Engagement trends error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching engagement trends",
      error: error.message,
    });
  }
};

/**
 * Generate PDF report
 * GET /api/analytics/report/pdf
 */
export const generatePDFReport = async (req, res) => {
  try {
    const { startDate, endDate, includePrograms } = req.query;

    // Fetch analytics data
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const totalUsers = await User.countDocuments({ role: "users" });
    const totalPrograms = await Program.countDocuments();
    const totalEngagements = await Engagement.countDocuments(dateFilter);
    const livePrograms = await Program.countDocuments({ isLive: true });

    const engagementBreakdown = await Engagement.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
    ]);

    const sentimentBreakdown = await Engagement.aggregate([
      { $match: { ...dateFilter, sentiment: { $ne: null } } },
      {
        $group: {
          _id: "$sentiment",
          count: { $sum: 1 },
        },
      },
    ]);

    // Create PDF
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
    });

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=analytics-report-${Date.now()}.pdf`,
    );

    // Pipe PDF to response
    doc.pipe(res);

    // Add content
    // Header
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("Radio Analytics Report", { align: "center" });

    doc.moveDown();
    doc
      .fontSize(12)
      .font("Helvetica")
      .text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });

    if (startDate && endDate) {
      doc.text(
        `Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`,
        { align: "center" },
      );
    }

    doc.moveDown(2);

    // Summary Section
    doc.fontSize(18).font("Helvetica-Bold").text("Executive Summary");
    doc.moveDown();

    doc.fontSize(12).font("Helvetica");
    doc.text(`Total Users: ${totalUsers}`);
    doc.text(`Total Programs: ${totalPrograms}`);
    doc.text(`Live Programs: ${livePrograms}`);
    doc.text(`Total Engagements: ${totalEngagements}`);

    doc.moveDown(2);

    // Engagement Breakdown
    doc.fontSize(18).font("Helvetica-Bold").text("Engagement Breakdown");
    doc.moveDown();

    doc.fontSize(12).font("Helvetica");
    engagementBreakdown.forEach((item) => {
      doc.text(`${item._id}: ${item.count}`);
    });

    doc.moveDown(2);

    // Sentiment Analysis
    doc.fontSize(18).font("Helvetica-Bold").text("Sentiment Analysis");
    doc.moveDown();

    doc.fontSize(12).font("Helvetica");
    sentimentBreakdown.forEach((item) => {
      doc.text(`${item._id}: ${item.count}`);
    });

    // Programs Section (if requested)
    if (includePrograms === "true") {
      doc.addPage();
      doc.fontSize(18).font("Helvetica-Bold").text("Program Performance");
      doc.moveDown();

      const programs = await Program.find()
        .sort({ totalListeners: -1 })
        .limit(10);

      doc.fontSize(12).font("Helvetica");
      programs.forEach((program, index) => {
        doc.text(`${index + 1}. ${program.title}`);
        doc.text(`   Listeners: ${program.totalListeners}`);
        doc.text(`   Category: ${program.category}`);
        doc.text(`   Status: ${program.status}`);
        doc.moveDown();
      });
    }

    // Footer
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(
        "This report is confidential and intended for internal use only.",
        50,
        doc.page.height - 50,
        { align: "center" },
      );

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error("Generate PDF error:", error);
    res.status(500).json({
      success: false,
      message: "Error generating PDF report",
      error: error.message,
    });
  }
};

/**
 * Save analytics report
 * POST /api/analytics/report
 */
export const saveAnalyticsReport = async (req, res) => {
  try {
    const { programId, title, metrics, reportData } = req.body;

    const report = new Analytics({
      program: programId,
      title,
      metrics,
      reportData,
      date: new Date(),
    });

    await report.save();

    res.status(201).json({
      success: true,
      message: "Analytics report saved successfully",
      report,
    });
  } catch (error) {
    console.error("Save analytics report error:", error);
    res.status(500).json({
      success: false,
      message: "Server error saving analytics report",
      error: error.message,
    });
  }
};

/**
 * Get saved reports
 * GET /api/analytics/reports
 */
export const getSavedReports = async (req, res) => {
  try {
    const { programId, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (programId) query.program = programId;

    const reports = await Analytics.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("program", "title category");

    const total = await Analytics.countDocuments(query);

    res.json({
      success: true,
      message: "Saved reports retrieved",
      reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get saved reports error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching saved reports",
      error: error.message,
    });
  }
};

/**
 * Helper function to calculate predictions
 */
function calculatePredictions(dailyTrend, program) {
  if (!dailyTrend || dailyTrend.length < 7) {
    return {
      expectedEngagement: 0,
      engagementTrend: "stable",
      predictedAudience: program.totalListeners || 0,
      riskFactors: ["Insufficient data for predictions"],
      recommendations: ["Collect more engagement data"],
    };
  }

  // Calculate trend
  const recentData = dailyTrend.slice(-7);
  const olderData = dailyTrend.slice(0, 7);

  const recentAvg =
    recentData.reduce((sum, d) => sum + d.count, 0) / recentData.length;
  const olderAvg =
    olderData.reduce((sum, d) => sum + d.count, 0) / olderData.length;

  let engagementTrend = "stable";
  if (recentAvg > olderAvg * 1.1) engagementTrend = "increasing";
  else if (recentAvg < olderAvg * 0.9) engagementTrend = "decreasing";

  // Predict next week's engagement
  const expectedEngagement = Math.round(recentAvg * 7);

  // Predict audience
  const predictedAudience = Math.round(
    program.totalListeners * (engagementTrend === "increasing" ? 1.15 : 0.95),
  );

  // Risk factors
  const riskFactors = [];
  if (engagementTrend === "decreasing")
    riskFactors.push("Declining engagement");
  if (recentAvg < 10) riskFactors.push("Low engagement volume");
  if (program.currentListeners < 5)
    riskFactors.push("Low current listenership");

  // Recommendations
  const recommendations = [];
  if (engagementTrend === "decreasing")
    recommendations.push("Consider refreshing content or adjusting schedule");
  if (recentAvg < 10) recommendations.push("Increase promotional activities");
  if (program.currentListeners < 5)
    recommendations.push("Review program timing and target audience");
  if (engagementTrend === "increasing")
    recommendations.push("Maintain current content strategy");

  return {
    expectedEngagement,
    engagementTrend,
    predictedAudience,
    riskFactors:
      riskFactors.length > 0 ? riskFactors : ["No major risks identified"],
    recommendations:
      recommendations.length > 0
        ? recommendations
        : ["Continue current strategies"],
  };
}

export default {
  getDashboardAnalytics,
  getProgramAnalytics,
  getEngagementTrends,
  generatePDFReport,
  saveAnalyticsReport,
  getSavedReports,
};
