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
          _id: "$engagementType",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get sentiment breakdown
    const sentimentBreakdown = await Engagement.aggregate([
      {
        $match: {
          ...dateFilter,
          "comment.sentiment": { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: "$comment.sentiment",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get average engagement score
    const avgEngagementScore = await Engagement.aggregate([
      {
        $match: {
          ...dateFilter,
          "comment.engagementScore": { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: null,
          avgScore: { $avg: "$comment.engagementScore" },
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

    const summary = {
      totalUsers,
      activeUsers,
      totalPrograms,
      totalEngagements,
      livePrograms,
      totalListeners: listenerStats[0]?.totalListeners || 0,
      currentListeners: listenerStats[0]?.currentListeners || 0,
      avgEngagementScore: avgEngagementScore[0]?.avgScore || 0,
    };

    // Generate AI-style insights (risk factors + recommendations) from the data
    const insights = generateDashboardInsights(summary, sentimentBreakdown);

    res.json({
      success: true,
      message: "Dashboard analytics retrieved",
      analytics: {
        summary,
        engagementBreakdown,
        sentimentBreakdown,
        categoryPerformance,
        insights,
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
          avgScore: { $avg: "$comment.engagementScore" },
          maxScore: { $max: "$comment.engagementScore" },
          minScore: { $min: "$comment.engagementScore" },
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
          avgScore: { $avg: "$comment.engagementScore" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get sentiment analysis
    const sentimentAnalysis = await Engagement.aggregate([
      {
        $match: {
          ...dateFilter,
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

    // Get engagement type breakdown
    const typeBreakdown = await Engagement.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$engagementType",
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
          avgScore: { $avg: "$comment.engagementScore" },
          positiveCount: {
            $sum: {
              $cond: [{ $eq: ["$comment.sentiment", "positive"] }, 1, 0],
            },
          },
          negativeCount: {
            $sum: {
              $cond: [{ $eq: ["$comment.sentiment", "negative"] }, 1, 0],
            },
          },
          neutralCount: {
            $sum: {
              $cond: [{ $eq: ["$comment.sentiment", "neutral"] }, 1, 0],
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

    const listenerStats = await Program.aggregate([
      {
        $group: {
          _id: null,
          totalListeners: { $sum: "$totalListeners" },
          currentListeners: { $sum: "$currentListeners" },
        },
      },
    ]);

    const avgScoreAgg = await Engagement.aggregate([
      {
        $match: {
          ...dateFilter,
          "comment.engagementScore": { $exists: true, $ne: null },
        },
      },
      { $group: { _id: null, avgScore: { $avg: "$comment.engagementScore" } } },
    ]);

    const engagementBreakdown = await Engagement.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$engagementType",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const sentimentBreakdown = await Engagement.aggregate([
      {
        $match: {
          ...dateFilter,
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

    const summary = {
      totalUsers,
      totalPrograms,
      totalEngagements,
      livePrograms,
      totalListeners: listenerStats[0]?.totalListeners || 0,
      currentListeners: listenerStats[0]?.currentListeners || 0,
      avgEngagementScore: avgScoreAgg[0]?.avgScore || 0,
    };

    const insights = generateDashboardInsights(summary, sentimentBreakdown);

    // ── Per-program engagement breakdown (comments / likes / shares) ──────────
    // The supervisor wants each show analysed individually instead of having
    // all programmes lumped together. We group engagements by program + type.
    const perProgramAgg = await Engagement.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: { program: "$program", type: "$engagementType" },
          count: { $sum: 1 },
          avgScore: { $avg: "$comment.engagementScore" },
        },
      },
    ]);

    // programId -> { comment, like, share, listening, follow, totalScore, scored }
    const programStatsMap = new Map();
    perProgramAgg.forEach((row) => {
      const pid = row._id.program?.toString();
      if (!pid) return;
      if (!programStatsMap.has(pid)) {
        programStatsMap.set(pid, {
          comment: 0,
          like: 0,
          share: 0,
          listening: 0,
          follow: 0,
          avgScore: 0,
        });
      }
      const entry = programStatsMap.get(pid);
      if (row._id.type in entry) entry[row._id.type] = row.count;
      if (row._id.type === "comment" && row.avgScore != null) {
        entry.avgScore = row.avgScore;
      }
    });

    // Attach the stats to each program and bucket by time-of-day show slot.
    const allPrograms = await Program.find().sort({ scheduleStartTime: 1 });
    const showSlots = {
      "Morning Shows": [],
      "Afternoon Shows": [],
      "Evening Shows": [],
    };
    allPrograms.forEach((p) => {
      const stats = programStatsMap.get(p._id.toString()) || {
        comment: 0,
        like: 0,
        share: 0,
        listening: 0,
        follow: 0,
        avgScore: 0,
      };
      const slot = getShowSlot(p.scheduleStartTime);
      showSlots[slot].push({
        title: p.title,
        host: p.host,
        category: p.category,
        isLive: p.isLive,
        currentListeners: p.currentListeners || 0,
        totalListeners: p.totalListeners || 0,
        comments: stats.comment,
        likes: stats.like,
        shares: stats.share,
        avgScore: stats.avgScore || 0,
      });
    });

    // ── Theme ──────────────────────────────────────────────────────────────
    const COLOR = {
      primary: "#7c3aed",
      primaryDark: "#4c1d95",
      text: "#1e293b",
      muted: "#64748b",
      light: "#f1f5f9",
      border: "#e2e8f0",
      positive: "#22c55e",
      neutral: "#eab308",
      negative: "#ef4444",
      riskBg: "#fef2f2",
      riskText: "#b91c1c",
      recBg: "#f0fdf4",
      recText: "#15803d",
    };

    // Create PDF
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const PAGE_W = doc.page.width;
    const M = doc.page.margins.left;
    const CONTENT_W = PAGE_W - M * 2;

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=analytics-report-${Date.now()}.pdf`,
    );
    doc.pipe(res);

    // ── Drawing helpers ────────────────────────────────────────────────────
    const sectionTitle = (label) => {
      if (doc.y > doc.page.height - 140) doc.addPage();
      const y = doc.y;
      doc.rect(M, y, 4, 18).fill(COLOR.primary);
      doc
        .fillColor(COLOR.text)
        .fontSize(15)
        .font("Helvetica-Bold")
        .text(label, M + 14, y + 1);
      doc.moveTo(M, doc.y + 6).lineTo(M + CONTENT_W, doc.y + 6).lineWidth(1).stroke(COLOR.border);
      doc.moveDown(1);
      doc.fillColor(COLOR.text);
    };

    // ── Header banner ──────────────────────────────────────────────────────
    doc.rect(0, 0, PAGE_W, 110).fill(COLOR.primaryDark);
    doc
      .fillColor("#ffffff")
      .fontSize(26)
      .font("Helvetica-Bold")
      .text("GBC Radio", M, 30);
    doc
      .fillColor("#e9d5ff")
      .fontSize(14)
      .font("Helvetica")
      .text("Analytics & Insights Report", M, 62);
    doc
      .fillColor("#c4b5fd")
      .fontSize(9)
      .text(`Generated: ${new Date().toLocaleString()}`, M, 84);
    if (startDate && endDate) {
      doc.text(
        `Reporting period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`,
        M,
        96,
      );
    } else {
      doc.text("Reporting period: All time", M, 96);
    }

    doc.fillColor(COLOR.text);
    doc.y = 135;

    // ── Overview / Metric cards ────────────────────────────────────────────
    sectionTitle("Overview");

    const cards = [
      { label: "Total Users", value: totalUsers },
      { label: "Total Programs", value: `${totalPrograms} (${livePrograms} live)` },
      { label: "Engagements", value: totalEngagements },
      { label: "Total Listeners", value: summary.totalListeners },
      {
        label: "Current Listeners",
        value: summary.currentListeners,
      },
      {
        label: "Avg Engagement",
        value: `${summary.avgEngagementScore.toFixed(1)}/100`,
      },
    ];
    const cardGap = 14;
    const cardW = (CONTENT_W - cardGap * 2) / 3;
    const cardH = 64;
    const cardsTop = doc.y;
    cards.forEach((card, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = M + col * (cardW + cardGap);
      const y = cardsTop + row * (cardH + cardGap);
      doc.roundedRect(x, y, cardW, cardH, 8).fill(COLOR.light);
      doc.roundedRect(x, y, cardW, cardH, 8).lineWidth(1).stroke(COLOR.border);
      doc
        .fillColor(COLOR.muted)
        .fontSize(8)
        .font("Helvetica-Bold")
        .text(card.label.toUpperCase(), x + 12, y + 12, { width: cardW - 24 });
      doc
        .fillColor(COLOR.primary)
        .fontSize(17)
        .font("Helvetica-Bold")
        .text(String(card.value), x + 12, y + 30, { width: cardW - 24 });
    });
    doc.y = cardsTop + Math.ceil(cards.length / 3) * (cardH + cardGap) + 10;
    doc.fillColor(COLOR.text);

    // ── Engagement breakdown ───────────────────────────────────────────────
    sectionTitle("Engagement Breakdown");
    if (engagementBreakdown.length === 0) {
      doc.fontSize(10).font("Helvetica-Oblique").fillColor(COLOR.muted)
        .text("No engagement data for this period.");
      doc.moveDown(1);
    } else {
      const totalEng = engagementBreakdown.reduce((s, e) => s + e.count, 0);
      engagementBreakdown.forEach((item) => {
        const pct = totalEng > 0 ? (item.count / totalEng) * 100 : 0;
        const y = doc.y;
        const labelW = 120;
        const barMaxW = CONTENT_W - labelW - 70;
        doc
          .fillColor(COLOR.text)
          .fontSize(10)
          .font("Helvetica")
          .text(item._id || "unknown", M, y + 2, { width: labelW });
        doc.roundedRect(M + labelW, y, barMaxW, 12, 3).fill(COLOR.border);
        doc
          .roundedRect(M + labelW, y, Math.max(2, (pct / 100) * barMaxW), 12, 3)
          .fill(COLOR.primary);
        doc
          .fillColor(COLOR.muted)
          .fontSize(9)
          .font("Helvetica-Bold")
          .text(
            `${item.count}  (${pct.toFixed(0)}%)`,
            M + labelW + barMaxW + 8,
            y + 1,
            { width: 62 },
          );
        doc.y = y + 20;
      });
      doc.moveDown(0.5);
    }

    // ── Sentiment analysis ─────────────────────────────────────────────────
    sectionTitle("Sentiment Analysis");
    const sentTotal = sentimentBreakdown.reduce((s, e) => s + e.count, 0);
    if (sentTotal === 0) {
      doc.fontSize(10).font("Helvetica-Oblique").fillColor(COLOR.muted)
        .text(
          "No sentiment data available for this period. Sentiment is generated automatically from listener comments.",
          { width: CONTENT_W },
        );
      doc.moveDown(1);
    } else {
      const order = ["positive", "neutral", "negative"];
      const sentColor = {
        positive: COLOR.positive,
        neutral: COLOR.neutral,
        negative: COLOR.negative,
      };
      const byId = Object.fromEntries(
        sentimentBreakdown.map((s) => [s._id, s]),
      );

      doc
        .fillColor(COLOR.muted)
        .fontSize(10)
        .font("Helvetica")
        .text(
          `Based on ${sentTotal} analyzed comment${sentTotal === 1 ? "" : "s"}.`,
        );
      doc.moveDown(0.8);

      // Stacked percentage bar
      const barY = doc.y;
      const barH = 18;
      let cursorX = M;
      order.forEach((key) => {
        const count = byId[key]?.count || 0;
        if (count === 0) return;
        const w = (count / sentTotal) * CONTENT_W;
        doc.rect(cursorX, barY, w, barH).fill(sentColor[key]);
        cursorX += w;
      });
      doc.roundedRect(M, barY, CONTENT_W, barH, 2).lineWidth(0.5).stroke(COLOR.border);
      doc.y = barY + barH + 12;

      // Per-sentiment rows
      order.forEach((key) => {
        const row = byId[key];
        const count = row?.count || 0;
        const pct = sentTotal > 0 ? (count / sentTotal) * 100 : 0;
        const avg = row?.avgScore != null ? row.avgScore.toFixed(1) : "-";
        const y = doc.y;
        doc.roundedRect(M, y, 10, 10, 2).fill(sentColor[key]);
        doc
          .fillColor(COLOR.text)
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(key.charAt(0).toUpperCase() + key.slice(1), M + 18, y);
        doc
          .fillColor(COLOR.muted)
          .font("Helvetica")
          .text(
            `${count} comment${count === 1 ? "" : "s"}  -  ${pct.toFixed(1)}%  -  avg score ${avg}/100`,
            M + 120,
            y,
            { width: CONTENT_W - 120 },
          );
        doc.y = y + 18;
      });
      doc.moveDown(0.5);
    }

    // ── AI insights ────────────────────────────────────────────────────────
    sectionTitle("AI Insights & Recommendations");

    const drawBulletBox = (heading, items, bg, fg) => {
      if (doc.y > doc.page.height - 120) doc.addPage();
      doc
        .fillColor(COLOR.text)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text(heading);
      doc.moveDown(0.4);
      items.forEach((item) => {
        const padding = 8;
        const textW = CONTENT_W - padding * 2 - 14;
        doc.font("Helvetica").fontSize(10);
        const textH = doc.heightOfString(item, { width: textW });
        const boxH = textH + padding * 2;
        if (doc.y + boxH > doc.page.height - 60) doc.addPage();
        const y = doc.y;
        doc.roundedRect(M, y, CONTENT_W, boxH, 6).fill(bg);
        doc.circle(M + padding + 3, y + padding + 4, 2.5).fill(fg);
        doc
          .fillColor(fg)
          .font("Helvetica")
          .fontSize(10)
          .text(item, M + padding + 14, y + padding, { width: textW });
        doc.y = y + boxH + 6;
      });
      doc.moveDown(0.5);
    };

    drawBulletBox(
      "Risk Factors",
      insights.riskFactors,
      COLOR.riskBg,
      COLOR.riskText,
    );
    drawBulletBox(
      "Recommendations",
      insights.recommendations,
      COLOR.recBg,
      COLOR.recText,
    );

    // ── Per-programme analysis grouped by show slot ────────────────────────
    // Each programme is analysed on its own (comments / likes / shares /
    // listeners) and grouped into Morning / Afternoon / Evening shows so the
    // supervisor can read each show's performance independently.
    if (includePrograms === "true") {
      doc.addPage();
      sectionTitle("Programme Analysis by Show");

      doc
        .fillColor(COLOR.muted)
        .fontSize(10)
        .font("Helvetica")
        .text(
          "Each programme is broken down individually by its broadcast slot.",
          { width: CONTENT_W },
        );
      doc.moveDown(1);

      const slotOrder = [
        "Morning Shows",
        "Afternoon Shows",
        "Evening Shows",
      ];

      const cols = [
        { key: "title", label: "Programme", w: 150 },
        { key: "host", label: "Host", w: 95 },
        { key: "comments", label: "Comments", w: 60 },
        { key: "likes", label: "Likes", w: 50 },
        { key: "shares", label: "Shares", w: 50 },
        { key: "listeners", label: "Listeners", w: CONTENT_W - 405 },
      ];

      slotOrder.forEach((slot) => {
        const rows = showSlots[slot] || [];

        // Slot heading
        if (doc.y > doc.page.height - 120) doc.addPage();
        doc.moveDown(0.4);
        doc
          .fillColor(COLOR.primaryDark)
          .fontSize(13)
          .font("Helvetica-Bold")
          .text(slot, M, doc.y);
        doc.moveDown(0.4);

        if (rows.length === 0) {
          doc
            .fillColor(COLOR.muted)
            .fontSize(10)
            .font("Helvetica-Oblique")
            .text("No programmes scheduled in this slot.", M, doc.y, {
              width: CONTENT_W,
            });
          doc.moveDown(0.8);
          return;
        }

        // Table header
        let hx = M;
        const hy = doc.y;
        doc.rect(M, hy, CONTENT_W, 20).fill(COLOR.primary);
        doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold");
        cols.forEach((c) => {
          doc.text(c.label, hx + 6, hy + 6, { width: c.w - 6 });
          hx += c.w;
        });
        doc.y = hy + 20;

        // Slot totals accumulator
        const totals = { comments: 0, likes: 0, shares: 0, listeners: 0 };

        rows.forEach((r, index) => {
          if (doc.y > doc.page.height - 60) {
            doc.addPage();
          }
          const ry = doc.y;
          if (index % 2 === 0) {
            doc.rect(M, ry, CONTENT_W, 20).fill(COLOR.light);
          }
          totals.comments += r.comments;
          totals.likes += r.likes;
          totals.shares += r.shares;
          totals.listeners += r.totalListeners;

          let cx = M;
          const cells = [
            r.title || "-",
            r.host || "-",
            String(r.comments),
            String(r.likes),
            String(r.shares),
            String(r.totalListeners),
          ];
          doc.fillColor(COLOR.text).fontSize(9).font("Helvetica");
          cells.forEach((val, i) => {
            doc.text(val, cx + 6, ry + 6, {
              width: cols[i].w - 8,
              ellipsis: true,
            });
            cx += cols[i].w;
          });
          doc.y = ry + 20;
        });

        // Slot totals row
        if (doc.y > doc.page.height - 60) doc.addPage();
        const ty = doc.y;
        doc.rect(M, ty, CONTENT_W, 20).fill(COLOR.border);
        let tx = M;
        const totalCells = [
          `${slot} total`,
          "",
          String(totals.comments),
          String(totals.likes),
          String(totals.shares),
          String(totals.listeners),
        ];
        doc.fillColor(COLOR.text).fontSize(9).font("Helvetica-Bold");
        totalCells.forEach((val, i) => {
          doc.text(val, tx + 6, ty + 6, {
            width: cols[i].w - 8,
            ellipsis: true,
          });
          tx += cols[i].w;
        });
        doc.y = ty + 28;
      });
    }

    // ── Footer on every page ───────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const fy = doc.page.height - 38;
      doc.moveTo(M, fy).lineTo(M + CONTENT_W, fy).lineWidth(0.5).stroke(COLOR.border);
      doc
        .fillColor(COLOR.muted)
        .fontSize(8)
        .font("Helvetica")
        .text(
          "GBC Radio - Confidential. For internal use only.",
          M,
          fy + 8,
          { width: CONTENT_W / 2, align: "left" },
        );
      doc.text(
        `Page ${i + 1} of ${range.count}`,
        M + CONTENT_W / 2,
        fy + 8,
        { width: CONTENT_W / 2, align: "right" },
      );
    }

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
 * Bucket a program into a broadcast show slot based on its scheduled start time.
 * Morning  : 00:00 – 11:59
 * Afternoon: 12:00 – 16:59
 * Evening  : 17:00 – 23:59
 */
function getShowSlot(date) {
  if (!date) return "Morning Shows";
  const hour = new Date(date).getHours();
  if (hour < 12) return "Morning Shows";
  if (hour < 17) return "Afternoon Shows";
  return "Evening Shows";
}

/**
 * Generate dashboard-level AI insights: risk factors and recommendations.
 * Derived from the aggregated summary + sentiment breakdown so the admin
 * "Risk Factors" and "AI Recommendations" panels always have content.
 */
function generateDashboardInsights(summary, sentimentBreakdown = []) {
  const riskFactors = [];
  const recommendations = [];

  const avgScore = summary.avgEngagementScore || 0;
  const totalEngagements = summary.totalEngagements || 0;
  const livePrograms = summary.livePrograms || 0;
  const currentListeners = summary.currentListeners || 0;

  // Sentiment ratios
  const sentimentTotal = sentimentBreakdown.reduce(
    (sum, s) => sum + (s.count || 0),
    0,
  );
  const negative =
    sentimentBreakdown.find((s) => s._id === "negative")?.count || 0;
  const positive =
    sentimentBreakdown.find((s) => s._id === "positive")?.count || 0;
  const negativeRatio = sentimentTotal > 0 ? negative / sentimentTotal : 0;
  const positiveRatio = sentimentTotal > 0 ? positive / sentimentTotal : 0;

  // ── Risk factors ──────────────────────────────────────────────────────────
  if (avgScore < 50) {
    riskFactors.push(
      `Low average engagement score (${avgScore.toFixed(1)}/100)`,
    );
  }
  if (livePrograms === 0) {
    riskFactors.push("No programs are currently live");
  }
  if (currentListeners < 10) {
    riskFactors.push(`Low current listener count (${currentListeners})`);
  }
  if (negativeRatio > 0.3) {
    riskFactors.push(
      `High negative sentiment (${(negativeRatio * 100).toFixed(0)}% of comments)`,
    );
  }
  if (totalEngagements === 0) {
    riskFactors.push("No engagement recorded in the selected period");
  }

  // ── Recommendations ───────────────────────────────────────────────────────
  if (totalEngagements < 100) {
    recommendations.push(
      "Increase social media promotion to boost engagement",
    );
  }
  if (livePrograms < 3) {
    recommendations.push(
      "Schedule more live programs to increase listener engagement",
    );
  }
  if (avgScore > 70) {
    recommendations.push(
      "Excellent engagement! Consider expanding to more time slots",
    );
  }
  if (negativeRatio > 0.3) {
    recommendations.push(
      "Review recent feedback and address recurring listener concerns",
    );
  }
  if (positiveRatio > 0.6) {
    recommendations.push(
      "Sentiment is strongly positive — amplify popular content formats",
    );
  }

  return {
    riskFactors:
      riskFactors.length > 0 ? riskFactors : ["No major risks identified"],
    recommendations:
      recommendations.length > 0
        ? recommendations
        : ["Continue current strategies and monitor engagement"],
    sentimentSummary: {
      total: sentimentTotal,
      positive,
      negative,
      neutral:
        sentimentBreakdown.find((s) => s._id === "neutral")?.count || 0,
      positiveRatio,
      negativeRatio,
    },
  };
}

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
