import cron from "node-cron";
import YoutubeLiveStream from "../models/YoutubeLiveStream.js";
import { syncStreamStats, syncStreamChat } from "../services/youtubeService.js";
import { refreshStoredAnalytics } from "../services/youtubeAnalyticsService.js";

/**
 * Background YouTube Live Collector
 * ─────────────────────────────────
 * Mirrors the existing meetingScheduler pattern (node-cron). Runs on an
 * interval and, for every actively-monitored stream:
 *
 *   1. Refreshes stats (views / likes / concurrent viewers / live status)
 *   2. Pulls NEW live chat messages (dedup + sentiment) — respecting
 *      YouTube's pollingIntervalMillis so we never exceed quota
 *   3. Recomputes analytics and broadcasts `analyticsUpdated`
 *
 * Quota safety:
 *   • Only streams with monitoringEnabled === true are touched.
 *   • Streams that are not live are stat-synced occasionally (to detect when
 *     they go live / end) but their chat is skipped.
 *   • Chat polling honours each stream's nextChatPollAt window.
 *
 * @param {object} io  socket.io instance (so events reach the frontend)
 */
export const initializeYoutubeCollector = (io) => {
  // Run every minute. The per-stream poll window does the fine-grained pacing.
  cron.schedule("* * * * *", async () => {
    try {
      const streams = await YoutubeLiveStream.find({
        monitoringEnabled: true,
        liveStatus: { $in: ["live", "upcoming", "unknown"] },
      });

      if (streams.length === 0) return;

      for (const stream of streams) {
        try {
          // 1) stats + live status
          await syncStreamStats(stream, io);

          // 2) chat (only meaningful when actually live)
          if (stream.isLiveNow && stream.youtubeLiveChatId) {
            await syncStreamChat(stream, io);

            // 3) analytics broadcast
            const analytics = await refreshStoredAnalytics(stream._id);
            io?.to(`youtube-${stream._id}`).emit("analyticsUpdated", {
              streamId: stream._id,
              analytics: {
                totalMessages: analytics.totalMessages,
                positivePercentage: analytics.positivePercentage,
                negativePercentage: analytics.negativePercentage,
                neutralPercentage: analytics.neutralPercentage,
                engagementScore: analytics.engagementScore,
                engagementGrowth: analytics.engagementGrowth,
              },
            });
          }
        } catch (streamErr) {
          // Back off this stream on quota errors; keep the loop alive.
          if (
            streamErr.code === "quotaExceeded" ||
            streamErr.code === "rateLimitExceeded"
          ) {
            console.warn(
              `⚠ YouTube quota hit while syncing ${stream._id} — backing off`,
            );
            break; // stop this tick entirely to protect remaining quota
          }
          console.error(
            `❌ YouTube collector error for stream ${stream._id}:`,
            streamErr.message,
          );
        }
      }
    } catch (error) {
      console.error("❌ YouTube collector tick error:", error);
    }
  });

  console.log("✅ YouTube live collector initialized");
};

export default { initializeYoutubeCollector };
