import jwt from "jsonwebtoken";
import {
  getAuthUrl,
  exchangeCodeForTokens,
  fetchChannel,
  saveTokens,
  getValidAccessToken,
  getConnection,
} from "../services/youtubeOAuthService.js";
import {
  createYoutubeBroadcast,
  createLiveStream,
  bindBroadcast,
  createStreamRecordFromBroadcast,
} from "../services/youtubeBroadcastService.js";
import YoutubeOAuthToken from "../models/YoutubeOAuthToken.js";

/**
 * YouTube Broadcast Controller  (Phase 2 — "Go Live" from the dashboard)
 * ──────────────────────────────────────────────────────────────────────
 * Endpoints:
 *   GET  /youtube/auth        → returns the Google consent URL (frontend redirects)
 *   GET  /youtube/callback    → Google redirects here; we store tokens
 *   POST /youtube/go-live     → creates broadcast + stream + bind, then hands
 *                               off to the existing analytics collector
 *   GET  /youtube/connection  → whether the current user has connected Google
 */

const FRONTEND = process.env.CORS_ORIGIN || "";

/**
 * GET /youtube/auth  (Private)
 * Returns the Google OAuth consent URL. The frontend does the redirect.
 * `state` is a short-lived signed token identifying the user, so the public
 * callback can map the Google response back to the right account.
 */
export const startYoutubeAuth = async (req, res) => {
  try {
    const state = jwt.sign(
      { uid: req.user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "10m" },
    );
    const url = getAuthUrl(state);
    res.json({ success: true, url });
  } catch (error) {
    console.error("startYoutubeAuth error:", error);
    res
      .status(500)
      .json({ success: false, message: error.message || "OAuth init failed" });
  }
};

/**
 * GET /youtube/callback  (Public — Google redirects here)
 * Exchanges the code for tokens, stores them, then bounces the user back to
 * the dashboard. Never returns tokens in the response.
 */
export const youtubeAuthCallback = async (req, res) => {
  const { code, state, error } = req.query;
  const back = (q) => res.redirect(`${FRONTEND}/dashboard/youtube?${q}`);

  if (error) return back(`youtube=denied`);
  if (!code || !state) return back(`youtube=error`);

  try {
    // Identify the user from the signed state token.
    const { uid } = jwt.verify(state, process.env.JWT_SECRET);

    const tokens = await exchangeCodeForTokens(code);
    const channel = await fetchChannel(tokens.access_token);
    await saveTokens(uid, tokens, channel);

    return back(`youtube=connected`);
  } catch (err) {
    console.error("youtubeAuthCallback error:", err);
    return back(`youtube=error`);
  }
};

/**
 * POST /youtube/go-live  (Private/Admin)
 * Body: { title, description?, scheduledStartTime? }
 *
 * Creates the broadcast, the RTMP stream, binds them, then writes a
 * YoutubeLiveStream record so the existing collector starts monitoring it.
 */
export const goLive = async (req, res) => {
  try {
    const { title, description, scheduledStartTime } = req.body;
    if (!title) {
      return res
        .status(400)
        .json({ success: false, message: "A broadcast title is required" });
    }

    // 1) Valid access token (auto-refreshes; throws NOT_CONNECTED if missing)
    const accessToken = await getValidAccessToken(req.user._id);

    // 2) Create the broadcast (video), 3) the RTMP stream, 4) bind them
    const broadcast = await createYoutubeBroadcast(accessToken, {
      title,
      description,
      scheduledStartTime,
    });
    const stream = await createLiveStream(accessToken, { title });
    await bindBroadcast(accessToken, broadcast.broadcastId, stream.streamId);

    // Channel title for the analytics record (best-effort)
    const conn = await getConnection(req.user._id);

    // 5) Hand off to the EXISTING analytics pipeline (no duplication)
    const record = await createStreamRecordFromBroadcast({
      broadcast,
      stream,
      ownerUserId: req.user._id,
      channelTitle: conn.channelTitle,
    });

    const videoId = broadcast.videoId;

    // SECURITY: streamKey (stream.streamName) is intentionally NOT returned.
    // The host goes live from YouTube Studio; we only expose public details.
    return res.status(201).json({
      success: true,
      broadcastId: broadcast.broadcastId,
      videoId,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      youtubeStudioUrl: `https://studio.youtube.com/video/${videoId}/livestreaming`,
      status: broadcast.status,
      streamId: record._id, // our DB id → use with GET /youtube/:id for analytics
      streamingDetails: {
        ingestionAddress: stream.ingestionAddress, // public RTMP URL only
      },
    });
  } catch (error) {
    console.error("goLive error:", error);

    // Friendly mapping for the common failure modes.
    if (error.code === "NOT_CONNECTED") {
      return res.status(401).json({
        success: false,
        code: "NOT_CONNECTED",
        message: "Connect your Google account first (/youtube/auth)",
      });
    }
    if (error.code === "liveStreamingNotEnabled") {
      return res.status(403).json({
        success: false,
        code: "liveStreamingNotEnabled",
        message:
          "This channel is not enabled for live streaming. Enable it in YouTube Studio and try again.",
      });
    }
    if (error.code === "quotaExceeded" || error.code === "rateLimitExceeded") {
      return res.status(429).json({
        success: false,
        code: error.code,
        message: "YouTube API quota exceeded — try again later.",
      });
    }
    if (error.code === "invalid_grant") {
      // Refresh token revoked/expired → force reconnect.
      await YoutubeOAuthToken.deleteOne({ user: req.user._id }).catch(() => {});
      return res.status(401).json({
        success: false,
        code: "NOT_CONNECTED",
        message: "Google session expired — please reconnect your account.",
      });
    }

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to create live broadcast",
    });
  }
};

/**
 * GET /youtube/connection  (Private)
 * Lets the frontend show "Connected as <channel>" vs a Connect button.
 */
export const connectionStatus = async (req, res) => {
  try {
    const conn = await getConnection(req.user._id);
    res.json({ success: true, ...conn });
  } catch (error) {
    console.error("connectionStatus error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to read connection status" });
  }
};

export default {
  startYoutubeAuth,
  youtubeAuthCallback,
  goLive,
  connectionStatus,
};
