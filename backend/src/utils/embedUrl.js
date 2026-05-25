/**
 * Derives an embeddable iframe URL from a raw social media URL.
 * Returns null if the platform doesn't support standard embedding
 * (e.g. TikTok live, Instagram live) — the frontend falls back to
 * opening in a new tab for those cases.
 *
 * Supported automatic conversions:
 *   YouTube watch  → youtube.com/embed/<id>
 *   YouTube live   → youtube.com/embed/<id>
 *   Facebook video → facebook.com/plugins/video.php?href=<encoded>
 *   TikTok video   → tiktok.com/embed/<id>  (lives not embeddable)
 *   Instagram post → instagram.com/p/<id>/embed (lives not embeddable)
 */
export function deriveEmbedUrl(platform, url) {
  if (!url) return null;

  try {
    switch (platform) {
      case "youtube": {
        // Handle youtu.be/<id>, watch?v=<id>, live/<id>, shorts/<id>
        const ytShort = url.match(/youtu\.be\/([^?&/]+)/);
        const ytWatch = url.match(/[?&]v=([^?&/]+)/);
        const ytPath = url.match(/youtube\.com\/(?:live|shorts)\/([^?&/]+)/);
        const videoId = (ytShort || ytWatch || ytPath)?.[1];
        return videoId
          ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`
          : null;
      }

      case "facebook": {
        // Facebook video/live embed via plugin
        return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true`;
      }

      case "tiktok": {
        // TikTok video embed: tiktok.com/@user/video/<id>
        const ttId = url.match(/video\/(\d+)/)?.[1];
        return ttId ? `https://www.tiktok.com/embed/${ttId}` : null;
      }

      case "instagram": {
        // Instagram post/reel embed: instagram.com/p/<id> or /reel/<id>
        const igId = url.match(/instagram\.com\/(?:p|reel)\/([^/?]+)/)?.[1];
        return igId ? `https://www.instagram.com/p/${igId}/embed` : null;
      }

      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Validates that a URL string is a plausible link for the given platform.
 * Throws an error string if invalid.
 */
export function validateSocialUrl(platform, url) {
  const patterns = {
    youtube: /youtube\.com|youtu\.be/i,
    facebook: /facebook\.com|fb\.watch/i,
    instagram: /instagram\.com/i,
    tiktok: /tiktok\.com/i,
  };

  if (!patterns[platform]?.test(url)) {
    throw new Error(
      `URL does not appear to be a valid ${platform} link: ${url}`,
    );
  }
}
