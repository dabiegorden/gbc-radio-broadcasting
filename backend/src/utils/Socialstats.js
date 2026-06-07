// ─── Social Stats (YouTube only) ──────────────────────────────────────────────
//
// Facebook, TikTok and Instagram support has been removed — the platform now
// monitors YouTube exclusively. The public surface (fetchSocialStats /
// fetchAllSocialStats) is unchanged so programController.js keeps working.

import { extractYouTubeId, getVideoDetails } from "./youtube.js";

/** Empty stats skeleton (kept for backwards-compatible shape). */
const emptyStats = () => ({
  likes: null,
  comments: null,
  shares: null,
  views: null,
  fetchedAt: new Date().toISOString(),
});

/**
 * Fetch YouTube stats for a single video URL/id.
 * Delegates to the shared YouTube API wrapper.
 */
async function getYouTubeStats(videoId) {
  try {
    const details = await getVideoDetails(videoId);
    if (!details) return emptyStats();
    return {
      likes: details.likes,
      comments: details.commentCount,
      shares: null, // YouTube API does not expose share count
      views: details.views,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[socialStats] YouTube stats error:", err.message);
    return emptyStats();
  }
}

/**
 * Fetch engagement stats for a single SocialStream object.
 * Only YouTube is supported; any other platform returns empty stats.
 *
 * @param {{ platform: string, url: string }} stream
 */
export async function fetchSocialStats(stream) {
  const { platform, url } = stream;
  if (platform !== "youtube") return emptyStats();

  const id = extractYouTubeId(url);
  return id ? getYouTubeStats(id) : emptyStats();
}

/**
 * Fetch stats for all social streams on a program in parallel.
 * Returns a Map keyed by platform string.
 *
 * @param {Array<{platform: string, url: string}>} streams
 */
export async function fetchAllSocialStats(streams = []) {
  const results = await Promise.allSettled(
    streams.map((s) => fetchSocialStats(s)),
  );

  const map = new Map();
  streams.forEach((s, i) => {
    const r = results[i];
    map.set(s.platform, r.status === "fulfilled" ? r.value : emptyStats());
  });
  return map;
}
