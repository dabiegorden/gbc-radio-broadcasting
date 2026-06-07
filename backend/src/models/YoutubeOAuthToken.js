import mongoose from "mongoose";

/**
 * YoutubeOAuthToken Model
 * ───────────────────────
 * Stores the Google OAuth 2.0 tokens for a user who has connected their
 * YouTube channel. One document per user.
 *
 * SECURITY: accessToken and refreshToken are `select: false`, so they are
 * NEVER returned by normal queries (e.g. `.find()` / `.lean()`), and therefore
 * never leak to the frontend. The OAuth service explicitly `.select("+...")`s
 * them only when it needs to call Google server-side.
 */

const youtubeOAuthTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    accessToken: { type: String, default: null, select: false },
    refreshToken: { type: String, default: null, select: false },

    /** Absolute expiry as epoch milliseconds (Date.now() + expires_in*1000) */
    expiryDate: { type: Number, default: 0 },

    scope: { type: String, default: null },
    tokenType: { type: String, default: "Bearer" },

    // Channel this Google account controls (filled after first connect)
    channelId: { type: String, default: null },
    channelTitle: { type: String, default: null },
  },
  { timestamps: true },
);

export default mongoose.models.YoutubeOAuthToken ||
  mongoose.model("YoutubeOAuthToken", youtubeOAuthTokenSchema);
