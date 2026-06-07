/**
 * Derives an embeddable iframe URL from a raw YouTube URL.
 * Returns null if no video id can be extracted.
 *
 * Facebook / TikTok / Instagram support has been removed — YouTube only.
 *
 * Supported conversions:
 *   YouTube watch  → youtube.com/embed/<id>
 *   YouTube live   → youtube.com/embed/<id>
 *   youtu.be / shorts / embed → youtube.com/embed/<id>
 */
export function deriveEmbedUrl(platform, url) {
  if (!url || platform !== "youtube") return null;

  try {
    const ytShort = url.match(/youtu\.be\/([^?&/]+)/);
    const ytWatch = url.match(/[?&]v=([^?&/]+)/);
    const ytPath = url.match(/youtube\.com\/(?:live|shorts|embed)\/([^?&/]+)/);
    const videoId = (ytShort || ytWatch || ytPath)?.[1];
    return videoId
      ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`
      : null;
  } catch {
    return null;
  }
}

/**
 * Validates that a URL string is a plausible YouTube link.
 * Throws if invalid (or if a non-YouTube platform is supplied).
 */
export function validateSocialUrl(platform, url) {
  if (platform !== "youtube") {
    throw new Error(
      `Unsupported platform "${platform}" — only YouTube is supported`,
    );
  }

  const youtubePattern = /youtube\.com|youtu\.be/i;
  if (!youtubePattern.test(url)) {
    throw new Error(`URL does not appear to be a valid YouTube link: ${url}`);
  }
}
