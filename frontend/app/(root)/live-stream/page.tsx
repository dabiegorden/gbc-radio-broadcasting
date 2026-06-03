"use client";

/**
 * LiveStreamUsersPage  (v2 — program-independent)
 * ─────────────────────────────────────────────────
 * Audience-facing page that:
 *   • Lists currently LIVE sessions (GetStream) — viewers join & watch
 *   • Lists past RECORDINGS (Cloudinary) — watch replays in a modal
 *   • Keeps the legacy radio-stream engagement UI (comments, likes, shares)
 *     for any linked Program when a live session is selected
 *
 * Routes consumed:
 *   GET  /stream/sessions/live          → live sessions
 *   GET  /stream/sessions/recordings    → past recordings
 *   GET  /api/stream/token                  → GetStream viewer token
 *   POST /engagement                    → comments / likes / shares
 *   GET  /engagement/program/:id        → fetch comments
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  StreamVideo,
  StreamCall,
  StreamVideoClient,
  LivestreamLayout,
} from "@stream-io/video-react-sdk";
// @ts-ignore: side-effect import of CSS module without type declarations
import "@stream-io/video-react-sdk/dist/css/styles.css";
import {
  Radio,
  Users,
  Heart,
  Share2,
  MessageSquare,
  Send,
  Signal,
  Sparkles,
  Smile,
  Meh,
  Frown,
  Loader2,
  RefreshCw,
  ChevronDown,
  Play,
  Film,
  Clock,
  X,
  Tv2,
  Calendar,
  PlayCircle,
} from "lucide-react";
import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveSession {
  _id: string;
  title: string;
  description: string;
  hostDisplayName: string;
  streamCallId: string;
  streamCallType: string;
  status: "live" | "processing" | "available" | "ended";
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  tags: string[];
  coverImage?: string | null;
  linkedProgram?: string | null;
}

interface Recording {
  _id: string;
  title: string;
  description: string;
  host: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  playbackUrl: string;
  thumbnailUrl?: string;
  tags: string[];
  coverImage?: string | null;
  linkedProgram?: string | null;
}

interface Engagement {
  _id: string;
  user: { _id: string; fullName: string; email: string };
  engagementType: string;
  comment?: {
    text: string;
    sentiment: string | null;
    engagementScore: number;
    aiAnalysis?: { summary: string; keywords: string[] };
  };
  createdAt: string;
}

interface StreamCreds {
  token: string;
  streamUserId: string;
  displayName: string;
  apiKey: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const authHeader = () => ({
  Authorization: `Bearer ${
    typeof window !== "undefined" ? localStorage.getItem("token") : ""
  }`,
  "Content-Type": "application/json",
});

const fmtDuration = (seconds: number | null | undefined) => {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
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
      };
    case "negative":
      return {
        icon: <Frown className="w-4 h-4" />,
        color: "text-red-400",
        bg: "bg-red-500/20",
      };
    default:
      return {
        icon: <Meh className="w-4 h-4" />,
        color: "text-yellow-400",
        bg: "bg-yellow-500/20",
      };
  }
};

// ─── Recording Video Modal ────────────────────────────────────────────────────

const VideoModal = ({
  rec,
  onClose,
}: {
  rec: Recording;
  onClose: () => void;
}) => (
  <div
    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
    onClick={onClose}
  >
    <div
      className="w-full max-w-4xl bg-slate-900 rounded-3xl overflow-hidden border border-purple-500/30 shadow-2xl shadow-purple-500/20"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-purple-500/20">
        <div>
          <p className="text-white font-bold text-lg">{rec.title}</p>
          <p className="text-purple-400 text-sm">
            {rec.host} · {fmtDate(rec.startedAt)}
            {rec.durationSeconds && (
              <span className="ml-2 text-purple-500">
                · {fmtDuration(rec.durationSeconds)}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-purple-500/20 rounded-xl text-purple-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="aspect-video bg-black">
        <video
          src={rec.playbackUrl}
          controls
          autoPlay
          className="w-full h-full"
          poster={rec.thumbnailUrl}
        />
      </div>

      {rec.description && (
        <div className="px-6 py-4 border-t border-purple-500/20">
          <p className="text-purple-300 text-sm">{rec.description}</p>
        </div>
      )}
    </div>
  </div>
);

// ─── Recording Card ───────────────────────────────────────────────────────────

const RecordingCard = ({
  rec,
  onWatch,
}: {
  rec: Recording;
  onWatch: (r: Recording) => void;
}) => (
  <div
    className="bg-black/30 border border-purple-500/20 rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all duration-300 group cursor-pointer"
    onClick={() => onWatch(rec)}
  >
    <div className="relative aspect-video bg-slate-800 overflow-hidden">
      {rec.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={rec.thumbnailUrl}
          alt={rec.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-purple-900/20">
          <Film className="w-12 h-12 text-purple-500/40" />
        </div>
      )}
      {/* Play overlay */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
        <div className="w-14 h-14 rounded-full bg-purple-600/80 flex items-center justify-center shadow-lg">
          <Play className="w-7 h-7 text-white ml-1" />
        </div>
      </div>
      {/* Duration badge */}
      {rec.durationSeconds && (
        <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 rounded text-white text-xs font-mono">
          {fmtDuration(rec.durationSeconds)}
        </span>
      )}
      {/* Replay badge */}
      <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-purple-600/80 border border-purple-500/50 rounded-full">
        <PlayCircle className="w-3 h-3 text-white" />
        <span className="text-white text-xs font-semibold">REPLAY</span>
      </div>
    </div>

    <div className="p-4">
      <p className="text-white font-semibold truncate">{rec.title}</p>
      <p className="text-purple-400 text-xs mt-1">{rec.host}</p>
      <div className="flex items-center gap-1 text-purple-500 text-xs mt-1">
        <Calendar className="w-3 h-3" />
        {fmtDate(rec.startedAt)}
      </div>
      {rec.description && (
        <p className="text-purple-300/70 text-xs mt-2 line-clamp-2">
          {rec.description}
        </p>
      )}
      {rec.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {rec.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-xs"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  </div>
);

// ─── Live Session Viewer (GetStream) ─────────────────────────────────────────

const LiveSessionViewer = ({
  session,
  onClose,
}: {
  session: LiveSession;
  onClose: () => void;
}) => {
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const join = async () => {
      try {
        const res = await fetch(`${API_URL}/api/stream/token`, {
          method: "POST",
          headers: authHeader(),
        });
        const data: { success: boolean; message?: string } & StreamCreds =
          await res.json();
        if (!data.success) throw new Error(data.message);

        const videoClient = new StreamVideoClient({
          apiKey: data.apiKey,
          user: { id: data.streamUserId, name: data.displayName },
          token: data.token,
        });

        const streamCall = videoClient.call(
          session.streamCallType || "livestream",
          session.streamCallId,
        );
        await streamCall.join();

        if (mounted) {
          setClient(videoClient);
          setCall(streamCall);
          setLoading(false);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || "Failed to join stream");
          setLoading(false);
        }
      }
    };
    join();
    return () => {
      mounted = false;
    };
  }, [session]);

  // cleanup
  useEffect(() => {
    return () => {
      call?.leave().catch(() => {});
      client?.disconnectUser().catch(() => {});
    };
  }, [call, client]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-5xl bg-slate-950 rounded-3xl overflow-hidden border border-red-500/30 shadow-2xl shadow-red-500/10 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-red-500/20 bg-red-600/10">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-full">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-400 text-sm font-bold tracking-widest">
                LIVE
              </span>
            </div>
            <div>
              <p className="text-white font-bold">{session.title}</p>
              <p className="text-purple-400 text-sm">
                {session.hostDisplayName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-purple-600/20 hover:bg-red-600/30 border border-purple-500/30 hover:border-red-500/30 rounded-xl text-purple-300 hover:text-red-300 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video */}
        <div className="aspect-video bg-black relative">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-purple-300 text-sm">Joining stream…</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Signal className="w-12 h-12 text-red-400/50" />
              <p className="text-red-300 font-semibold">{error}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-purple-600/20 border border-purple-500/30 rounded-xl text-purple-300 text-sm"
              >
                Close
              </button>
            </div>
          )}
          {!loading && !error && client && call && (
            <StreamVideo client={client}>
              <StreamCall call={call}>
                <LivestreamLayout muted={false} showParticipantCount />
              </StreamCall>
            </StreamVideo>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Comments Section ─────────────────────────────────────────────────────────

const CommentsSection = ({ programId }: { programId: string }) => {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showComments, setShowComments] = useState(true);
  const [hasLiked, setHasLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [shareCount, setShareCount] = useState(0);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const fetchEngagements = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_URL}/engagement/program/${programId}?limit=50`,
      );
      const data = await res.json();
      setEngagements(data.engagements || []);
      setLikeCount(
        (data.engagements || []).filter(
          (e: Engagement) => e.engagementType === "like",
        ).length,
      );
      setShareCount(
        (data.engagements || []).filter(
          (e: Engagement) => e.engagementType === "share",
        ).length,
      );
    } catch {
      /* silent */
    }
  }, [programId]);

  useEffect(() => {
    fetchEngagements();
  }, [fetchEngagements]);

  useEffect(() => {
    if (showComments)
      commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [engagements, showComments]);

  const postEngagement = async (type: string, extra?: object) => {
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
      if (data._id || data.success !== false) {
        toast.success("Comment posted! 💬");
        setCommentText("");
        fetchEngagements();
      } else {
        toast.error(data.message || "Failed to post comment");
      }
    } catch {
      toast.error("Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async () => {
    if (hasLiked) return toast.info("You've already liked this");
    try {
      await postEngagement("like");
      setHasLiked(true);
      setLikeCount((p) => p + 1);
      toast.success("Liked! ❤️");
    } catch {
      toast.error("Failed to like");
    }
  };

  const handleShare = async () => {
    try {
      await postEngagement("share");
      setShareCount((p) => p + 1);
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied! 🔗");
    } catch {
      toast.error("Failed to share");
    }
  };

  const comments = engagements.filter((e) => e.engagementType === "comment");

  return (
    <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-6 shadow-2xl">
      {/* Like / Share */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={handleLike}
          disabled={hasLiked}
          className={`flex items-center gap-2 px-5 py-2.5 border rounded-xl transition-all hover:scale-105 disabled:cursor-not-allowed ${
            hasLiked
              ? "bg-pink-600/30 border-pink-500/50"
              : "bg-pink-600/20 hover:bg-pink-600/30 border-pink-500/30"
          }`}
        >
          <Heart
            className={`w-5 h-5 ${hasLiked ? "text-pink-400 fill-pink-400" : "text-pink-400"}`}
          />
          <span className="text-pink-300 font-semibold">{likeCount}</span>
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-xl transition-all hover:scale-105"
        >
          <Share2 className="w-5 h-5 text-blue-400" />
          <span className="text-blue-300 font-semibold">{shareCount}</span>
        </button>
      </div>

      {/* Comments header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-black text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-purple-400" />
          Live Chat ({comments.length})
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
              onKeyDown={(e) => e.key === "Enter" && handlePostComment()}
              placeholder="Share your thoughts…"
              className="flex-1 px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/60"
            />
            <button
              onClick={handlePostComment}
              disabled={isSubmitting || !commentText.trim()}
              className="px-5 py-3 bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Comment list */}
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
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
                          {new Date(e.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    {e.comment?.sentiment && (
                      <div
                        className={`flex items-center gap-1 px-2 py-1 ${sent.bg} rounded-full`}
                      >
                        <span className={sent.color}>{sent.icon}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-purple-100 text-sm">{e.comment?.text}</p>
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
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={commentsEndRef} />
          </div>
        </>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const LiveStreamUsersPage = () => {
  const [tab, setTab] = useState<"live" | "replays">("live");
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoadingLive, setIsLoadingLive] = useState(true);
  const [isLoadingReplays, setIsLoadingReplays] = useState(false);
  const [watchingLive, setWatchingLive] = useState<LiveSession | null>(null);
  const [watchingRec, setWatchingRec] = useState<Recording | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // ── Fetch live sessions ───────────────────────────────────────────────────
  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/stream/sessions/live`);
      const data = await res.json();
      if (data.success) setLiveSessions(data.sessions || []);
    } catch {
      toast.error("Failed to fetch live sessions");
    }
  }, []);

  // ── Fetch recordings ──────────────────────────────────────────────────────
  const fetchRecordings = useCallback(async () => {
    setIsLoadingReplays(true);
    try {
      const res = await fetch(`${API_URL}/stream/sessions/recordings`);
      const data = await res.json();
      if (data.success) setRecordings(data.recordings || []);
    } catch {
      toast.error("Failed to fetch recordings");
    } finally {
      setIsLoadingReplays(false);
    }
  }, []);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setIsLoadingLive(true);
      await fetchLive();
      setIsLoadingLive(false);
    };
    load();
    const interval = setInterval(fetchLive, 30_000);
    return () => clearInterval(interval);
  }, [fetchLive]);

  useEffect(() => {
    if (tab === "replays" && recordings.length === 0) fetchRecordings();
  }, [tab, recordings.length, fetchRecordings]);

  // ── WebSocket for live session changes ────────────────────────────────────
  useEffect(() => {
    socketRef.current = io(API_URL);
    socketRef.current.on("session-started", fetchLive);
    socketRef.current.on("session-ended", fetchLive);
    return () => {
      socketRef.current?.disconnect();
    };
  }, [fetchLive]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 pb-10">
      {/* Modals */}
      {watchingLive && (
        <LiveSessionViewer
          session={watchingLive}
          onClose={() => setWatchingLive(null)}
        />
      )}
      {watchingRec && (
        <VideoModal rec={watchingRec} onClose={() => setWatchingRec(null)} />
      )}

      {/* Header */}
      <header className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 backdrop-blur-xl border-b border-purple-500/30 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                <Radio className="w-7 h-7 text-white" />
              </div>
              {liveSessions.length > 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-slate-950 animate-pulse" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Live Stream</h1>
              <p className="text-purple-300 text-sm font-semibold">
                {liveSessions.length} session
                {liveSessions.length !== 1 ? "s" : ""} live
              </p>
            </div>
          </div>

          {/* Tabs + Refresh */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-black/30 p-1 rounded-2xl border border-purple-500/20">
              <button
                onClick={() => setTab("live")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                  tab === "live"
                    ? "bg-red-600 text-white shadow-lg shadow-red-500/30"
                    : "text-purple-400 hover:text-white"
                }`}
              >
                <Signal className="w-4 h-4" />
                Live
                {liveSessions.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-red-500/80 rounded-full text-white text-xs">
                    {liveSessions.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setTab("replays")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                  tab === "replays"
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
                    : "text-purple-400 hover:text-white"
                }`}
              >
                <Film className="w-4 h-4" />
                Replays
              </button>
            </div>

            <button
              onClick={tab === "live" ? fetchLive : fetchRecordings}
              className="p-2.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 transition-all"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* ── LIVE tab ── */}
        {tab === "live" && (
          <>
            {isLoadingLive ? (
              <div className="flex items-center justify-center py-32">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-purple-300 text-lg font-semibold">
                    Loading live sessions…
                  </p>
                </div>
              </div>
            ) : liveSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-24 h-24 bg-purple-600/20 border border-purple-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Radio className="w-12 h-12 text-purple-400/50" />
                </div>
                <h3 className="text-2xl font-black text-white mb-3">
                  No Live Sessions
                </h3>
                <p className="text-purple-300 max-w-sm">
                  There are no live broadcasts right now. Check back soon or
                  browse past replays.
                </p>
                <button
                  onClick={() => setTab("replays")}
                  className="mt-6 flex items-center gap-2 px-6 py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 font-semibold transition-all"
                >
                  <Film className="w-4 h-4" />
                  Watch Replays
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── Left: session list ── */}
                <div className="lg:col-span-1 space-y-4">
                  <h2 className="text-white font-black text-lg flex items-center gap-2">
                    <Signal className="w-5 h-5 text-red-400" />
                    Live Now
                  </h2>
                  {liveSessions.map((session) => (
                    <div
                      key={session._id}
                      className="p-5 bg-gradient-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-2xl shadow-xl hover:border-purple-500/60 transition-all duration-300"
                    >
                      {/* Live badge */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 px-2.5 py-1 bg-red-500/20 border border-red-500/30 rounded-full">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                          <span className="text-red-400 text-xs font-bold tracking-widest">
                            LIVE
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-purple-400 text-xs">
                          <Clock className="w-3 h-3" />
                          {fmtDate(session.startedAt)}
                        </div>
                      </div>

                      <h3 className="text-white font-bold text-lg mb-1">
                        {session.title}
                      </h3>
                      <p className="text-purple-300 text-sm mb-3">
                        {session.hostDisplayName}
                      </p>

                      {session.description && (
                        <p className="text-purple-400/80 text-xs mb-3 line-clamp-2">
                          {session.description}
                        </p>
                      )}

                      {session.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-4">
                          {session.tags.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-xs"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={() => setWatchingLive(session)}
                        className="w-full py-3 bg-gradient-to-br from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 rounded-xl text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 transition-all hover:scale-105"
                      >
                        <Tv2 className="w-5 h-5" />
                        Watch Live
                      </button>
                    </div>
                  ))}
                </div>

                {/* ── Right: comments for first session's linked program ── */}
                <div className="lg:col-span-2">
                  {liveSessions[0]?.linkedProgram ? (
                    <CommentsSection
                      programId={liveSessions[0].linkedProgram}
                    />
                  ) : (
                    /* Placeholder when no linked program */
                    <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-12 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
                      <Tv2 className="w-16 h-16 text-purple-400/40 mb-4" />
                      <h3 className="text-white font-black text-xl mb-2">
                        {liveSessions.length > 0
                          ? "Tap Watch Live to join a session"
                          : "No live sessions"}
                      </h3>
                      <p className="text-purple-400 text-sm max-w-xs">
                        Select a live session on the left and click{" "}
                        <strong className="text-purple-300">Watch Live</strong>{" "}
                        to open the stream in a full-screen player.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── REPLAYS tab ── */}
        {tab === "replays" && (
          <>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-white font-black text-2xl">
                  Past Recordings
                </h2>
                <p className="text-purple-400 text-sm mt-1">
                  Watch previous live sessions on demand
                </p>
              </div>
              <button
                onClick={fetchRecordings}
                className="p-2.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {isLoadingReplays ? (
              <div className="flex items-center justify-center py-24">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-purple-300">Loading recordings…</p>
                </div>
              </div>
            ) : recordings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Film className="w-16 h-16 text-purple-500/30 mb-4" />
                <p className="text-white font-bold text-lg">
                  No recordings yet
                </p>
                <p className="text-purple-400 text-sm mt-1 max-w-xs">
                  Recordings appear here after a live session ends and finishes
                  processing.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {recordings.map((rec) => (
                  <RecordingCard
                    key={rec._id}
                    rec={rec}
                    onWatch={setWatchingRec}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LiveStreamUsersPage;
