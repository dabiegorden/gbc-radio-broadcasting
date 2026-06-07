import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

/**
 * Google Gemini AI Configuration
 * Initializes the Gemini client for AI-powered features
 */

const initializeGemini = () => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn("⚠ GEMINI_API_KEY not found in environment variables");
    console.warn("  AI-powered features will be limited");
    return null;
  }

  // Initialize with API key from environment
  const geminiClient = new GoogleGenerativeAI(apiKey);

  return geminiClient;
};

/**
 * Get Gemini model instance
 */
const getGeminiModel = (client, modelName = "gemini-3.5-flash") => {
  if (!client) {
    throw new Error("Gemini client not initialized");
  }
  return client.getGenerativeModel({ model: modelName });
};

/**
 * Singleton instance
 */
let geminiClient = null;

/**
 * Get or create Gemini client
 */
const getGeminiClient = () => {
  if (!geminiClient) {
    geminiClient = initializeGemini();
  }
  return geminiClient;
};

export { initializeGemini, getGeminiModel, getGeminiClient };
