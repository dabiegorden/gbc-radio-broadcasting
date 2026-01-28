import express from "express";
import {
  createMeeting,
  getAllMeetings,
  getMyMeetings,
  getMeetingById,
  updateMeeting,
  cancelMeeting,
  deleteMeeting,
  getMeetingStats,
} from "../controllers/meetingController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/", protect, authorize("admin"), getAllMeetings);
router.get("/stats", protect, authorize("admin"), getMeetingStats);
router.get("/my-meetings", protect, getMyMeetings);
router.post("/", protect, createMeeting);
router.get("/:id", protect, getMeetingById);
router.put("/:id", protect, updateMeeting);
router.patch("/:id/cancel", protect, cancelMeeting);
router.delete("/:id", protect, authorize("admin"), deleteMeeting);

export default router;
