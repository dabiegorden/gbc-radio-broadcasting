"use client";

/**
 * WatchPage  — /watch/[programId]
 * ─────────────────────────────────
 * Audience view for a specific radio program. Supports:
 *   • Listening to a live radio stream (audio player)
 *   • Joining via social stream links (YouTube, Facebook, etc.)
 *   • Reactions (emoji) shown as floating animations
 *   • Live chat (send & receive messages with Socket.IO)
 *   • Engagement: comments, likes, shares (persisted to DB)
 *   • Viewing AI-analysed comments with sentiment
 *   • Listener count tracking (join/leave)
 *
 * Routes consumed:
 *   GET  /programs/:id                    → program info + social streams
 *   GET  /streaming/:id/metadata          → stream metadata
 *   GET  /streaming/:id/status            → stream health
 *   POST /streaming/:id/join              → increment listener count
 *   POST /streaming/:id/leave             → decrement listener count
 *   POST /engagement                      → post comment/like/share
 *   GET  /engagement/program/:id          → fetch all engagements
 *   GET  /engagement/stats/:id            → stats (comment count, sentiment, etc.)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  Radio,
  Users,
  MessageSquare,
  Send,
  Play,
  Pause,
  Calendar,
  ChevronRight,
  Heart,
  ThumbsUp,
  Flame,
  PartyPopper,
  Clock,
  Loader2,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  Headphones,
  Signal,
  Sparkles,
  Smile,
  Meh,
  Frown,
  Share2,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  Mic,
  Music,
  BarChart2,
} from "lucide-react";
import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Program {
  _id: string;
  title: string;
  description: string;
  host: string;
  category: string;
  scheduleStartTime: string;
  scheduleEndTime: string;
  streamingUrl: string | null;
  isLive: boolean;
  currentListeners: number;
  totalListeners: number;
  status: "scheduled" | "live" | "completed";
  tags: string[];
  socialStreams?: SocialStream[];
}

interface SocialStream {
  platform: string;
  url: string;
  embedUrl?: string;
  label?: string;
  isActive: boolean;
  stats?: {
    likes?: number;
    comments?: number;
    shares?: number;
    views?: number;
  };
}

interface Engagement {
  _id: string;
  user: { _id: string; fullName: string; email: string };
  engagementType: string;
  comment?: {
    text: string;
    sentiment: string | null;
    engagementScore: number;
    aiAnalysis?: {
      summary: string;
      keywords: string[];
      predictedFollowUp?: boolean;
    };
  };
  createdAt: string;
}

interface EngagementStats {
  totalEngagements: number;
  commentCount: number;
  likeCount: number;
  shareCount: number;
  averageListeningDuration: number;
}

interface ChatMessage {
  id: string;
  user: string;
  text: string;
  time: string;
  isSystem?: boolean;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REACTIONS = [
  { emoji: "❤️", icon: Heart, label: "Love" },
  { emoji: "👍", icon: ThumbsUp, label: "Like" },
  { emoji: "🔥", icon: Flame, label: "Fire" },
  { emoji: "🎉", icon: PartyPopper, label: "Party" },
];

const PLATFORM_COLORS: Record<string, string> = {
  youtube: "bg-red-600/20 border-red-500/30 text-red-300 hover:bg-red-600/30",
  facebook:
    "bg-blue-600/20 border-blue-500/30 text-blue-300 hover:bg-blue-600/30",
  instagram:
    "bg-pink-600/20 border-pink-500/30 text-pink-300 hover:bg-pink-600/30",
  tiktok:
    "bg-cyan-600/20 border-cyan-500/30 text-cyan-300 hover:bg-cyan-600/30",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const nowTime = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const getSentimentDisplay = (sentiment: string | null | undefined) => {
  switch (sentiment) {
    case "positive":
      return {
        icon: <Smile className="w-4 h-4" />,
        color: "text-green-400",
        bg: "bg-green-500/20",
        label: "Positive",
      };
    case "negative":
      return {
        icon: <Frown className="w-4 h-4" />,
        color: "text-red-400",
        bg: "bg-red-500/20",
        label: "Negative",
      };
    default:
      return {
        icon: <Meh className="w-4 h-4" />,
        color: "text-yellow-400",
        bg: "bg-yellow-500/20",
        label: "Neutral",
      };
  }
};

// ─── Main page ────────────────────────────────────────────────────────────────

const WatchPage = () => {
  const params = useParams();
  const programId = (params?.programId as string | undefined) ?? "";

  // ── Program state ────────────────────────────────────────────────────────────
  const [program, setProgram] = useState<Program | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(true);
  const [stats, setStats] = useState<EngagementStats | null>(null);

  // ── Audio player state ───────────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false);

  // ── Engagement state ─────────────────────────────────────────────────────────
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [isLoadingEngagements, setIsLoadingEngagements] = useState(false);
  const [showComments, setShowComments] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);

  // ── Chat state ───────────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");

  // ── Reactions state ──────────────────────────────────────────────────────────
  const [floatingReactions, setFloatingReactions] = useState<
    FloatingReaction[]
  >([]);

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // ── Auth header ──────────────────────────────────────────────────────────────
  const authHeader = useCallback(
    () => ({
      Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("token") : ""}`,
      "Content-Type": "application/json",
    }),
    [],
  );

  // ── Load program info ────────────────────────────────────────────────────────
  const loadProgram = useCallback(async () => {
    if (!programId) {
      setIsLoadingInfo(false);
      return;
    }
    setIsLoadingInfo(true);
    try {
      const res = await fetch(`${API_URL}/programs/${programId}`);
      const data = await res.json();
      if (data.program) {
        setProgram(data.program);
      } else {
        toast.error(data.message || "Failed to load program");
      }
    } catch {
      toast.error("Network error loading program");
    }
    setIsLoadingInfo(false);
  }, [programId]);

  // ── Load engagement stats ────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    if (!programId) return;
    try {
      const res = await fetch(`${API_URL}/engagement/stats/${programId}`);
      const data = await res.json();
      if (data.stats) setStats(data.stats);
    } catch {
      /* silent */
    }
  }, [programId]);

  // ── Load engagements (comments) ──────────────────────────────────────────────
  const loadEngagements = useCallback(async () => {
    if (!programId) return;
    setIsLoadingEngagements(true);
    try {
      const res = await fetch(
        `${API_URL}/engagement/program/${programId}?limit=100`,
      );
      const data = await res.json();
      if (data.engagements) setEngagements(data.engagements);
    } catch {
      /* silent */
    } finally {
      setIsLoadingEngagements(false);
    }
  }, [programId]);

  // ── Initial load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    loadProgram();
  }, [loadProgram]);
  useEffect(() => {
    if (programId) {
      loadEngagements();
      loadStats();
    }
  }, [programId, loadEngagements, loadStats]);

  // ── Scroll to bottom ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (showComments)
      commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [engagements, showComments]);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ── WebSocket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!programId) return;
    socketRef.current = io(API_URL as string);
    socketRef.current.on("stream-status-updated", (data: any) => {
      if (data.programId === programId) {
        setProgram((prev) =>
          prev
            ? {
                ...prev,
                isLive: data.isLive,
                currentListeners: data.listenerCount,
              }
            : prev,
        );
      }
    });
    socketRef.current.on("listener-joined", (data: any) => {
      if (data.programId === programId) {
        setProgram((prev) =>
          prev ? { ...prev, currentListeners: data.currentListeners } : prev,
        );
      }
    });
    socketRef.current.on("listener-left", (data: any) => {
      if (data.programId === programId) {
        setProgram((prev) =>
          prev ? { ...prev, currentListeners: data.currentListeners } : prev,
        );
      }
    });
    socketRef.current.on("engagement-created", (data: any) => {
      if (data.programId === programId) loadEngagements();
    });
    return () => {
      socketRef.current?.disconnect();
    };
  }, [programId, loadEngagements]);

  // ── Join / Leave stream ──────────────────────────────────────────────────────
  const joinStream = useCallback(async () => {
    if (hasJoined || !programId) return;
    try {
      await fetch(`${API_URL}/streaming/${programId}/join`, { method: "POST" });
      setHasJoined(true);
      setChatMessages([
        {
          id: "sys-1",
          user: "System",
          text: `Welcome to "${program?.title}"! You are now listening.`,
          time: nowTime(),
          isSystem: true,
        },
      ]);
    } catch {
      /* silent */
    }
  }, [hasJoined, programId, program?.title]);

  const leaveStream = useCallback(async () => {
    if (!hasJoined || !programId) return;
    try {
      await fetch(`${API_URL}/streaming/${programId}/leave`, {
        method: "POST",
      });
      setHasJoined(false);
    } catch {
      /* silent */
    }
  }, [hasJoined, programId]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      leaveStream();
    };
  }, [leaveStream]);

  // ── Audio controls ───────────────────────────────────────────────────────────
  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (!hasJoined) await joinStream();
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() =>
          setStreamError(
            "Could not play stream. It may be offline or require a different player.",
          ),
        );
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  // ── Engagement helpers ───────────────────────────────────────────────────────
  const postEngagement = async (type: string, extra?: object) => {
    if (!programId) return null;
    const res = await fetch(`${API_URL}/engagement`, {
      method: "POST",
      headers: authHeader(),
      body: JSON.stringify({
        programId,
        engagementType: type,
        sessionId: `session_${Date.now()}`,
        ...extra,
      }),
    });
    return res.json();
  };

  const handlePostComment = async () => {
    if (!commentText.trim()) return;
    setIsSubmitting(true);
    try {
      const data = await postEngagement("comment", { comment: commentText });
      if (data?.engagement || data?._id) {
        toast.success("Comment posted! 💬");
        setCommentText("");
        loadEngagements();
        loadStats();
      } else if (data?.message) {
        toast.error(data.message);
      }
    } catch {
      toast.error("Failed to post comment. Are you logged in?");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async () => {
    if (hasLiked) return toast.info("You've already liked this broadcast");
    try {
      await postEngagement("like");
      setHasLiked(true);
      toast.success("Liked! ❤️");
      loadStats();
    } catch {
      toast.error("Failed to like. Are you logged in?");
    }
  };

  const handleShare = async () => {
    try {
      await postEngagement("share");
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard! 🔗");
      loadStats();
    } catch {
      toast.error("Failed to share");
    }
  };

  // ── Chat helpers ─────────────────────────────────────────────────────────────
  const sendChatMessage = useCallback(() => {
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        user: "You",
        text: chatInput.trim(),
        time: nowTime(),
      },
    ]);
    setChatInput("");
    setTimeout(
      () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      50,
    );
  }, [chatInput]);

  // ── Reaction helpers ─────────────────────────────────────────────────────────
  const sendReaction = useCallback((emoji: string) => {
    const id = Date.now().toString();
    const x = 10 + Math.random() * 80;
    setFloatingReactions((prev) => [...prev, { id, emoji, x }]);
    setTimeout(
      () => setFloatingReactions((prev) => prev.filter((r) => r.id !== id)),
      2500,
    );
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const comments = engagements.filter((e) => e.engagementType === "comment");
  const activeStreams = program?.socialStreams?.filter((s) => s.isActive) ?? [];

  // ─── Loading ──────────────────────────────────────────────────────────────────
  if (isLoadingInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-purple-300 text-lg font-semibold">
            Loading broadcast…
          </p>
        </div>
      </div>
    );
  }

  // ─── Not found ────────────────────────────────────────────────────────────────
  if (!program) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Radio className="w-16 h-16 text-purple-400/40 mx-auto mb-4" />
          <p className="text-white text-2xl font-black mb-2">
            Broadcast Not Found
          </p>
          <p className="text-purple-400">
            This program doesn't exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 pb-10">
      {/* ── Floating reactions overlay (full-screen) ─── */}
      <div className="fixed inset-0 z-30 pointer-events-none overflow-hidden">
        {floatingReactions.map((r) => (
          <div
            key={r.id}
            className="absolute bottom-20 text-3xl select-none"
            style={{
              left: `${r.x}%`,
              animation: "floatUp 2.5s ease-out forwards",
            }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* ── Header ─── */}
      <header className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 backdrop-blur-xl border-b border-purple-500/30 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
                <Mic className="w-5 h-5 text-white" />
              </div>
              {program.isLive && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-black text-lg truncate">
                {program.title}
              </h1>
              <p className="text-purple-400 text-sm truncate">
                Hosted by {program.host}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {program.isLive ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-full">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-400 text-xs font-bold tracking-widest">
                  LIVE
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/40 border border-slate-600/30 rounded-full">
                <WifiOff className="w-3 h-3 text-slate-400" />
                <span className="text-slate-400 text-xs font-bold capitalize">
                  {program.status}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-xs">
              <Headphones className="w-3.5 h-3.5" />
              {program.currentListeners + (hasJoined ? 1 : 0)} listening
            </div>
            <button
              onClick={loadProgram}
              className="p-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── Left column: Player + info ─── */}
          <div className="lg:col-span-2 space-y-6">
            {/* ── Audio Player Card ─── */}
            <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8 shadow-2xl">
              {/* Waveform animation */}
              <div className="flex items-end justify-center gap-1 h-20 mb-8">
                {Array.from({ length: 28 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 rounded-full ${
                      isPlaying
                        ? "bg-gradient-to-t from-purple-600 to-pink-400"
                        : "bg-purple-800/60"
                    }`}
                    style={{
                      height: isPlaying
                        ? `${25 + Math.sin(i * 0.5) * 35 + Math.random() * 20}%`
                        : "25%",
                      animation: isPlaying
                        ? `wave ${0.4 + (i % 5) * 0.1}s ease-in-out infinite alternate`
                        : "none",
                      animationDelay: `${i * 40}ms`,
                      transition: "height 0.3s ease",
                    }}
                  />
                ))}
              </div>

              {/* Program info */}
              <div className="text-center mb-8">
                <h2 className="text-white font-black text-2xl mb-1">
                  {program.title}
                </h2>
                <p className="text-purple-300 text-lg">{program.host}</p>
                {program.description && (
                  <p className="text-purple-400/80 text-sm mt-3 max-w-md mx-auto">
                    {program.description}
                  </p>
                )}
                <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
                  <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-sm font-semibold capitalize">
                    {program.category}
                  </span>
                  <div className="flex items-center gap-1 text-purple-400 text-sm">
                    <Clock className="w-4 h-4" />
                    {fmtDate(program.scheduleStartTime)}
                  </div>
                </div>
                {program.tags?.length > 0 && (
                  <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                    {program.tags.slice(0, 5).map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-xs"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Stream error */}
              {streamError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm text-center">
                  {streamError}
                </div>
              )}

              {/* Direct stream URL player */}
              {program.streamingUrl && (
                <>
                  <audio
                    ref={audioRef}
                    src={program.streamingUrl}
                    preload="none"
                    onPlay={() => {
                      setIsPlaying(true);
                      setStreamError(null);
                    }}
                    onPause={() => setIsPlaying(false)}
                    onError={() =>
                      setStreamError(
                        "Stream unavailable. The broadcast may have ended.",
                      )
                    }
                  />
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-6">
                      {/* Mute */}
                      <button
                        onClick={toggleMute}
                        className="text-purple-400 hover:text-white transition-colors p-2"
                      >
                        {isMuted ? (
                          <VolumeX className="w-6 h-6" />
                        ) : (
                          <Volume2 className="w-6 h-6" />
                        )}
                      </button>
                      {/* Play/Pause */}
                      <button
                        onClick={togglePlay}
                        className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95 ${
                          program.isLive
                            ? "bg-gradient-to-br from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-red-500/30"
                            : "bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-500/30"
                        }`}
                      >
                        {isPlaying ? (
                          <Pause className="w-9 h-9 text-white" />
                        ) : (
                          <Play className="w-9 h-9 text-white ml-1" />
                        )}
                      </button>
                      {/* Placeholder right icon for balance */}
                      <div className="w-10 h-10" />
                    </div>
                    {/* Volume slider */}
                    <div className="flex items-center gap-3 w-full max-w-xs">
                      <VolumeX className="w-4 h-4 text-purple-600" />
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="flex-1 accent-purple-500"
                      />
                      <Volume2 className="w-4 h-4 text-purple-400" />
                    </div>
                    {isPlaying && (
                      <p className="text-green-400 text-sm font-semibold flex items-center gap-2">
                        <Signal className="w-4 h-4" />
                        Streaming live
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* No direct URL — social stream links */}
              {!program.streamingUrl && activeStreams.length > 0 && (
                <div className="space-y-3">
                  <p className="text-purple-300 text-sm font-semibold text-center mb-4">
                    Listen / Watch on:
                  </p>
                  {activeStreams.map((s) => (
                    <a
                      key={s.platform}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => joinStream()}
                      className={`flex items-center justify-between p-4 border rounded-2xl transition-all group ${
                        PLATFORM_COLORS[s.platform] ||
                        "bg-purple-900/30 border-purple-500/30 text-purple-300 hover:bg-purple-900/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Music className="w-5 h-5" />
                        <div>
                          <p className="font-semibold capitalize">
                            {s.label || s.platform}
                          </p>
                          {s.stats && (
                            <p className="text-xs opacity-70">
                              {s.stats.views
                                ? `${s.stats.views.toLocaleString()} views`
                                : ""}
                              {s.stats.likes
                                ? ` · ${s.stats.likes.toLocaleString()} likes`
                                : ""}
                            </p>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                    </a>
                  ))}
                </div>
              )}

              {/* No stream at all */}
              {!program.streamingUrl && activeStreams.length === 0 && (
                <div className="text-center py-6">
                  <WifiOff className="w-10 h-10 text-purple-500/30 mx-auto mb-3" />
                  <p className="text-purple-400 font-semibold">
                    No stream available yet
                  </p>
                  <p className="text-purple-500 text-sm mt-1">
                    {program.isLive
                      ? "Stream link not configured"
                      : `Scheduled for ${fmtDate(program.scheduleStartTime)}`}
                  </p>
                </div>
              )}
            </div>

            {/* ── Engagement stats bar ─── */}
            {stats && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: "Comments",
                    value: stats.commentCount,
                    icon: <MessageSquare className="w-4 h-4" />,
                  },
                  {
                    label: "Likes",
                    value: stats.likeCount,
                    icon: <Heart className="w-4 h-4" />,
                  },
                  {
                    label: "Shares",
                    value: stats.shareCount,
                    icon: <Share2 className="w-4 h-4" />,
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="bg-black/30 border border-purple-500/20 rounded-2xl p-4 flex items-center gap-3"
                  >
                    <div className="text-purple-400">{s.icon}</div>
                    <div>
                      <p className="text-white font-black text-lg leading-none">
                        {s.value}
                      </p>
                      <p className="text-purple-500 text-xs">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Reactions + Like/Share ─── */}
            <div className="bg-black/20 border border-purple-500/20 rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <span className="text-purple-400 text-sm font-semibold mr-1">
                  React:
                </span>
                {REACTIONS.map(({ emoji, label }) => (
                  <button
                    key={emoji}
                    onClick={() => sendReaction(emoji)}
                    title={label}
                    className="text-2xl hover:scale-125 transition-transform active:scale-110"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLike}
                  disabled={hasLiked}
                  className={`flex items-center gap-2 px-4 py-2 border rounded-xl transition-all hover:scale-105 disabled:cursor-not-allowed text-sm font-semibold ${
                    hasLiked
                      ? "bg-pink-600/30 border-pink-500/50 text-pink-300"
                      : "bg-pink-600/20 hover:bg-pink-600/30 border-pink-500/30 text-pink-300"
                  }`}
                >
                  <Heart
                    className={`w-4 h-4 ${hasLiked ? "fill-pink-400" : ""}`}
                  />
                  Like
                </button>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-xl text-blue-300 text-sm font-semibold transition-all hover:scale-105"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>
            </div>

            {/* ── Comments section ─── */}
            <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-purple-400" />
                  Comments ({comments.length})
                </h3>
                <button
                  onClick={() => setShowComments(!showComments)}
                  className="text-purple-300 hover:text-white transition-colors"
                >
                  <ChevronDown
                    className={`w-5 h-5 transition-transform ${showComments ? "rotate-180" : ""}`}
                  />
                </button>
              </div>

              {showComments && (
                <>
                  {/* Input */}
                  <div className="flex gap-3 mb-4">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handlePostComment()
                      }
                      placeholder="Share your thoughts… (login required)"
                      className="flex-1 px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/60 text-sm"
                    />
                    <button
                      onClick={handlePostComment}
                      disabled={isSubmitting || !commentText.trim()}
                      className="px-4 py-3 bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Comments list */}
                  {isLoadingEngagements ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                      {comments.length === 0 && (
                        <p className="text-purple-500 text-sm text-center py-6">
                          No comments yet — be the first!
                        </p>
                      )}
                      {comments.map((e) => {
                        const sent = getSentimentDisplay(e.comment?.sentiment);
                        return (
                          <div
                            key={e._id}
                            className="p-4 bg-black/20 rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition-all"
                          >
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                  {e.user.fullName?.charAt(0)?.toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-white font-semibold text-sm">
                                    {e.user.fullName}
                                  </p>
                                  <p className="text-purple-400 text-xs">
                                    {new Date(e.createdAt).toLocaleTimeString(
                                      [],
                                      { hour: "2-digit", minute: "2-digit" },
                                    )}
                                  </p>
                                </div>
                              </div>
                              {e.comment?.sentiment && (
                                <div
                                  className={`flex items-center gap-1 px-2 py-1 ${sent.bg} rounded-full`}
                                  title={sent.label}
                                >
                                  <span className={sent.color}>
                                    {sent.icon}
                                  </span>
                                </div>
                              )}
                            </div>
                            <p className="text-purple-100 text-sm">
                              {e.comment?.text}
                            </p>
                            {e.comment?.aiAnalysis?.summary && (
                              <div className="mt-2 p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                                <div className="flex items-center gap-1 mb-1">
                                  <Sparkles className="w-3 h-3 text-purple-400" />
                                  <span className="text-purple-300 text-xs font-semibold">
                                    AI Insight
                                  </span>
                                </div>
                                <p className="text-purple-200 text-xs">
                                  {e.comment.aiAnalysis.summary}
                                </p>
                                {e.comment.aiAnalysis.keywords?.length > 0 && (
                                  <div className="flex gap-1 mt-1 flex-wrap">
                                    {e.comment.aiAnalysis.keywords
                                      .slice(0, 4)
                                      .map((kw) => (
                                        <span
                                          key={kw}
                                          className="px-1.5 py-0.5 bg-purple-500/20 rounded text-purple-400 text-xs"
                                        >
                                          #{kw}
                                        </span>
                                      ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {e.comment?.engagementScore != null &&
                              e.comment.engagementScore > 0 && (
                                <div className="flex items-center gap-1 mt-2">
                                  <BarChart2 className="w-3 h-3 text-purple-500" />
                                  <span className="text-purple-500 text-xs">
                                    Engagement score:{" "}
                                    {e.comment.engagementScore}
                                  </span>
                                </div>
                              )}
                          </div>
                        );
                      })}
                      <div ref={commentsEndRef} />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Right column: Live Chat + Program details ─── */}
          <div className="space-y-6">
            {/* ── Live Chat ─── */}
            <div className="bg-slate-900/60 border border-purple-500/20 rounded-2xl overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-purple-500/20 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-400" />
                <span className="text-white font-bold">Live Chat</span>
                {hasJoined && (
                  <span className="ml-auto px-2 py-0.5 bg-green-500/20 border border-green-500/30 rounded-full text-green-400 text-xs">
                    Joined
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-52 max-h-80">
                {chatMessages.length === 0 && (
                  <p className="text-purple-600 text-xs text-center italic mt-4">
                    {program.isLive
                      ? "Start listening to join the chat"
                      : "Chat available when broadcast is live"}
                  </p>
                )}
                {chatMessages.map((msg) => (
                  <div key={msg.id}>
                    {msg.isSystem ? (
                      <p className="text-center text-purple-500 text-xs italic">
                        {msg.text}
                      </p>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span
                            className={`text-xs font-bold ${msg.user === "You" ? "text-pink-400" : "text-purple-300"}`}
                          >
                            {msg.user}
                          </span>
                          <span className="text-purple-600 text-xs">
                            {msg.time}
                          </span>
                        </div>
                        <p className="text-white text-sm mt-0.5">{msg.text}</p>
                      </>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="p-3 border-t border-purple-500/20 flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                  placeholder="Say something…"
                  className="flex-1 px-3 py-2 bg-black/30 border border-purple-500/30 rounded-xl text-white text-sm placeholder-purple-500 focus:outline-none focus:border-purple-500/60"
                />
                <button
                  onClick={sendChatMessage}
                  className="p-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-white transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Program Details ─── */}
            <div className="bg-black/20 border border-purple-500/20 rounded-2xl p-5 space-y-4">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Radio className="w-4 h-4 text-purple-400" />
                Broadcast Info
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-purple-500">Host</span>
                  <span className="text-purple-200 font-semibold">
                    {program.host}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-500">Category</span>
                  <span className="text-purple-200 capitalize">
                    {program.category}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-500">Status</span>
                  <span
                    className={`font-semibold capitalize ${program.isLive ? "text-green-400" : "text-slate-400"}`}
                  >
                    {program.isLive ? "🟢 On Air" : program.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-500">Start</span>
                  <span className="text-purple-200">
                    {fmtDate(program.scheduleStartTime)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-500">End</span>
                  <span className="text-purple-200">
                    {fmtDate(program.scheduleEndTime)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-500">Total listeners</span>
                  <span className="text-purple-200">
                    {program.totalListeners.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Social Streams (sidebar) ─── */}
            {activeStreams.length > 0 && (
              <div className="bg-black/20 border border-purple-500/20 rounded-2xl p-5 space-y-3">
                <h3 className="text-white font-bold flex items-center gap-2 text-sm">
                  <Signal className="w-4 h-4 text-purple-400" />
                  Also Streaming On
                </h3>
                {activeStreams.map((s) => (
                  <a
                    key={s.platform}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 bg-purple-900/30 border border-purple-500/20 hover:border-purple-500/50 rounded-xl transition-all group"
                  >
                    <span className="text-purple-200 text-sm font-semibold capitalize">
                      {s.label || s.platform}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-purple-500 group-hover:text-purple-300 transition-colors" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes wave {
          from {
            transform: scaleY(0.4);
          }
          to {
            transform: scaleY(1);
          }
        }
        @keyframes floatUp {
          0% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(-150px) scale(1.6);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default WatchPage;
