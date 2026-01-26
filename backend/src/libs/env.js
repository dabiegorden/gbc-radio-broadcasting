import dotenv from "dotenv";

dotenv.config({ quiet: true });

export const ENV = {
  MONGODB_URL: process.env.MONGODB_URL,
  JWT_SWCRET: process.env.JWT_SWCRET,
  PORT: process.env.PORT,
};
