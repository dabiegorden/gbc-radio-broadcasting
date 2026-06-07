/**
 * YouTube Data API v3 — low-level wrapper
 * ───────────────────────────────────────
 * This module is the ONLY place that talks directly to Google's
 * `https://www.googleapis.com/youtube/v3/...` endpoints. Everything
 * higher up (services, controllers, the background collector) goes
 * through these functions so quota handling and error handling live
 * in one spot.
 *
 * Endpoints used:
 *   GET /videos              → snippet, statistics, liveStreamingDetails
 *   GET /liveChatMessages    → live chat messages while a stream is active
 *
 * Quota notes (units per call, per Google's published costs):
 *   videos.list            ≈ 1 unit
 *   liveChatMessages.list  ≈ 1 unit  (BUT must respect pollingIntervalMillis)
 *
 * Required env var:  YOUTUBE_API_KEY   (server-side only — never sent to client)
 */

const YT_BASE = "https://www.googleapis.com/youtube/v3";

/** Throws a clear error if the API key is missing. */
function requireApiKey() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new Error(
      "YOUTUBE_API_KEY is not set in the environment — YouTube features are disabled",
    );
  }
  return key;
}

/**
 * Extract a YouTube video ID from any common URL variant.
 * Handles: watch?v=, youtu.be/, /live/, /shorts/, /embed/
 * Returns null if no ID can be found.
 */
export function extractYouTubeId(url = "") {
  if (typeof url !== "string") return null;
  const patterns = [
    /youtu\.be\/([^?&/]+)/,
    /[?&]v=([^?&/]+)/,
    /youtube\.com\/(?:live|shorts|embed)\/([^?&/]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

/**
 * Safe JSON fetch with timeout + Google API error surfacing.
 * Throws an Error whose `.code` is set when YouTube returns a quota /
 * rate-limit error so callers can back off gracefully.
 */
async function ytFetch(path, params, timeoutMs = 10000) {
  const key = requireApiKey();
  const search = new URLSearchParams({ ...params, key }).toString();
  const url = `${YT_BASE}/${path}?${search}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      const reason = body?.error?.errors?.[0]?.reason || "unknown";
      const message =
        body?.error?.message || `YouTube API HTTP ${res.status} URL: ${url}`;

      console.error("YouTube API ERROR:", {
        status: res.status,
        url,
        response: body,
      });
      const err = new Error(message);
      err.code = reason; // e.g. "quotaExceeded", "rateLimitExceeded"
      err.status = res.status;
      throw err;
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch full details for a single video.
 *
 * @param {string} videoId
 * @returns {Promise<object|null>} normalised details, or null if not found
 *
 * Shape returned:
 * {
 *   videoId, title, channelTitle, thumbnail,
 *   views, likes, commentCount,
 *   liveStatus,          // "live" | "upcoming" | "none"
 *   isLiveNow,           // boolean
 *   currentViewers,      // concurrent viewers (live only) | null
 *   activeLiveChatId,    // chat id while live | null
 *   actualStartTime, actualEndTime
 * }
 */
export async function getVideoDetails(videoId) {
  if (!videoId) return null;

  const data = await ytFetch("videos", {
    part: "snippet,statistics,liveStreamingDetails",
    id: videoId,
  });

  const item = data.items?.[0];
  if (!item) return null;

  const snippet = item.snippet || {};
  const stats = item.statistics || {};
  const live = item.liveStreamingDetails || {};

  // liveBroadcastContent is the most reliable live/upcoming/none flag
  const liveStatus = snippet.liveBroadcastContent || "none";

  // Pick the best available thumbnail
  const thumbs = snippet.thumbnails || {};
  const thumbnail =
    thumbs.maxres?.url ||
    thumbs.standard?.url ||
    thumbs.high?.url ||
    thumbs.medium?.url ||
    thumbs.default?.url ||
    null;

  return {
    videoId,
    title: snippet.title || null,
    channelTitle: snippet.channelTitle || null,
    thumbnail,
    views: stats.viewCount != null ? parseInt(stats.viewCount, 10) : null,
    likes: stats.likeCount != null ? parseInt(stats.likeCount, 10) : null,
    commentCount:
      stats.commentCount != null ? parseInt(stats.commentCount, 10) : null,
    liveStatus,
    isLiveNow: liveStatus === "live",
    currentViewers:
      live.concurrentViewers != null
        ? parseInt(live.concurrentViewers, 10)
        : null,
    activeLiveChatId: live.activeLiveChatId || null,
    actualStartTime: live.actualStartTime || null,
    actualEndTime: live.actualEndTime || null,
  };
}

/**
 * Fetch a page of live chat messages.
 *
 * IMPORTANT: pass the `pageToken` returned by the previous call so you only
 * ever receive NEW messages — this is how we avoid storing duplicates and
 * stay within quota. Respect `pollingIntervalMillis` before calling again.
 *
 * @param {string} liveChatId   activeLiveChatId from getVideoDetails()
 * @param {string|null} pageToken
 * @returns {Promise<{messages, nextPageToken, pollingIntervalMillis}>}
 */
export async function getLiveChatMessages(liveChatId, pageToken = null) {
  if (!liveChatId) {
    return { messages: [], nextPageToken: null, pollingIntervalMillis: 10000 };
  }

  const params = {
    liveChatId,
    part: "snippet,authorDetails",
    maxResults: "200",
  };
  if (pageToken) params.pageToken = pageToken;

  const data = await ytFetch("liveChat/messages", params);

  const messages = (data.items || []).map((item) => ({
    youtubeMessageId: item.id,
    message:
      item.snippet?.displayMessage ??
      item.snippet?.textMessageDetails?.messageText ??
      "",
    publishedAt: item.snippet?.publishedAt
      ? new Date(item.snippet.publishedAt)
      : new Date(),
    authorName: item.authorDetails?.displayName || "Unknown",
    authorChannelId: item.authorDetails?.channelId || null,
  }));

  return {
    messages,
    nextPageToken: data.nextPageToken || null,
    // Google tells us how long to wait before polling again — honour it.
    pollingIntervalMillis: data.pollingIntervalMillis
      ? parseInt(data.pollingIntervalMillis, 10)
      : 10000,
  };
}
