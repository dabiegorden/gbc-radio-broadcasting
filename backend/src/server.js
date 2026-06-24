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
import Program from "./models/Program.js";

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import routes
import streamRoutes from "./routes/Streamroutes.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import programRoutes from "./routes/programs.js";
import engagementRoutes from "./routes/engagement.js";
import analyticsRoutes from "./routes/analytics.js";
import streamingRoutes from "./routes/streaming.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import youtubeRoutes from "./routes/youtubeStream.js"; // ← NEW: YouTube Live analytics

// ← NEW: background YouTube collector
import { initializeYoutubeCollector } from "./jobs/youtubeCollector.js";

// Initialize express app
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  },
});

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
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
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/programs", programRoutes);
app.use("/engagement", engagementRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/streaming", streamingRoutes); // legacy radio streaming helpers
app.use("/meetings", meetingRoutes);
app.use("/stream", streamRoutes); // GetStream + LiveSession routes
app.use("/youtube", youtubeRoutes); // ← NEW: YouTube Live monitoring + analytics

// Health check route
app.get("/health", (req, res) => {
  res.json({
    status: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ── Real-time listener tracking ─────────────────────────────────────────────
// In-memory map: programId -> Map<socketId, listenerId>
// `listenerId` is the authenticated user id when available, otherwise the
// socket id (so anonymous listeners each count once). Counting unique
// listenerIds means the SAME user opening two tabs is only counted once, and
// when every connection for that user leaves/disconnects the count drops.
const programListeners = new Map();

const uniqueListenerCount = (programId) => {
  const sockets = programListeners.get(programId);
  if (!sockets) return 0;
  return new Set(sockets.values()).size;
};

const syncListenerCount = async (programId) => {
  const count = uniqueListenerCount(programId);
  try {
    await Program.findByIdAndUpdate(programId, { currentListeners: count });
  } catch (err) {
    console.error("Failed to sync listener count:", err.message);
  }
  io.emit("listener-count-updated", { programId, currentListeners: count });
  return count;
};

const addListener = async (socket, programId, listenerId) => {
  if (!programId) return;
  if (!programListeners.has(programId)) {
    programListeners.set(programId, new Map());
  }
  const sockets = programListeners.get(programId);

  // Was this listener already present (another tab/connection)?
  const alreadyPresent = new Set(sockets.values()).has(listenerId);
  sockets.set(socket.id, listenerId);

  // Only count a brand-new unique listener toward the cumulative total.
  if (!alreadyPresent) {
    try {
      await Program.findByIdAndUpdate(programId, { $inc: { totalListeners: 1 } });
    } catch (err) {
      console.error("Failed to increment total listeners:", err.message);
    }
  }
  await syncListenerCount(programId);
};

const removeListener = async (socket, programId) => {
  const sockets = programListeners.get(programId);
  if (!sockets || !sockets.has(socket.id)) return;
  sockets.delete(socket.id);
  if (sockets.size === 0) programListeners.delete(programId);
  await syncListenerCount(programId);
};

// ── Socket.IO events ──────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("engagement-update", (data) => {
    io.emit("engagement-update", data);
  });

  socket.on("stream-status", (status) => {
    io.emit("stream-status", status);
  });

  // ── Real-time program listener join/leave ──────────────────────────────────
  socket.on("join-program", ({ programId, userId }) => {
    const listenerId = userId || socket.id;
    socket.join(`program-${programId}`);
    addListener(socket, programId, listenerId);
    console.log(`Listener ${listenerId} joined program ${programId}`);
  });

  socket.on("leave-program", ({ programId }) => {
    socket.leave(`program-${programId}`);
    removeListener(socket, programId);
    console.log(`Socket ${socket.id} left program ${programId}`);
  });

  // Existing session-level events
  socket.on("join-session", ({ sessionId }) => {
    socket.join(`session-${sessionId}`);
    console.log(`Socket ${socket.id} joined room session-${sessionId}`);
  });

  socket.on("leave-session", ({ sessionId }) => {
    socket.leave(`session-${sessionId}`);
  });

  // ← NEW: YouTube live analytics rooms.
  // Frontend emits join-youtube-stream to receive liveStatsUpdated /
  // newLiveChatMessage / analyticsUpdated for one specific stream.
  socket.on("join-youtube-stream", ({ streamId }) => {
    socket.join(`youtube-${streamId}`);
    console.log(`Socket ${socket.id} joined room youtube-${streamId}`);
  });

  socket.on("leave-youtube-stream", ({ streamId }) => {
    socket.leave(`youtube-${streamId}`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    // Drop this socket from every program it was listening to and re-sync counts.
    for (const programId of [...programListeners.keys()]) {
      removeListener(socket, programId);
    }
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

  // ← NEW: start the background collector once the server is up.
  // Pass io so it can broadcast live updates to the frontend.
  initializeYoutubeCollector(io);
});

export default app;
