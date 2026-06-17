"use client";

/**
 * LiveStreamUsersPage  (v4 — Radio + Replays, no video/live tab)
 * ────────────────────────────────────────────────────────────────
 * Two tabs:
 *   1. RADIO   — Radio/program broadcasts (audio, from /programs + /streaming)
 *   2. REPLAYS — Past Cloudinary recordings (inline video player, no modal)
 *
 * Key UX change: radio player is INLINE in the right panel alongside comments.
 * No modal — you can play/pause while typing comments, liking, or sharing.
 *
 * Routes consumed:
 *   GET  /stream/sessions/recordings    → past recordings
 *   GET  /programs                      → all programs
 *   POST /streaming/:programId/join     → increment listener count
 *   POST /streaming/:programId/leave    → decrement listener count
 *   POST /engagement                    → comments / likes / shares
 *   GET  /engagement/program/:id        → fetch comments for a program
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  Radio,
  Heart,
  Share2,
  MessageSquare,
  Send,
  Smile,
  Meh,
  Frown,
  Loader2,
  RefreshCw,
  ChevronDown,
  Play,
  Film,
  Clock,
  Calendar,
  PlayCircle,
  Volume2,
  VolumeX,
  Headphones,
  Music,
  Mic,
  Pause,
  ExternalLink,
  WifiOff,
  Youtube,
  Users,
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import {
  getStreams,
  getSingleStream,
  type YoutubeStream,
  type YoutubeChat,
} from "@/services/youtubeApi";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ─── Types ────────────────────────────────────────────────────────────────────

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
  };
  createdAt: string;
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

const getCategoryColor = (category: string) => {
  const map: Record<string, string> = {
    news: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    music: "bg-pink-500/20 text-pink-300 border-pink-500/30",
    sports: "bg-green-500/20 text-green-300 border-green-500/30",
    talk: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    comedy: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    education: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    other: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  };
  return map[category?.toLowerCase()] || map.other;
};

// ─── Inline Radio Player Panel ────────────────────────────────────────────────
// Sits in the right column. No modal — you keep it open while chatting.

const InlineRadioPlayer = ({
  program,
  onStop,
}: {
  program: Program;
  onStop: () => void;
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [hasJoined, setHasJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Join stream on mount
  useEffect(() => {
    fetch(`${API_URL}/streaming/${program._id}/join`, {
      method: "POST",
    }).catch(() => {});
    setHasJoined(true);
    return () => {
      fetch(`${API_URL}/streaming/${program._id}/leave`, {
        method: "POST",
      }).catch(() => {});
    };
  }, [program._id]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setError(null);
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() =>
          setError("Could not play stream. The stream may be offline."),
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

  return (
    <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 backdrop-blur-xl border border-purple-500/40 rounded-3xl overflow-hidden shadow-2xl shadow-purple-500/20">
      {/* Player header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-purple-500/20 bg-black/20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Radio className="w-5 h-5 text-white" />
            </div>
            {program.isLive && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold truncate leading-tight">
              {program.title}
            </p>
            <p className="text-purple-400 text-xs truncate">{program.host}</p>
          </div>
        </div>
        <button
          onClick={onStop}
          title="Stop & close player"
          className="shrink-0 ml-3 px-3 py-1.5 rounded-xl text-xs font-semibold text-purple-400 hover:text-white bg-purple-500/10 hover:bg-red-500/20 border border-purple-500/20 hover:border-red-500/30 transition-all"
        >
          Stop
        </button>
      </div>

      {/* Waveform visualiser */}
      <div className="flex items-end justify-center gap-[3px] h-14 px-6 pt-4">
        {Array.from({ length: 28 }).map((_, i) => (
          <div
            key={i}
            className={`w-1 rounded-full transition-all ${
              isPlaying
                ? "bg-gradient-to-t from-purple-600 to-pink-400"
                : "bg-purple-800/60"
            }`}
            style={
              isPlaying
                ? {
                    height: `${30 + Math.sin(i * 0.7) * 22}%`,
                    animation: `wave ${0.6 + i * 0.04}s ease-in-out infinite alternate`,
                    animationDelay: `${i * 40}ms`,
                  }
                : { height: "15%" }
            }
          />
        ))}
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-center gap-3 px-5 pt-3 pb-1 flex-wrap">
        <span
          className={`px-2.5 py-0.5 border rounded-full text-xs font-semibold ${getCategoryColor(program.category)}`}
        >
          {program.category}
        </span>
        {program.isLive && (
          <div className="flex items-center gap-1.5 text-purple-400 text-xs">
            <Headphones className="w-3.5 h-3.5" />
            <span>
              {program.currentListeners + (hasJoined ? 1 : 0)} listening
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-5 mt-2 p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs text-center flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="px-5 pb-5 pt-3">
        {program.streamingUrl ? (
          <>
            <audio
              ref={audioRef}
              src={program.streamingUrl}
              preload="none"
              onError={() =>
                setError("Stream error. The broadcast may be offline.")
              }
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />

            {/* Big play button */}
            <div className="flex justify-center mb-4">
              <button
                onClick={togglePlay}
                className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-full flex items-center justify-center shadow-xl shadow-purple-500/40 transition-all hover:scale-110 active:scale-95"
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 text-white" />
                ) : (
                  <Play className="w-7 h-7 text-white ml-1" />
                )}
              </button>
            </div>

            {/* Volume row */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleMute}
                className="text-purple-400 hover:text-white transition-colors shrink-0"
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="flex-1 accent-purple-500 h-1.5 rounded-full"
              />
              <span className="text-purple-500 text-xs w-7 text-right shrink-0">
                {Math.round(volume * 100)}%
              </span>
            </div>
          </>
        ) : (
          /* No direct stream URL — social stream links */
          <div className="space-y-2 mt-1">
            <p className="text-purple-400 text-xs text-center mb-3">
              Listen via external platform:
            </p>
            {program.socialStreams
              ?.filter((s) => s.isActive)
              .map((s) => (
                <a
                  key={s.platform}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3.5 bg-purple-900/30 border border-purple-500/30 hover:border-purple-500/60 rounded-xl transition-all group"
                >
                  <span className="text-white font-semibold text-sm capitalize">
                    {s.platform}
                  </span>
                  <ExternalLink className="w-4 h-4 text-purple-400 group-hover:text-white transition-colors" />
                </a>
              ))}
            {(!program.socialStreams ||
              program.socialStreams.filter((s) => s.isActive).length === 0) && (
              <p className="text-purple-500 text-sm text-center py-2">
                No stream link available yet.
              </p>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes wave {
          from {
            transform: scaleY(0.4);
          }
          to {
            transform: scaleY(1);
          }
        }
      `}</style>
    </div>
  );
};

// ─── Inline Replay Video Player ───────────────────────────────────────────────
// Shown in the right panel when a recording is selected. No modal.

const InlineReplayPlayer = ({
  rec,
  onClose,
}: {
  rec: Recording;
  onClose: () => void;
}) => (
  <div className="bg-slate-900/80 border border-purple-500/30 rounded-3xl overflow-hidden shadow-2xl shadow-purple-500/10">
    {/* Header */}
    <div className="flex items-center justify-between px-5 py-4 border-b border-purple-500/20 bg-black/20">
      <div className="min-w-0">
        <p className="text-white font-bold truncate">{rec.title}</p>
        <p className="text-purple-400 text-xs">
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
        className="shrink-0 ml-3 px-3 py-1.5 rounded-xl text-xs font-semibold text-purple-400 hover:text-white bg-purple-500/10 hover:bg-red-500/20 border border-purple-500/20 hover:border-red-500/30 transition-all"
      >
        Close
      </button>
    </div>

    {/* Video */}
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
      <div className="px-5 py-3 border-t border-purple-500/20">
        <p className="text-purple-300 text-sm">{rec.description}</p>
      </div>
    )}

    {rec.tags?.length > 0 && (
      <div className="px-5 pb-4 flex flex-wrap gap-1.5">
        {rec.tags.map((tag) => (
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
);

// ─── Inline YouTube Live Player + Comments ────────────────────────────────────
// Shows just the embedded video and the live chat/comments — no analytics,
// no charts, no sentiment breakdowns (those stay on the admin dashboard).

const YoutubeLivePlayer = ({ stream }: { stream: YoutubeStream }) => {
  const [chats, setChats] = useState<YoutubeChat[]>([]);
  const [viewers, setViewers] = useState<number>(
    stream.currentViewers ?? stream.viewers ?? 0,
  );
  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getSingleStream(stream._id)
      .then((data) => {
        if (!cancelled) setChats(data.recentChats || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [stream._id]);

  useEffect(() => {
    const socket = io(API_URL as string);
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-youtube-stream", { streamId: stream._id });
    });

    socket.on("liveStatsUpdated", (data: any) => {
      if (data.streamId !== stream._id) return;
      if (data.stats?.currentViewers != null)
        setViewers(data.stats.currentViewers);
    });

    socket.on("newLiveChatMessage", (data: any) => {
      if (data.streamId !== stream._id) return;
      setChats((prev) => [...prev, ...(data.messages || [])].slice(-200));
    });

    return () => {
      socket.emit("leave-youtube-stream", { streamId: stream._id });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [stream._id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

  return (
    <div className="space-y-5">
      {/* Video */}
      <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 backdrop-blur-xl border border-purple-500/40 rounded-3xl overflow-hidden shadow-2xl shadow-purple-500/20">
        <div className="flex items-center justify-between px-5 py-4 border-b border-purple-500/20 bg-black/20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-rose-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30">
                <Youtube className="w-5 h-5 text-white" />
              </div>
              {stream.isLiveNow && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold truncate leading-tight">
                {stream.title || "YouTube Live"}
              </p>
              <p className="text-purple-400 text-xs truncate">
                {stream.channelTitle || "—"}
              </p>
            </div>
          </div>
          {stream.isLiveNow && (
            <div className="flex items-center gap-1.5 text-purple-300 text-xs shrink-0 ml-3">
              <Users className="w-3.5 h-3.5" />
              <span>{viewers} watching</span>
            </div>
          )}
        </div>

        {stream.youtubeVideoId ? (
          <div className="aspect-video bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${stream.youtubeVideoId}?autoplay=0`}
              title={stream.title || "YouTube live stream"}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="aspect-video bg-black flex items-center justify-center">
            <p className="text-purple-400 text-sm">Video unavailable</p>
          </div>
        )}
      </div>

      {/* Comments / live chat (read-only, no analytics) */}
      <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-6 shadow-2xl">
        <h3 className="text-xl font-black text-white flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-purple-400" />
          Live Comments ({chats.length})
        </h3>
        <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-purple-700/40 scrollbar-track-transparent">
          {chats.length === 0 && (
            <p className="text-purple-500 text-sm text-center py-6">
              {stream.isLiveNow
                ? "Waiting for comments…"
                : "No comments available — this stream isn't live."}
            </p>
          )}
          {chats.map((c, i) => (
            <div
              key={`${c.publishedAt}-${i}`}
              className="p-4 bg-black/20 rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition-all"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-rose-600 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {c.authorName?.charAt(0)?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">
                    {c.authorName}
                  </p>
                  <p className="text-purple-400 text-xs">
                    {new Date(c.publishedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              <p className="text-purple-100 text-sm">{c.message}</p>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>
    </div>
  );
};

// ─── YouTube Stream Card ──────────────────────────────────────────────────────

const YoutubeStreamCard = ({
  stream,
  isSelected,
  onSelect,
}: {
  stream: YoutubeStream;
  isSelected: boolean;
  onSelect: (s: YoutubeStream) => void;
}) => (
  <div
    className={`border rounded-2xl overflow-hidden transition-all duration-300 group cursor-pointer ${
      isSelected
        ? "border-red-500/70 bg-red-900/20 shadow-lg shadow-red-500/20"
        : "bg-black/30 border-purple-500/20 hover:border-purple-500/50"
    }`}
    onClick={() => onSelect(stream)}
  >
    <div className="relative aspect-video bg-slate-800 overflow-hidden">
      {stream.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={stream.thumbnail}
          alt={stream.title || "thumbnail"}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-purple-900/20">
          <Youtube className="w-12 h-12 text-red-500/40" />
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
        <div className="w-12 h-12 rounded-full bg-red-600/80 flex items-center justify-center shadow-lg">
          <Play className="w-6 h-6 text-white ml-0.5" />
        </div>
      </div>
      {stream.isLiveNow && (
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-red-600/80 border border-red-500/50 rounded-full">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          <span className="text-white text-xs font-bold">LIVE</span>
        </div>
      )}
    </div>
    <div className="p-4">
      <p className="text-white font-semibold truncate text-sm">
        {stream.title || "Untitled stream"}
      </p>
      <p className="text-purple-400 text-xs mt-0.5 truncate">
        {stream.channelTitle || "—"}
      </p>
    </div>
  </div>
);

// ─── Recording Card ───────────────────────────────────────────────────────────

const RecordingCard = ({
  rec,
  isSelected,
  onSelect,
}: {
  rec: Recording;
  isSelected: boolean;
  onSelect: (r: Recording) => void;
}) => (
  <div
    className={`border rounded-2xl overflow-hidden transition-all duration-300 group cursor-pointer ${
      isSelected
        ? "border-purple-500/70 bg-purple-900/30 shadow-lg shadow-purple-500/20"
        : "bg-black/30 border-purple-500/20 hover:border-purple-500/50"
    }`}
    onClick={() => onSelect(rec)}
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
        <div className="w-12 h-12 rounded-full bg-purple-600/80 flex items-center justify-center shadow-lg">
          <Play className="w-6 h-6 text-white ml-0.5" />
        </div>
      </div>
      {rec.durationSeconds && (
        <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 rounded text-white text-xs font-mono">
          {fmtDuration(rec.durationSeconds)}
        </span>
      )}
      <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-purple-600/80 border border-purple-500/50 rounded-full">
        <PlayCircle className="w-3 h-3 text-white" />
        <span className="text-white text-xs font-semibold">REPLAY</span>
      </div>
      {isSelected && (
        <div className="absolute inset-0 border-2 border-purple-500/70 rounded-none pointer-events-none" />
      )}
    </div>
    <div className="p-4">
      <p className="text-white font-semibold truncate text-sm">{rec.title}</p>
      <p className="text-purple-400 text-xs mt-0.5">{rec.host}</p>
      <div className="flex items-center gap-1 text-purple-500 text-xs mt-1">
        <Calendar className="w-3 h-3" />
        {fmtDate(rec.startedAt)}
      </div>
    </div>
  </div>
);

// ─── Broadcast Card ───────────────────────────────────────────────────────────

const BroadcastCard = ({
  program,
  isSelected,
  onListen,
}: {
  program: Program;
  isSelected: boolean;
  onListen: (p: Program) => void;
}) => (
  <div
    className={`border rounded-2xl p-5 shadow-xl transition-all duration-300 flex flex-col gap-3 ${
      isSelected
        ? "bg-gradient-to-br from-purple-800/60 to-pink-800/60 border-purple-400/60 shadow-purple-500/30"
        : "bg-gradient-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border-purple-500/30 hover:border-purple-500/60"
    }`}
  >
    {/* Top row */}
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
            <Mic className="w-5 h-5 text-white" />
          </div>
          {program.isLive && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold truncate">{program.title}</p>
          <p className="text-purple-400 text-sm truncate">{program.host}</p>
        </div>
      </div>
      {program.isLive ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/20 border border-red-500/30 rounded-full shrink-0">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-red-400 text-xs font-bold tracking-widest">
            LIVE
          </span>
        </div>
      ) : (
        <div className="px-2.5 py-1 bg-slate-700/40 border border-slate-600/30 rounded-full shrink-0">
          <span className="text-slate-400 text-xs font-semibold capitalize">
            {program.status}
          </span>
        </div>
      )}
    </div>

    {/* Description */}
    {program.description && (
      <p className="text-purple-300/80 text-xs line-clamp-2">
        {program.description}
      </p>
    )}

    {/* Meta */}
    <div className="flex items-center gap-3 text-xs text-purple-400 flex-wrap">
      <span
        className={`px-2 py-0.5 border rounded-full text-xs font-semibold ${getCategoryColor(program.category)}`}
      >
        {program.category}
      </span>
      {program.isLive && (
        <div className="flex items-center gap-1">
          <Headphones className="w-3.5 h-3.5" />
          <span>{program.currentListeners} listening</span>
        </div>
      )}
      {!program.isLive && program.scheduleStartTime && (
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          <span>{fmtDate(program.scheduleStartTime)}</span>
        </div>
      )}
    </div>

    {/* Tags */}
    {program.tags?.length > 0 && (
      <div className="flex flex-wrap gap-1">
        {program.tags.slice(0, 3).map((t) => (
          <span
            key={t}
            className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-xs"
          >
            #{t}
          </span>
        ))}
      </div>
    )}

    {/* CTA */}
    <button
      onClick={() => onListen(program)}
      className={`w-full py-2.5 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 ${
        program.isLive
          ? "bg-gradient-to-br from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-lg shadow-red-500/20"
          : "bg-gradient-to-br from-purple-700 to-pink-700 hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/20"
      }`}
    >
      {program.isLive ? (
        <>
          <Volume2 className="w-4 h-4" />
          {isSelected ? "Now Playing" : "Listen Live"}
        </>
      ) : (
        <>
          <Music className="w-4 h-4" />
          View Program
        </>
      )}
    </button>
  </div>
);

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
      if (data.engagement || data._id || data.success !== false) {
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

      {/* Chat header */}
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
          {/* Comment input */}
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePostComment()}
              placeholder="Share your thoughts…"
              className="flex-1 px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/60 text-sm"
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

          {/* Comments list */}
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-purple-700/40 scrollbar-track-transparent">
            {comments.length === 0 && (
              <p className="text-purple-500 text-sm text-center py-6">
                No comments yet. Be the first!
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
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
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
                        className={`flex items-center gap-1 px-2 py-1 ${sent.bg} rounded-full shrink-0`}
                      >
                        <span className={sent.color}>{sent.icon}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-purple-100 text-sm">{e.comment?.text}</p>
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
  const [tab, setTab] = useState<"radio" | "youtube" | "replays">("radio");

  // Radio state
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(false);
  const [activeProgram, setActiveProgram] = useState<Program | null>(null); // currently playing
  const [selectedProgramForChat, setSelectedProgramForChat] =
    useState<Program | null>(null);

  // YouTube live state
  const [youtubeStreams, setYoutubeStreams] = useState<YoutubeStream[]>([]);
  const [isLoadingYoutube, setIsLoadingYoutube] = useState(false);
  const [selectedYoutubeStream, setSelectedYoutubeStream] =
    useState<YoutubeStream | null>(null);

  // Replays state
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoadingReplays, setIsLoadingReplays] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(
    null,
  );

  const socketRef = useRef<Socket | null>(null);

  // ── Fetch radio/broadcast programs ────────────────────────────────────────
  const fetchPrograms = useCallback(async () => {
    setIsLoadingPrograms(true);
    try {
      const res = await fetch(
        `${API_URL}/programs?sortBy=isLive&sortOrder=desc&limit=50`,
      );
      const data = await res.json();
      if (data.programs) {
        const sorted = [...(data.programs as Program[])].sort((a, b) => {
          if (a.isLive && !b.isLive) return -1;
          if (!a.isLive && b.isLive) return 1;
          return (
            new Date(a.scheduleStartTime).getTime() -
            new Date(b.scheduleStartTime).getTime()
          );
        });
        setPrograms(sorted);
      }
    } catch {
      toast.error("Failed to fetch broadcasts");
    } finally {
      setIsLoadingPrograms(false);
    }
  }, []);

  // ── Fetch monitored YouTube live streams ──────────────────────────────────
  const fetchYoutubeStreams = useCallback(async () => {
    setIsLoadingYoutube(true);
    try {
      const data = await getStreams({ limit: 50 });
      const streams = data.streams || [];
      const sorted = [...streams].sort((a, b) => {
        if (a.isLiveNow && !b.isLiveNow) return -1;
        if (!a.isLiveNow && b.isLiveNow) return 1;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
      setYoutubeStreams(sorted);
      setSelectedYoutubeStream((prev) => {
        if (!prev) return sorted.find((s) => s.isLiveNow) || null;
        return sorted.find((s) => s._id === prev._id) || prev;
      });
    } catch {
      toast.error("Failed to fetch YouTube streams");
    } finally {
      setIsLoadingYoutube(false);
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

  // Initial load
  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  useEffect(() => {
    if (tab === "replays" && recordings.length === 0) fetchRecordings();
  }, [tab, recordings.length, fetchRecordings]);

  useEffect(() => {
    if (tab === "youtube" && youtubeStreams.length === 0)
      fetchYoutubeStreams();
  }, [tab, youtubeStreams.length, fetchYoutubeStreams]);

  // WebSocket
  useEffect(() => {
    socketRef.current = io(API_URL as string);
    socketRef.current.on("stream-status-updated", fetchPrograms);
    return () => {
      socketRef.current?.disconnect();
    };
  }, [fetchPrograms]);

  // Handle pressing "Listen Live" on a broadcast card
  const handleListen = (program: Program) => {
    // Toggle off if clicking the same one again
    if (activeProgram?._id === program._id) {
      setActiveProgram(null);
    } else {
      setActiveProgram(program);
    }
    setSelectedProgramForChat(program);
  };

  // Handle clicking a recording card
  const handleSelectRecording = (rec: Recording) => {
    setSelectedRecording((prev) => (prev?._id === rec._id ? null : rec));
  };

  const livePrograms = programs.filter((p) => p.isLive);
  const upcomingPrograms = programs.filter(
    (p) => !p.isLive && p.status !== "completed",
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 pb-12">
      {/* ── Header ── */}
      <header className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 backdrop-blur-xl border-b border-purple-500/30 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                <Radio className="w-7 h-7 text-white" />
              </div>
              {livePrograms.length > 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-slate-950 animate-pulse" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Broadcast Hub</h1>
              <p className="text-purple-300 text-sm font-semibold">
                {livePrograms.length > 0
                  ? `${livePrograms.length} on air now`
                  : "Tune in anytime"}
              </p>
            </div>
          </div>

          {/* Tabs + Refresh */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-black/30 p-1 rounded-2xl border border-purple-500/20">
              <button
                onClick={() => setTab("radio")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                  tab === "radio"
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
                    : "text-purple-400 hover:text-white"
                }`}
              >
                <Radio className="w-4 h-4" />
                Radio
                {livePrograms.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-red-500/80 rounded-full text-white text-xs leading-none">
                    {livePrograms.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setTab("youtube")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                  tab === "youtube"
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
                    : "text-purple-400 hover:text-white"
                }`}
              >
                <Youtube className="w-4 h-4" />
                YouTube Live
                {youtubeStreams.filter((s) => s.isLiveNow).length > 0 && (
                  <span className="px-1.5 py-0.5 bg-red-500/80 rounded-full text-white text-xs leading-none">
                    {youtubeStreams.filter((s) => s.isLiveNow).length}
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
              onClick={
                tab === "radio"
                  ? fetchPrograms
                  : tab === "youtube"
                    ? fetchYoutubeStreams
                    : fetchRecordings
              }
              className="p-2.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 transition-all"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* ══════════════════ RADIO TAB ══════════════════ */}
        {tab === "radio" && (
          <>
            {isLoadingPrograms ? (
              <div className="flex items-center justify-center py-32">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-purple-300 text-lg font-semibold">
                    Loading broadcasts…
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── Left: program list ── */}
                <div className="lg:col-span-1 space-y-6">
                  {livePrograms.length > 0 && (
                    <div>
                      <h2 className="text-white font-black text-lg flex items-center gap-2 mb-4">
                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                        On Air Now
                      </h2>
                      <div className="space-y-4">
                        {livePrograms.map((p) => (
                          <BroadcastCard
                            key={p._id}
                            program={p}
                            isSelected={activeProgram?._id === p._id}
                            onListen={handleListen}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {upcomingPrograms.length > 0 && (
                    <div>
                      <h2 className="text-white font-black text-lg flex items-center gap-2 mb-4">
                        <Calendar className="w-5 h-5 text-purple-400" />
                        Coming Up
                      </h2>
                      <div className="space-y-4">
                        {upcomingPrograms.slice(0, 6).map((p) => (
                          <BroadcastCard
                            key={p._id}
                            program={p}
                            isSelected={activeProgram?._id === p._id}
                            onListen={handleListen}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {programs.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                      <Radio className="w-16 h-16 text-purple-500/30 mb-4" />
                      <p className="text-white font-bold text-lg">
                        No broadcasts yet
                      </p>
                      <p className="text-purple-400 text-sm mt-1 max-w-xs">
                        Check back soon for scheduled and live radio programs.
                      </p>
                    </div>
                  )}
                </div>

                {/* ── Right: inline player + chat ── */}
                <div className="lg:col-span-2 space-y-5">
                  {/* Inline player — only shown when a program is active */}
                  {activeProgram && (
                    <InlineRadioPlayer
                      key={activeProgram._id}
                      program={activeProgram}
                      onStop={() => setActiveProgram(null)}
                    />
                  )}

                  {/* Comments / chat */}
                  {selectedProgramForChat ? (
                    <div className="space-y-4">
                      {/* Program info bar */}
                      <div className="flex items-center justify-between p-4 bg-purple-900/30 border border-purple-500/30 rounded-2xl flex-wrap gap-3">
                        <div>
                          <p className="text-white font-bold">
                            {selectedProgramForChat.title}
                          </p>
                          <p className="text-purple-400 text-sm">
                            {selectedProgramForChat.host}
                          </p>
                        </div>
                        {/* If not playing yet, show a play button in the info bar too */}
                        {activeProgram?._id !== selectedProgramForChat._id && (
                          <button
                            onClick={() => handleListen(selectedProgramForChat)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white font-semibold text-sm transition-all ${
                              selectedProgramForChat.isLive
                                ? "bg-red-600/80 hover:bg-red-600"
                                : "bg-purple-600/80 hover:bg-purple-600"
                            }`}
                          >
                            <Play className="w-4 h-4" />
                            {selectedProgramForChat.isLive
                              ? "Listen Live"
                              : "Open"}
                          </button>
                        )}
                      </div>
                      <CommentsSection programId={selectedProgramForChat._id} />
                    </div>
                  ) : (
                    /* Placeholder when nothing selected */
                    <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-12 flex flex-col items-center justify-center text-center min-h-[300px]">
                      <Radio className="w-16 h-16 text-purple-400/40 mb-4" />
                      <h3 className="text-white font-black text-xl mb-2">
                        Select a broadcast
                      </h3>
                      <p className="text-purple-400 text-sm max-w-xs">
                        Click{" "}
                        <strong className="text-purple-300">Listen Live</strong>{" "}
                        on any program to start the player and join the live
                        chat — all on the same page.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════════ YOUTUBE LIVE TAB ══════════════════ */}
        {tab === "youtube" && (
          <>
            {isLoadingYoutube ? (
              <div className="flex items-center justify-center py-32">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-purple-300 text-lg font-semibold">
                    Loading YouTube streams…
                  </p>
                </div>
              </div>
            ) : youtubeStreams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Youtube className="w-16 h-16 text-purple-500/30 mb-4" />
                <p className="text-white font-bold text-lg">
                  No YouTube live streams yet
                </p>
                <p className="text-purple-400 text-sm mt-1 max-w-xs">
                  Check back soon — streams will appear here once they go
                  live on YouTube.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── Left: stream list ── */}
                <div className="lg:col-span-1 space-y-3">
                  <h2 className="text-white font-black text-lg flex items-center gap-2 mb-2">
                    <Youtube className="w-5 h-5 text-red-500" />
                    {youtubeStreams.length} Stream
                    {youtubeStreams.length !== 1 ? "s" : ""}
                  </h2>
                  <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                    {youtubeStreams.map((s) => (
                      <YoutubeStreamCard
                        key={s._id}
                        stream={s}
                        isSelected={selectedYoutubeStream?._id === s._id}
                        onSelect={setSelectedYoutubeStream}
                      />
                    ))}
                  </div>
                </div>

                {/* ── Right: video + comments ── */}
                <div className="lg:col-span-2">
                  {selectedYoutubeStream ? (
                    <YoutubeLivePlayer
                      key={selectedYoutubeStream._id}
                      stream={selectedYoutubeStream}
                    />
                  ) : (
                    <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
                      <Youtube className="w-16 h-16 text-red-400/40 mb-4" />
                      <h3 className="text-white font-black text-xl mb-2">
                        Select a stream
                      </h3>
                      <p className="text-purple-400 text-sm max-w-xs">
                        Pick any stream on the left to watch the video and
                        follow the live comments here.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════════ REPLAYS TAB ══════════════════ */}
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── Left: recording card grid ── */}
                <div className="lg:col-span-1 space-y-4">
                  <h2 className="text-white font-black text-lg flex items-center gap-2 mb-2">
                    <Film className="w-5 h-5 text-purple-400" />
                    {recordings.length} Recording
                    {recordings.length !== 1 ? "s" : ""}
                  </h2>
                  <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                    {recordings.map((rec) => (
                      <RecordingCard
                        key={rec._id}
                        rec={rec}
                        isSelected={selectedRecording?._id === rec._id}
                        onSelect={handleSelectRecording}
                      />
                    ))}
                  </div>
                </div>

                {/* ── Right: inline video player ── */}
                <div className="lg:col-span-2">
                  {selectedRecording ? (
                    <InlineReplayPlayer
                      key={selectedRecording._id}
                      rec={selectedRecording}
                      onClose={() => setSelectedRecording(null)}
                    />
                  ) : (
                    <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
                      <PlayCircle className="w-16 h-16 text-purple-400/40 mb-4" />
                      <h3 className="text-white font-black text-xl mb-2">
                        Select a recording
                      </h3>
                      <p className="text-purple-400 text-sm max-w-xs">
                        Pick any recording on the left to play it here.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LiveStreamUsersPage;
