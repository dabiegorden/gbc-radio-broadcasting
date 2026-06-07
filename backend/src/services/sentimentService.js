/**
 * Sentiment Analysis Service  (replaceable)
 * ─────────────────────────────────────────
 * Classifies a chat message as positive / negative / neutral and returns a
 * confidence score, e.g.:
 *
 *   analyzeSentiment("This live session is amazing")
 *   → { sentiment: "positive", confidence: 0.95 }
 *
 * The DEFAULT implementation is a fast, dependency-free lexicon classifier so
 * the feature works offline and never burns API quota. It is intentionally
 * isolated behind `analyzeSentiment()` / `analyzeMany()` so you can later swap
 * in a stronger backend WITHOUT touching any caller:
 *
 *   • Python ML model  → POST text to your model server inside analyzeSentiment
 *   • HuggingFace API  → call the inference endpoint
 *   • OpenAI / Gemini  → you already have a Gemini client in config/gemini.js;
 *                        wire it in here and the rest of the app is unchanged.
 *
 * To replace: keep the same function signatures and return shape.
 */

// ── Lexicon (small but practical — extend as needed) ──────────────────────────
const POSITIVE_WORDS = new Set([
  "amazing",
  "awesome",
  "great",
  "good",
  "love",
  "loved",
  "like",
  "liked",
  "best",
  "excellent",
  "fantastic",
  "wonderful",
  "nice",
  "cool",
  "happy",
  "beautiful",
  "perfect",
  "thanks",
  "thank",
  "helpful",
  "brilliant",
  "fire",
  "incredible",
  "superb",
  "enjoy",
  "enjoying",
  "enjoyed",
  "win",
  "winner",
  "congrats",
  "congratulations",
  "yes",
  "wow",
  "goat",
  "respect",
  "blessed",
]);

const NEGATIVE_WORDS = new Set([
  "bad",
  "worst",
  "hate",
  "hated",
  "terrible",
  "awful",
  "boring",
  "poor",
  "disappointing",
  "disappointed",
  "trash",
  "garbage",
  "ugly",
  "stupid",
  "annoying",
  "angry",
  "sad",
  "cringe",
  "fail",
  "failed",
  "lag",
  "laggy",
  "broken",
  "scam",
  "fake",
  "wrong",
  "no",
  "nope",
  "weak",
  "useless",
  "dislike",
]);

const NEGATIONS = new Set([
  "not",
  "no",
  "never",
  "dont",
  "don't",
  "didnt",
  "isnt",
  "wasnt",
  "cant",
]);

/** Tokenise: lowercase, strip punctuation, drop empties. */
function tokenize(text = "") {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Analyze a single message.
 * @param {string} text
 * @returns {{ sentiment: "positive"|"negative"|"neutral", confidence: number }}
 */
export function analyzeSentiment(text = "") {
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    return { sentiment: "neutral", confidence: 0.5 };
  }

  let score = 0;
  let hits = 0;

  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    const negated = i > 0 && NEGATIONS.has(tokens[i - 1]);

    if (POSITIVE_WORDS.has(word)) {
      score += negated ? -1 : 1;
      hits++;
    } else if (NEGATIVE_WORDS.has(word)) {
      score += negated ? 1 : -1;
      hits++;
    }
  }

  if (hits === 0) {
    return { sentiment: "neutral", confidence: 0.5 };
  }

  // Confidence scales with how decisive the signal was, capped at 0.95.
  const confidence = Math.min(0.95, 0.55 + (Math.abs(score) / hits) * 0.4);

  if (score > 0) return { sentiment: "positive", confidence };
  if (score < 0) return { sentiment: "negative", confidence };
  return { sentiment: "neutral", confidence: 0.5 };
}

/**
 * Analyze many messages at once.
 * @param {Array<{message: string}>} messages
 * @returns {Array<{sentiment, confidence}>}
 */
export function analyzeMany(messages = []) {
  return messages.map((m) => analyzeSentiment(m.message || ""));
}

export default { analyzeSentiment, analyzeMany };
