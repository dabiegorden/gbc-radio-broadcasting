import mongoose from "mongoose";
import { ENV } from "../libs/env.js";

if (!ENV.MONGODB_URL) {
  throw new Error("Provide MongoDB connection string in the .env file");
}

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(ENV.MONGODB_URL);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.log(`Error connecting to the database: ${error}`);
  }
};
