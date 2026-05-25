// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Safe JSON fetch with timeout */
async function fetchJSON(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Empty stats skeleton */
const emptyStats = () => ({
  likes: null,
  comments: null,
  shares: null,
  views: null,
  fetchedAt: new Date().toISOString(),
});

// ─── YouTube ─────────────────────────────────────────────────────────────────

/**
 * Extract a YouTube video ID from any YouTube URL variant.
 * Handles: watch?v=, youtu.be/, /live/, /shorts/
 */
export function extractYouTubeId(url) {
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
 * Fetch YouTube video stats via YouTube Data API v3.
 * @param {string} videoId
 * @returns {Promise<{likes,comments,shares,views,fetchedAt}>}
 */
export async function getYouTubeStats(videoId) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn(
      "[socialStats] YOUTUBE_API_KEY not set — skipping YouTube stats",
    );
    return emptyStats();
  }

  try {
    const data = await fetchJSON(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${apiKey}`,
    );

    const stats = data.items?.[0]?.statistics;
    if (!stats) return emptyStats();

    return {
      likes: stats.likeCount != null ? parseInt(stats.likeCount, 10) : null,
      comments:
        stats.commentCount != null ? parseInt(stats.commentCount, 10) : null,
      shares: null, // YouTube API does not expose share count
      views: stats.viewCount != null ? parseInt(stats.viewCount, 10) : null,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[socialStats] YouTube stats error:", err.message);
    return emptyStats();
  }
}

// ─── Facebook ─────────────────────────────────────────────────────────────────

/**
 * Extract Facebook video/live ID from a Facebook URL.
 * Handles: /videos/<id>, /video/<id>, /watch?v=<id>, /reel/<id>
 */
export function extractFacebookVideoId(url) {
  const patterns = [
    /\/videos?\/(\d+)/,
    /[?&]v=(\d+)/,
    /\/reels?\/(\d+)/,
    /story_fbid=(\d+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

/**
 * Fetch Facebook video stats via Graph API.
 * Requires a Page or User access token with video_stats permission.
 * @param {string} videoId
 * @returns {Promise<{likes,comments,shares,views,fetchedAt}>}
 */
export async function getFacebookStats(videoId) {
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!token) {
    console.warn(
      "[socialStats] FACEBOOK_ACCESS_TOKEN not set — skipping Facebook stats",
    );
    return emptyStats();
  }

  try {
    const fields =
      "likes.summary(true),comments.summary(true),sharedposts.summary(true),views";
    const data = await fetchJSON(
      `https://graph.facebook.com/v25.0/${videoId}?fields=${fields}&access_token=${token}`,
    );

    return {
      likes: data.likes?.summary?.total_count ?? null,
      comments: data.comments?.summary?.total_count ?? null,
      shares: data.sharedposts?.summary?.total_count ?? null,
      views: data.views ?? null,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[socialStats] Facebook stats error:", err.message);
    return emptyStats();
  }
}

// ─── Instagram ────────────────────────────────────────────────────────────────

/**
 * Extract Instagram shortcode from URL.
 * Handles: /p/<shortcode>, /reel/<shortcode>
 */
export function extractInstagramShortcode(url) {
  return url.match(/instagram\.com\/(?:p|reel)\/([^/?]+)/)?.[1] ?? null;
}

/**
 * Fetch Instagram media stats via Instagram Graph API.
 * Requires: INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_USER_ID
 * The API requires fetching all media and matching by shortcode,
 * or using the media ID directly if stored.
 * @param {string} shortcode
 * @returns {Promise<{likes,comments,shares,views,fetchedAt}>}
 */
export async function getInstagramStats(shortcode) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;

  if (!token || !userId) {
    console.warn(
      "[socialStats] INSTAGRAM_ACCESS_TOKEN or INSTAGRAM_USER_ID not set — skipping",
    );
    return emptyStats();
  }

  try {
    // Fetch recent media list and find media with matching shortcode
    const media = await fetchJSON(
      `https://graph.instagram.com/${userId}/media?fields=id,shortcode,like_count,comments_count&access_token=${token}&limit=50`,
    );

    const item = media.data?.find((m) => m.shortcode === shortcode);
    if (!item) {
      console.warn(
        `[socialStats] Instagram media not found for shortcode: ${shortcode}`,
      );
      return emptyStats();
    }

    return {
      likes: item.like_count ?? null,
      comments: item.comments_count ?? null,
      shares: null, // Instagram API does not expose share count
      views: null,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[socialStats] Instagram stats error:", err.message);
    return emptyStats();
  }
}

// ─── TikTok ──────────────────────────────────────────────────────────────────

/**
 * Extract TikTok video ID from URL.
 * Handles: /@user/video/<id>, /video/<id>
 */
export function extractTikTokVideoId(url) {
  return url.match(/video\/(\d+)/)?.[1] ?? null;
}

/**
 * Fetch TikTok video stats.
 *
 * TikTok does NOT have a public stats API for regular developers.
 * The Research API (digg_count, comment_count, share_count) is restricted
 * to approved academic/enterprise accounts only.
 *
 * Strategy used here:
 *   1. Try TikTok oEmbed endpoint for the video thumbnail_url which embeds
 *      the video ID — confirms it's valid.
 *   2. Try fetching the public TikTok page and scraping the __NEXT_DATA__
 *      JSON blob for stats (brittle but best available without enterprise access).
 *   3. Fall back to nulls if scraping fails.
 *
 * @param {string} videoId
 * @param {string} originalUrl
 * @returns {Promise<{likes,comments,shares,views,fetchedAt}>}
 */
export async function getTikTokStats(videoId, originalUrl) {
  // Step 1: Validate via oEmbed
  try {
    await fetchJSON(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(originalUrl)}`,
    );
  } catch {
    // oEmbed failed — video may be invalid or private
    return emptyStats();
  }

  // Step 2: Try scraping public page for __NEXT_DATA__
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`https://www.tiktok.com/video/${videoId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        Accept: "text/html",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    const html = await res.text();
    const match = html.match(
      /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
    );
    if (!match) return emptyStats();

    const json = JSON.parse(match[1]);
    // Path varies by TikTok page version
    const videoData =
      json?.props?.pageProps?.itemInfo?.itemStruct ??
      json?.props?.pageProps?.videoData?.itemInfos ??
      null;

    if (!videoData) return emptyStats();

    // itemStruct shape
    const stats = videoData.stats ?? videoData;
    return {
      likes: stats.diggCount ?? stats.heartCount ?? null,
      comments: stats.commentCount ?? null,
      shares: stats.shareCount ?? null,
      views: stats.playCount ?? null,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[socialStats] TikTok scrape error:", err.message);
    return emptyStats();
  }
}

// ─── Unified dispatcher ───────────────────────────────────────────────────────

/**
 * Fetch engagement stats for a single SocialStream object.
 *
 * @param {{ platform: string, url: string }} stream
 * @returns {Promise<{likes,comments,shares,views,fetchedAt}>}
 */
export async function fetchSocialStats(stream) {
  const { platform, url } = stream;

  switch (platform) {
    case "youtube": {
      const id = extractYouTubeId(url);
      return id ? getYouTubeStats(id) : emptyStats();
    }
    case "facebook": {
      const id = extractFacebookVideoId(url);
      return id ? getFacebookStats(id) : emptyStats();
    }
    case "instagram": {
      const shortcode = extractInstagramShortcode(url);
      return shortcode ? getInstagramStats(shortcode) : emptyStats();
    }
    case "tiktok": {
      const id = extractTikTokVideoId(url);
      return id ? getTikTokStats(id, url) : emptyStats();
    }
    default:
      return emptyStats();
  }
}

/**
 * Fetch stats for all social streams on a program in parallel.
 * Returns a Map keyed by platform string.
 *
 * @param {Array<{platform: string, url: string}>} streams
 * @returns {Promise<Map<string, {likes,comments,shares,views,fetchedAt}>>}
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
