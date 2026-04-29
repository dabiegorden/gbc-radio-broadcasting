import dotenv from "dotenv";

dotenv.config({ quiet: true });

export const ENV = {
  MONGODB_URL: process.env.MONGODB_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  PORT: process.env.PORT,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  NODE_ENV: process.env.NODE_ENV,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  AGORA_APP_ID: process.env.AGORA_APP_ID,
};
