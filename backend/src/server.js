import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { Server as SocketIOServer } from "socket.io";
import http from "http";

// Load environment variables
dotenv.config({ quiet: true });

// Config imports
import { connectDB } from "./config/database.js";
import { getGeminiClient } from "./config/gemini.js";

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import routes
import streamRoutes from "./routes/streamRoutes.js"; // ← new session-based routes
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import programRoutes from "./routes/programs.js";
import engagementRoutes from "./routes/engagement.js";
import analyticsRoutes from "./routes/analytics.js";
import streamingRoutes from "./routes/streaming.js";
import meetingRoutes from "./routes/meetingRoutes.js";

// Initialize express app
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  },
});

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());

// Connect to MongoDB
await connectDB();

// Initialize Gemini AI
const geminiClient = getGeminiClient();
console.log("✓ AI Services initialized");

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/programs", programRoutes);
app.use("/api/engagement", engagementRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/streaming", streamingRoutes); // legacy radio streaming helpers
app.use("/api/meetings", meetingRoutes);
app.use("/api/stream", streamRoutes); // ← new GetStream + LiveSession routes

// Health check route
app.get("/api/health", (req, res) => {
  res.json({
    status: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ── Socket.IO events ──────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("engagement-update", (data) => {
    io.emit("engagement-update", data);
  });

  socket.on("stream-status", (status) => {
    io.emit("stream-status", status);
  });

  // New session-level events
  socket.on("join-session", ({ sessionId }) => {
    socket.join(`session-${sessionId}`);
    console.log(`Socket ${socket.id} joined room session-${sessionId}`);
  });

  socket.on("leave-session", ({ sessionId }) => {
    socket.leave(`session-${sessionId}`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// ── Error handling ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || "Internal Server Error",
      status: err.status || 500,
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: "Route not found",
      path: req.path,
    },
  });
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

export default app;
