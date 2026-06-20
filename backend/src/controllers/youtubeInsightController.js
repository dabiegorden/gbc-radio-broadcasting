import PDFDocument from "pdfkit";
import {
  buildDashboardInsights,
  buildTrends,
} from "../services/youtubeAnalyticsService.js";

/**
 * YouTube Insight Controller
 * ──────────────────────────
 * Platform-wide YouTube Live analytics for the admin
 * /dashboard/youtube-analysis-insight page. Aggregates every monitored stream
 * + its live chat into a single overview (the per-stream realtime view lives in
 * youtubeStreamController.js). Mirrors the Radio "Analytics & Insights" feature,
 * including a downloadable PDF report.
 */

/**
 * Aggregated dashboard analytics across all YouTube streams.
 * GET /api/youtube/insights/dashboard?startDate=&endDate=
 */
export const getYoutubeDashboard = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const analytics = await buildDashboardInsights({ startDate, endDate });

    res.json({
      success: true,
      message: "YouTube dashboard analytics retrieved",
      analytics,
    });
  } catch (error) {
    console.error("getYoutubeDashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching YouTube dashboard analytics",
      error: error.message,
    });
  }
};

/**
 * Daily chat/sentiment trends across all YouTube streams.
 * GET /api/youtube/insights/trends?days=30&period=daily
 */
export const getYoutubeTrends = async (req, res) => {
  try {
    const { days = 30, period = "daily" } = req.query;
    const trends = await buildTrends({ days, period });

    res.json({
      success: true,
      message: "YouTube trends retrieved",
      trends,
      period,
      days: parseInt(days, 10),
    });
  } catch (error) {
    console.error("getYoutubeTrends error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching YouTube trends",
      error: error.message,
    });
  }
};

/**
 * Downloadable PDF report of the YouTube analytics overview.
 * GET /api/youtube/insights/report/pdf?startDate=&endDate=&includeStreams=true
 */
