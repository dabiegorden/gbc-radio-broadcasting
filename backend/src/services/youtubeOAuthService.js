import YoutubeOAuthToken from "../models/YoutubeOAuthToken.js";

/**
 * YouTube OAuth Service
 * ─────────────────────
 * Handles the Google OAuth 2.0 dance needed to create live broadcasts on a
 * user's own channel. Uses raw fetch (no extra dependency) to match the rest
 * of the YouTube integration.
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REDIRECT_URI   (must equal `${API_URL}/youtube/callback` and be
 *                          registered in the Google Cloud console)
 *
 * Scopes (broadcast + chat management):
 *   https://www.googleapis.com/auth/youtube
 *   https://www.googleapis.com/auth/youtube.force-ssl
 */

const AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/youtube.force-ssl",
];

/** Throws a clear error if OAuth env vars are missing. */
function requireOAuthEnv() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
    process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new Error(
      "Google OAuth is not configured — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI",
    );
  }
  return { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI };
}

/**
 * 1) Build the Google consent screen URL.
 * `state` is an opaque value we use to identify the user on the callback.
 * access_type=offline + prompt=consent guarantees we receive a refresh_token.
 */
export function getAuthUrl(state) {
  const { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } = requireOAuthEnv();
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state: state || "",
  });
  return `${AUTH_BASE}?${params.toString()}`;
}

/** POST helper for the token endpoint (form-urlencoded). */
async function postToken(form) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // invalid_grant typically means the refresh token was revoked/expired.
    const err = new Error(
      data.error_description || data.error || "Google token request failed",
    );
    err.code = data.error || "token_error";
    err.status = res.status;
    throw err;
  }
  return data;
}

/**
 * 2) Exchange an authorization code for tokens.
 * @returns {Promise<{access_token, refresh_token, expires_in, scope, token_type}>}
 */
export async function exchangeCodeForTokens(code) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
    requireOAuthEnv();
  return postToken({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: GOOGLE_REDIRECT_URI,
    grant_type: "authorization_code",
  });
}

/** Fetch the authenticated user's channel (id + title) using an access token. */
export async function fetchChannel(accessToken) {
  try {
    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const data = await res.json().catch(() => ({}));
    const ch = data.items?.[0];
    if (!ch) return { channelId: null, channelTitle: null };
    return { channelId: ch.id, channelTitle: ch.snippet?.title || null };
  } catch {
    return { channelId: null, channelTitle: null };
  }
}

/**
 * 3) Persist (upsert) tokens for a user. Computes the absolute expiry date.
 * Note: Google only returns refresh_token on the FIRST consent, so we keep the
 * existing one if a later exchange omits it.
 */
export async function saveTokens(userId, tokens, channel = {}) {
  const expiryDate = Date.now() + (tokens.expires_in || 3600) * 1000;

  const update = {
    user: userId,
    accessToken: tokens.access_token,
    expiryDate,
    scope: tokens.scope,
    tokenType: tokens.token_type || "Bearer",
  };
  if (tokens.refresh_token) update.refreshToken = tokens.refresh_token;
  if (channel.channelId !== undefined) update.channelId = channel.channelId;
  if (channel.channelTitle !== undefined)
    update.channelTitle = channel.channelTitle;

  return YoutubeOAuthToken.findOneAndUpdate({ user: userId }, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });
}

/** Refresh an access token using the stored refresh token. */
async function refreshAccessToken(tokenDoc) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = requireOAuthEnv();
  if (!tokenDoc.refreshToken) {
    const err = new Error("No refresh token on file — reconnect Google");
    err.code = "NOT_CONNECTED";
    throw err;
  }

  const data = await postToken({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: tokenDoc.refreshToken,
    grant_type: "refresh_token",
  });

  tokenDoc.accessToken = data.access_token;
  tokenDoc.expiryDate = Date.now() + (data.expires_in || 3600) * 1000;
  if (data.scope) tokenDoc.scope = data.scope;
  await tokenDoc.save();
  return tokenDoc.accessToken;
}

/**
 * 4) Get a valid access token for a user, refreshing automatically when it is
 * expired (or about to expire within 60s). Throws { code: "NOT_CONNECTED" }
 * when the user has never connected their Google account.
 */
export async function getValidAccessToken(userId) {
  const tokenDoc = await YoutubeOAuthToken.findOne({ user: userId }).select(
    "+accessToken +refreshToken",
  );

  if (!tokenDoc) {
    const err = new Error("Google account not connected");
    err.code = "NOT_CONNECTED";
    throw err;
  }

  const stillValid =
    tokenDoc.accessToken && tokenDoc.expiryDate - Date.now() > 60_000;
  if (stillValid) return tokenDoc.accessToken;

  // Expired/near-expiry → refresh.
  return refreshAccessToken(tokenDoc);
}

/** Lightweight connection check for the frontend. */
export async function getConnection(userId) {
  const doc = await YoutubeOAuthToken.findOne({ user: userId });
  return {
    connected: !!doc,
    channelTitle: doc?.channelTitle || null,
    channelId: doc?.channelId || null,
  };
}

export default {
  getAuthUrl,
  exchangeCodeForTokens,
  fetchChannel,
  saveTokens,
  getValidAccessToken,
  getConnection,
};
