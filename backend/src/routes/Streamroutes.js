import express from "express";
import {
  generateStreamToken,
  createOrGetCall,
  getCallInfo,
  endCall,
  getRecordings,
  getAllRecordings,
} from "../controllers/streamController.js";

// Re-use your existing auth middleware — adjust the import path if needed
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// ── Token (any authenticated user — presenter AND audience need one) ──────────
router.post("/token", protect, generateStreamToken);

// ── Call management (admin / presenter only) ──────────────────────────────────
router.post("/call/:programId", protect, authorize("admin"), createOrGetCall);
router.post("/call/:programId/end", protect, authorize("admin"), endCall);

// ── Call info (any authenticated user so the watch page can load) ─────────────
router.get("/call/:programId", protect, getCallInfo);

// ── Recordings ────────────────────────────────────────────────────────────────
router.get("/recordings", protect, getAllRecordings); // all programs
router.get(
  "/recordings/:programId",
  protect,
  authorize("admin"),
  getRecordings,
); // one program

export default router;