export const generateYoutubePDFReport = async (req, res) => {
  try {
    const { startDate, endDate, includeStreams } = req.query;

    const { summary, sentimentBreakdown, mostActiveUsers, trendingKeywords, topStreams, insights } =
      await buildDashboardInsights({ startDate, endDate });

    // ── Theme (YouTube red accent over the dashboard purple) ───────────────
    const COLOR = {
      primary: "#dc2626",
      primaryDark: "#7f1d1d",
      accent: "#7c3aed",
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

    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const PAGE_W = doc.page.width;
    const M = doc.page.margins.left;
    const CONTENT_W = PAGE_W - M * 2;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=youtube-analytics-report-${Date.now()}.pdf`,
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
      doc
        .moveTo(M, doc.y + 6)
        .lineTo(M + CONTENT_W, doc.y + 6)
        .lineWidth(1)
        .stroke(COLOR.border);
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
      .fillColor("#fecaca")
      .fontSize(14)
      .font("Helvetica")
      .text("YouTube Live Analytics & Insights Report", M, 62);
    doc
      .fillColor("#fca5a5")
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
    doc.y = 140;

    // ── Metric cards ───────────────────────────────────────────────────────
    const cards = [
      { label: "Total Streams", value: `${summary.totalStreams} (${summary.liveStreams} live)` },
      { label: "Total Views", value: summary.totalViews },
      { label: "Total Likes", value: summary.totalLikes },
      { label: "Live Chat Messages", value: summary.totalMessages },
      { label: "Current Viewers", value: summary.currentViewers },
      { label: "Avg Engagement", value: `${summary.avgEngagementScore.toFixed(2)}%` },
    ];
    const cardGap = 12;
    const cardW = (CONTENT_W - cardGap * 2) / 3;
    const cardH = 56;
    cards.forEach((card, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = M + col * (cardW + cardGap);
      const y = doc.y + row * (cardH + cardGap);
      doc.roundedRect(x, y, cardW, cardH, 8).fill(COLOR.light);
      doc.roundedRect(x, y, cardW, cardH, 8).lineWidth(1).stroke(COLOR.border);
      doc
        .fillColor(COLOR.muted)
        .fontSize(8)
        .font("Helvetica-Bold")
        .text(card.label.toUpperCase(), x + 12, y + 10, { width: cardW - 24 });
      doc
        .fillColor(COLOR.primary)
        .fontSize(18)
        .font("Helvetica-Bold")
        .text(String(card.value), x + 12, y + 26, { width: cardW - 24 });
    });
    doc.y += Math.ceil(cards.length / 3) * (cardH + cardGap) + 8;
    doc.fillColor(COLOR.text);

    // ── Sentiment analysis ─────────────────────────────────────────────────
    sectionTitle("Live Chat Sentiment Analysis");
    const sentTotal = sentimentBreakdown.reduce((a, b) => a + b.count, 0);
    if (sentTotal === 0) {
      doc
        .fontSize(10)
        .font("Helvetica-Oblique")
        .fillColor(COLOR.muted)
        .text(
          "No chat sentiment data for this period. Sentiment is generated automatically from live chat messages.",
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
        sentimentBreakdown.map((x) => [x._id, x]),
      );

      doc
        .fillColor(COLOR.muted)
        .fontSize(10)
        .font("Helvetica")
        .text(
          `Based on ${sentTotal} analyzed message${sentTotal === 1 ? "" : "s"}.`,
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
      doc
        .roundedRect(M, barY, CONTENT_W, barH, 2)
        .lineWidth(0.5)
        .stroke(COLOR.border);
      doc.y = barY + barH + 12;

      order.forEach((key) => {
        const count = byId[key]?.count || 0;
        const pct = sentTotal > 0 ? (count / sentTotal) * 100 : 0;
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
            `${count} message${count === 1 ? "" : "s"}  -  ${pct.toFixed(1)}%`,
            M + 120,
            y,
            { width: CONTENT_W - 120 },
          );
        doc.y = y + 18;
      });
      doc.moveDown(0.5);
    }

    // ── Trending keywords ──────────────────────────────────────────────────
    sectionTitle("Trending Keywords");
    if (!trendingKeywords.length) {
      doc
        .fontSize(10)
        .font("Helvetica-Oblique")
        .fillColor(COLOR.muted)
        .text("No keywords available for this period.");
      doc.moveDown(1);
    } else {
      const maxCount = trendingKeywords[0].count || 1;
      trendingKeywords.slice(0, 12).forEach((k) => {
        const y = doc.y;
        const labelW = 140;
        const barMaxW = CONTENT_W - labelW - 50;
        doc
          .fillColor(COLOR.text)
          .fontSize(10)
          .font("Helvetica")
          .text(k.word, M, y + 2, { width: labelW, ellipsis: true });
        doc.roundedRect(M + labelW, y, barMaxW, 12, 3).fill(COLOR.border);
        doc
          .roundedRect(
            M + labelW,
            y,
            Math.max(2, (k.count / maxCount) * barMaxW),
            12,
            3,
          )
          .fill(COLOR.accent);
        doc
          .fillColor(COLOR.muted)
          .fontSize(9)
          .font("Helvetica-Bold")
          .text(String(k.count), M + labelW + barMaxW + 8, y + 1, { width: 42 });
        doc.y = y + 20;
      });
      doc.moveDown(0.5);
    }

    // ── Most active users ──────────────────────────────────────────────────
    sectionTitle("Most Active Chat Participants");
    if (!mostActiveUsers.length) {
      doc
        .fontSize(10)
        .font("Helvetica-Oblique")
        .fillColor(COLOR.muted)
        .text("No chat participants for this period.");
      doc.moveDown(1);
    } else {
      mostActiveUsers.slice(0, 10).forEach((u, i) => {
        const y = doc.y;
        doc
          .fillColor(COLOR.muted)
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(`${i + 1}.`, M, y, { width: 20 });
        doc
          .fillColor(COLOR.text)
          .font("Helvetica")
          .text(u.user, M + 22, y, { width: CONTENT_W - 120, ellipsis: true });
        doc
          .fillColor(COLOR.accent)
          .font("Helvetica-Bold")
          .text(`${u.messages} msg`, M + CONTENT_W - 90, y, {
            width: 90,
            align: "right",
          });
        doc.y = y + 16;
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

    // ── Top streams (optional) ─────────────────────────────────────────────
    if (includeStreams === "true") {
      doc.addPage();
      sectionTitle("Top Stream Performance");

      if (!topStreams.length) {
        doc
          .fontSize(10)
          .font("Helvetica-Oblique")
          .fillColor(COLOR.muted)
          .text("No streams found.");
      } else {
        const cols = [
          { label: "#", w: 24 },
          { label: "Stream", w: 190 },
          { label: "Views", w: 70 },
          { label: "Likes", w: 60 },
          { label: "Messages", w: 70 },
          { label: "Status", w: CONTENT_W - 414 },
        ];
        let hx = M;
        const hy = doc.y;
        doc.rect(M, hy, CONTENT_W, 20).fill(COLOR.primary);
        doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold");
        cols.forEach((c) => {
          doc.text(c.label, hx + 6, hy + 6, { width: c.w - 6 });
          hx += c.w;
        });
        doc.y = hy + 20;

        topStreams.forEach((stream, index) => {
          if (doc.y > doc.page.height - 60) doc.addPage();
          const ry = doc.y;
          if (index % 2 === 0) doc.rect(M, ry, CONTENT_W, 20).fill(COLOR.light);
          let cx = M;
          const cells = [
            String(index + 1),
            stream.title || "-",
            String(stream.views ?? 0),
            String(stream.likes ?? 0),
            String(stream.totalMessages ?? 0),
            stream.liveStatus || "-",
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
      }
    }

    // ── Footer on every page ───────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const fy = doc.page.height - 38;
      doc
        .moveTo(M, fy)
        .lineTo(M + CONTENT_W, fy)
        .lineWidth(0.5)
        .stroke(COLOR.border);
      doc
        .fillColor(COLOR.muted)
        .fontSize(8)
        .font("Helvetica")
        .text("GBC Radio - YouTube Analytics - Confidential.", M, fy + 8, {
          width: CONTENT_W / 2,
          align: "left",
        });
      doc.text(`Page ${i + 1} of ${range.count}`, M + CONTENT_W / 2, fy + 8, {
        width: CONTENT_W / 2,
        align: "right",
      });
    }

    doc.end();
  } catch (error) {
    console.error("generateYoutubePDFReport error:", error);
    res.status(500).json({
      success: false,
      message: "Error generating YouTube PDF report",
      error: error.message,
    });
  }
};

export default {
  getYoutubeDashboard,
  getYoutubeTrends,
  generateYoutubePDFReport,
};
