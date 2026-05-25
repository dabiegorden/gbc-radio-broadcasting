"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
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
  Tv2,
  ExternalLink,
  Youtube,
  X,
  Maximize2,
  MonitorPlay,
} from "lucide-react";
import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SocialStream {
  _id: string;
  platform: "tiktok" | "facebook" | "instagram" | "youtube";
  url: string;
  embedUrl: string | null;
  isActive: boolean;
  label: string | null;
}

interface Program {
  _id: string;
  title: string;
  description: string;
  host: string;
  category: string;
  scheduleStartTime: string;
  scheduleEndTime: string;
  isLive: boolean;
  currentListeners: number;
  totalListeners: number;
  streamingUrl: string;
  socialStreams: SocialStream[];
  status: string;
  coverImage?: string;
  tags: string[];
}

interface Engagement {
  _id: string;
  user: {
    _id: string;
    fullName: string;
    email: string;
  };
  engagementType: string;
  comment?: {
    text: string;
    sentiment: string | null;
    engagementScore: number;
    aiAnalysis?: {
      summary: string;
      keywords: string[];
    };
  };
  createdAt: string;
}

// ─── Platform helpers ─────────────────────────────────────────────────────────

const PLATFORM_META: Record<
  string,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: string;
  }
> = {
  youtube: {
    label: "YouTube",
    color: "text-red-400",
    bgColor: "bg-red-600/20",
    borderColor: "border-red-500/30",
    icon: "YT",
  },
  facebook: {
    label: "Facebook",
    color: "text-blue-400",
    bgColor: "bg-blue-600/20",
    borderColor: "border-blue-500/30",
    icon: "FB",
  },
  instagram: {
    label: "Instagram",
    color: "text-pink-400",
    bgColor: "bg-pink-600/20",
    borderColor: "border-pink-500/30",
    icon: "IG",
  },
  tiktok: {
    label: "TikTok",
    color: "text-purple-300",
    bgColor: "bg-purple-600/20",
    borderColor: "border-purple-500/30",
    icon: "TT",
  },
};

// SVG platform icons (inline, lightweight)
const PlatformIcon = ({
  platform,
  className = "w-5 h-5",
}: {
  platform: string;
  className?: string;
}) => {
  switch (platform) {
    case "youtube":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case "facebook":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case "instagram":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
        </svg>
      );
    default:
      return <MonitorPlay className={className} />;
  }
};

// ─── Social Stream Modal ──────────────────────────────────────────────────────

const SocialStreamModal = ({
  stream,
  programTitle,
  onClose,
}: {
  stream: SocialStream;
  programTitle: string;
  onClose: () => void;
}) => {
  const meta = PLATFORM_META[stream.platform] || PLATFORM_META.youtube;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-4xl bg-slate-950 border border-purple-500/30 rounded-3xl overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-purple-500/20">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 ${meta.bgColor} border ${meta.borderColor} rounded-xl`}
            >
              <PlatformIcon
                platform={stream.platform}
                className={`w-5 h-5 ${meta.color}`}
              />
            </div>
            <div>
              <p className="text-white font-bold">{meta.label} Live</p>
              <p className="text-purple-300 text-sm">
                {stream.label || programTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={stream.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 text-sm font-semibold transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              Open {meta.label}
            </a>
            <button
              onClick={onClose}
              className="p-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-xl text-red-400 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Embed or Fallback */}
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          {stream.embedUrl ? (
            <iframe
              src={stream.embedUrl}
              className="absolute inset-0 w-full h-full"
              allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
              allowFullScreen
              title={`${meta.label} stream - ${programTitle}`}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 gap-4">
              <div
                className={`p-6 ${meta.bgColor} border ${meta.borderColor} rounded-3xl`}
              >
                <PlatformIcon
                  platform={stream.platform}
                  className={`w-16 h-16 ${meta.color}`}
                />
              </div>
              <div className="text-center px-8">
                <p className="text-white font-bold text-xl mb-2">
                  {meta.label} Live
                </p>
                <p className="text-purple-300 mb-6">
                  {stream.platform === "tiktok" ||
                  stream.platform === "instagram"
                    ? `${meta.label} live streams can't be embedded — tap below to watch directly.`
                    : `This stream isn't embeddable. Watch it directly on ${meta.label}.`}
                </p>
                <a
                  href={stream.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 px-8 py-3 ${meta.bgColor} border ${meta.borderColor} rounded-xl ${meta.color} font-bold text-lg transition-all hover:scale-105`}
                >
                  <ExternalLink className="w-5 h-5" />
                  Watch on {meta.label}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const LiveStreamUsersPage = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(70);
  const [livePrograms, setLivePrograms] = useState<Program[]>([]);
  const [currentProgram, setCurrentProgram] = useState<Program | null>(null);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [showComments, setShowComments] = useState(true);
  const [showStreams, setShowStreams] = useState(true);
  const [likeCount, setLikeCount] = useState(0);
  const [shareCount, setShareCount] = useState(0);

  // Social stream modal
  const [activeStream, setActiveStream] = useState<SocialStream | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [engagements]);

  // Initialize audio
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Initialize WebSocket
  useEffect(() => {
    socketRef.current = io(API_URL);

    socketRef.current.on("connect", () => {
      console.log("WebSocket connected");
    });

    socketRef.current.on("engagement-created", (data: any) => {
      if (currentProgram && data.programId === currentProgram._id) {
        fetchEngagements(currentProgram._id);
        if (data.engagement.engagementType === "like")
          setLikeCount((p) => p + 1);
        else if (data.engagement.engagementType === "share")
          setShareCount((p) => p + 1);
      }
    });

    socketRef.current.on("listener-joined", (data: any) => {
      if (currentProgram && data.programId === currentProgram._id) {
        setCurrentProgram((prev) =>
          prev ? { ...prev, currentListeners: data.currentListeners } : null,
        );
      }
    });

    socketRef.current.on("listener-left", (data: any) => {
      if (currentProgram && data.programId === currentProgram._id) {
        setCurrentProgram((prev) =>
          prev ? { ...prev, currentListeners: data.currentListeners } : null,
        );
      }
    });

    socketRef.current.on("stream-status-updated", () => {
      fetchLiveStreams();
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [currentProgram]);

  // Fetch live streams
  const fetchLiveStreams = async () => {
    try {
      const response = await fetch(`${API_URL}/api/programs?isLive=true`);
      const data = await response.json();
      setLivePrograms(data.programs || []);

      if (data.programs && data.programs.length > 0 && !currentProgram) {
        const program = data.programs[0];
        setCurrentProgram(program);
        fetchEngagements(program._id);
      }
    } catch (error) {
      console.error("Error fetching live streams:", error);
      toast.error("Failed to fetch live streams");
    }
  };

  // Fetch engagements
  const fetchEngagements = async (programId: string) => {
    try {
      const response = await fetch(
        `${API_URL}/api/engagement/program/${programId}?limit=50`,
      );
      const data = await response.json();
      setEngagements(data.engagements || []);

      const likes = data.engagements.filter(
        (e: Engagement) => e.engagementType === "like",
      ).length;
      const shares = data.engagements.filter(
        (e: Engagement) => e.engagementType === "share",
      ).length;

      setLikeCount(likes);
      setShareCount(shares);
    } catch (error) {
      console.error("Error fetching engagements:", error);
    }
  };

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchLiveStreams();
      setIsLoading(false);
    };

    loadData();
    const interval = setInterval(fetchLiveStreams, 30000);
    return () => clearInterval(interval);
  }, []);

  // Switch program
  const switchProgram = async (program: Program) => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    if (currentProgram) {
      try {
        await fetch(`${API_URL}/api/streaming/${currentProgram._id}/leave`, {
          method: "POST",
        });
      } catch (error) {
        console.error("Error leaving stream:", error);
      }
    }

    setCurrentProgram(program);
    fetchEngagements(program._id);
    setHasLiked(false);
    setActiveStream(null);
    toast.success(`Switched to ${program.title}`);
  };

  // Toggle play/pause
  const togglePlayPause = async () => {
    if (!currentProgram) {
      toast.error("Please select a program to play");
      return;
    }

    const streamUrl =
      currentProgram.streamingUrl || "http://stream.zeno.fm/7ans4am829duv";

    try {
      if (isPlaying) {
        if (audioRef.current) audioRef.current.pause();
        setIsPlaying(false);
        await fetch(`${API_URL}/api/streaming/${currentProgram._id}/leave`, {
          method: "POST",
        });
      } else {
        if (audioRef.current) audioRef.current.pause();
        audioRef.current = new Audio(streamUrl);
        audioRef.current.volume = volume / 100;
        await audioRef.current.play();
        setIsPlaying(true);
        await fetch(`${API_URL}/api/streaming/${currentProgram._id}/join`, {
          method: "POST",
        });
        toast.success("🎵 Stream started - Enjoy!");
      }
    } catch (error) {
      console.error("Error toggling playback:", error);
      toast.error("Failed to start stream");
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) audioRef.current.volume = newVolume / 100;
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume / 100;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || !currentProgram) {
      toast.error("Please enter a comment");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/engagement`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          programId: currentProgram._id,
          engagementType: "comment",
          comment: commentText,
          sessionId: `session_${Date.now()}`,
        }),
      });

      if (response.ok) {
        toast.success("Comment posted! 💬");
        setCommentText("");
        fetchEngagements(currentProgram._id);
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to post comment");
      }
    } catch (error) {
      console.error("Error posting comment:", error);
      toast.error("Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async () => {
    if (!currentProgram) return;
    if (hasLiked) {
      toast.info("You've already liked this program");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/engagement`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          programId: currentProgram._id,
          engagementType: "like",
          sessionId: `session_${Date.now()}`,
        }),
      });

      if (response.ok) {
        setHasLiked(true);
        setLikeCount((prev) => prev + 1);
        toast.success("Liked! ❤️");
      }
    } catch (error) {
      toast.error("Failed to like");
    }
  };

  const handleShare = async () => {
    if (!currentProgram) return;
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/engagement`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          programId: currentProgram._id,
          engagementType: "share",
          sessionId: `session_${Date.now()}`,
        }),
      });

      if (response.ok) {
        setShareCount((prev) => prev + 1);
        navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied to clipboard! 🔗");
      }
    } catch (error) {
      toast.error("Failed to share");
    }
  };

  // Open social stream — embed if possible, open in new tab otherwise
  const handleOpenStream = (stream: SocialStream) => {
    if (stream.embedUrl) {
      setActiveStream(stream);
    } else {
      window.open(stream.url, "_blank", "noopener,noreferrer");
      toast.info(
        `Opening ${PLATFORM_META[stream.platform]?.label} in a new tab`,
      );
    }
  };

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

  // Active social streams for current program
  const activeSocialStreams =
    currentProgram?.socialStreams?.filter((s) => s.isActive) ?? [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-purple-300 text-lg font-semibold">
            Loading stream...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-900 pb-6">
      {/* Social Stream Modal */}
      {activeStream && currentProgram && (
        <SocialStreamModal
          stream={activeStream}
          programTitle={currentProgram.title}
          onClose={() => setActiveStream(null)}
        />
      )}

      {/* Header */}
      <div className="bg-linear-to-r from-purple-900/40 to-pink-900/40 backdrop-blur-xl border-b border-purple-500/30 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 bg-linear-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Radio className="w-7 h-7 text-white" />
                </div>
                {livePrograms.length > 0 && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-950 animate-pulse"></div>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">Live Radio</h1>
                <p className="text-purple-300 text-sm font-semibold">
                  {livePrograms.length} program
                  {livePrograms.length !== 1 ? "s" : ""} live
                </p>
              </div>
            </div>

            <button
              onClick={fetchLiveStreams}
              className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 font-semibold flex items-center gap-2 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Main Column ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Program Card */}
            {currentProgram ? (
              <div className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8 shadow-2xl">
                {/* Live Indicator */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-full">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <Signal className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 text-sm font-semibold">
                      LIVE NOW
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-purple-300 text-sm">
                    <Users className="w-4 h-4" />
                    <span className="font-semibold">
                      {currentProgram.currentListeners} listening
                    </span>
                  </div>
                </div>

                {/* Program Info */}
                <div className="mb-8">
                  <h2 className="text-4xl font-black text-white mb-3">
                    {currentProgram.title}
                  </h2>
                  <p className="text-purple-200 text-lg mb-2">
                    Hosted by{" "}
                    <span className="font-bold text-white">
                      {currentProgram.host}
                    </span>
                  </p>
                  <p className="text-purple-300 leading-relaxed">
                    {currentProgram.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-sm font-semibold">
                      {currentProgram.category}
                    </span>
                    {currentProgram.tags?.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-pink-500/20 border border-pink-500/30 rounded-full text-pink-300 text-sm"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* ── Watch Live on Social Platforms ── */}
                {activeSocialStreams.length > 0 && (
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Tv2 className="w-5 h-5 text-purple-400" />
                        <h3 className="text-white font-bold text-lg">
                          Watch Live On
                        </h3>
                      </div>
                      <button
                        onClick={() => setShowStreams(!showStreams)}
                        className="text-purple-300 hover:text-white transition-colors"
                      >
                        <ChevronDown
                          className={`w-5 h-5 transition-transform ${showStreams ? "rotate-180" : ""}`}
                        />
                      </button>
                    </div>

                    {showStreams && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {activeSocialStreams.map((stream) => {
                          const meta = PLATFORM_META[stream.platform];
                          const canEmbed = !!stream.embedUrl;
                          return (
                            <button
                              key={stream._id}
                              onClick={() => handleOpenStream(stream)}
                              className={`group relative flex flex-col items-center gap-2 px-4 py-4 ${meta.bgColor} border ${meta.borderColor} rounded-2xl transition-all duration-300 hover:scale-105 hover:border-opacity-70`}
                            >
                              {/* Embed indicator */}
                              {canEmbed ? (
                                <div className="absolute top-2 right-2">
                                  <div
                                    className="w-2 h-2 bg-green-500 rounded-full"
                                    title="Embeddable"
                                  />
                                </div>
                              ) : (
                                <div className="absolute top-2 right-2">
                                  <ExternalLink className="w-3 h-3 text-purple-400/60" />
                                </div>
                              )}

                              <PlatformIcon
                                platform={stream.platform}
                                className={`w-8 h-8 ${meta.color} group-hover:scale-110 transition-transform`}
                              />
                              <div className="text-center">
                                <p
                                  className={`text-sm font-bold ${meta.color}`}
                                >
                                  {meta.label}
                                </p>
                                {stream.label && (
                                  <p className="text-purple-400 text-xs mt-0.5 truncate max-w-full">
                                    {stream.label}
                                  </p>
                                )}
                              </div>

                              {/* Hover tooltip */}
                              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-900 border border-purple-500/30 rounded-lg text-purple-300 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                {canEmbed ? "Watch here" : "Open in new tab"}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Waveform Visualization */}
                <div className="relative h-32 bg-black/30 rounded-2xl mb-8 overflow-hidden border border-purple-500/20">
                  <div className="absolute inset-0 flex items-center justify-center gap-1 px-4">
                    {Array.from({ length: 60 }).map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 bg-linear-to-t from-purple-500 to-pink-500 rounded-full transition-all duration-300 ${
                          isPlaying ? "animate-pulse" : ""
                        }`}
                        style={{
                          height: isPlaying ? `${Math.random() * 100}%` : "20%",
                          animationDelay: `${i * 0.03}s`,
                        }}
                      />
                    ))}
                  </div>

                  {/* Audio status overlay */}
                  {!isPlaying && currentProgram.streamingUrl && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="px-4 py-2 bg-black/50 rounded-full border border-purple-500/30">
                        <p className="text-purple-300 text-sm font-semibold">
                          Press play to listen to radio
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Player Controls */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={togglePlayPause}
                      className="w-20 h-20 bg-linear-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 group"
                    >
                      {isPlaying ? (
                        <Pause className="w-10 h-10 text-white group-hover:scale-110 transition-transform" />
                      ) : (
                        <Play className="w-10 h-10 text-white ml-1 group-hover:scale-110 transition-transform" />
                      )}
                    </button>

                    {/* Engagement Buttons */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleLike}
                        disabled={hasLiked}
                        className={`group px-6 py-3 ${
                          hasLiked
                            ? "bg-pink-600/30 border-pink-500/50"
                            : "bg-pink-600/20 hover:bg-pink-600/30 border-pink-500/30"
                        } border rounded-xl transition-all duration-300 hover:scale-105 disabled:cursor-not-allowed flex items-center gap-2`}
                      >
                        <Heart
                          className={`w-5 h-5 ${
                            hasLiked
                              ? "text-pink-400 fill-pink-400"
                              : "text-pink-400"
                          } group-hover:scale-110 transition-transform`}
                        />
                        <span className="text-pink-300 font-semibold">
                          {likeCount}
                        </span>
                      </button>

                      <button
                        onClick={handleShare}
                        className="group px-6 py-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-xl transition-all duration-300 hover:scale-105 flex items-center gap-2"
                      >
                        <Share2 className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
                        <span className="text-blue-300 font-semibold">
                          {shareCount}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Volume Control */}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={toggleMute}
                      className="p-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl transition-all duration-300"
                    >
                      {isMuted ? (
                        <VolumeX className="w-6 h-6 text-purple-300" />
                      ) : (
                        <Volume2 className="w-6 h-6 text-purple-300" />
                      )}
                    </button>

                    <div className="flex-1 relative">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={isMuted ? 0 : volume}
                        onChange={(e) =>
                          handleVolumeChange(Number(e.target.value))
                        }
                        className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer slider"
                      />
                    </div>

                    <span className="text-purple-300 font-semibold w-12 text-right">
                      {isMuted ? 0 : volume}%
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-12 shadow-2xl text-center">
                <Radio className="w-20 h-20 text-purple-400/50 mx-auto mb-4" />
                <h3 className="text-2xl font-black text-white mb-2">
                  No Live Programs
                </h3>
                <p className="text-purple-300">
                  Check back later for live broadcasts!
                </p>
              </div>
            )}

            {/* Comments Section */}
            {currentProgram && (
              <div className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-black text-white flex items-center gap-2">
                    <MessageSquare className="w-6 h-6 text-purple-400" />
                    Live Chat (
                    {
                      engagements.filter((e) => e.engagementType === "comment")
                        .length
                    }
                    )
                  </h3>
                  <button
                    onClick={() => setShowComments(!showComments)}
                    className="text-purple-300 hover:text-white transition-colors"
                  >
                    <ChevronDown
                      className={`w-6 h-6 transition-transform ${
                        showComments ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>

                {showComments && (
                  <>
                    <div className="mb-6">
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          onKeyPress={(e) =>
                            e.key === "Enter" && handlePostComment()
                          }
                          placeholder="Share your thoughts..."
                          className="flex-1 px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
                        />
                        <button
                          onClick={handlePostComment}
                          disabled={isSubmitting || !commentText.trim()}
                          className="px-6 py-3 bg-linear-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-semibold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        >
                          {isSubmitting ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Send className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                      {engagements
                        .filter((e) => e.engagementType === "comment")
                        .map((engagement) => (
                          <div
                            key={engagement._id}
                            className="p-4 bg-black/20 rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition-all"
                          >
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-linear-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                  {engagement.user.fullName
                                    ?.charAt(0)
                                    ?.toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-white font-semibold text-sm">
                                    {engagement.user.fullName}
                                  </p>
                                  <p className="text-purple-400 text-xs">
                                    {new Date(
                                      engagement.createdAt,
                                    ).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </p>
                                </div>
                              </div>

                              {engagement.comment?.sentiment && (
                                <div
                                  className={`flex items-center gap-1 px-2 py-1 ${
                                    getSentimentDisplay(
                                      engagement.comment.sentiment,
                                    ).bg
                                  } rounded-full`}
                                >
                                  <span
                                    className={
                                      getSentimentDisplay(
                                        engagement.comment.sentiment,
                                      ).color
                                    }
                                  >
                                    {
                                      getSentimentDisplay(
                                        engagement.comment.sentiment,
                                      ).icon
                                    }
                                  </span>
                                </div>
                              )}
                            </div>

                            <p className="text-purple-100 mb-2">
                              {engagement.comment?.text}
                            </p>

                            {engagement.comment?.aiAnalysis?.summary && (
                              <div className="mt-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                                <div className="flex items-center gap-2 mb-1">
                                  <Sparkles className="w-3 h-3 text-purple-400" />
                                  <span className="text-purple-300 text-xs font-semibold">
                                    AI Insight
                                  </span>
                                </div>
                                <p className="text-purple-200 text-xs">
                                  {engagement.comment.aiAnalysis.summary}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      <div ref={commentsEndRef} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-6">
            {/* Live Programs */}
            <div className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-6 shadow-2xl sticky top-24">
              <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2">
                <Radio className="w-6 h-6 text-purple-400" />
                Live Now
              </h3>

              {livePrograms.length === 0 ? (
                <div className="text-center py-8">
                  <Radio className="w-12 h-12 text-purple-400/50 mx-auto mb-3" />
                  <p className="text-purple-300 text-sm">
                    No live programs right now
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {livePrograms.map((program) => {
                    const activeStreams =
                      program.socialStreams?.filter((s) => s.isActive) ?? [];
                    return (
                      <div
                        key={program._id}
                        onClick={() => switchProgram(program)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 ${
                          currentProgram?._id === program._id
                            ? "bg-purple-600/20 border-purple-500/50 ring-2 ring-purple-500/30"
                            : "bg-black/20 border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-600/10"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-white font-bold text-sm">
                            {program.title}
                          </h4>
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 border border-green-500/30 rounded-full">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-green-400 text-xs font-semibold">
                              LIVE
                            </span>
                          </div>
                        </div>

                        <p className="text-purple-300 text-xs mb-2">
                          {program.host}
                        </p>

                        <div className="flex items-center justify-between text-xs mb-3">
                          <span className="px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 font-semibold">
                            {program.category}
                          </span>
                          <div className="flex items-center gap-1 text-purple-300">
                            <Users className="w-3 h-3" />
                            {program.currentListeners}
                          </div>
                        </div>

                        {/* Social platform pills in sidebar card */}
                        {activeStreams.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {activeStreams.map((s) => {
                              const meta = PLATFORM_META[s.platform];
                              return (
                                <button
                                  key={s._id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (currentProgram?._id !== program._id) {
                                      switchProgram(program).then?.(() =>
                                        handleOpenStream(s),
                                      );
                                    } else {
                                      handleOpenStream(s);
                                    }
                                  }}
                                  title={`Watch on ${meta.label}`}
                                  className={`flex items-center gap-1 px-2 py-1 ${meta.bgColor} border ${meta.borderColor} rounded-lg transition-all hover:scale-105`}
                                >
                                  <PlatformIcon
                                    platform={s.platform}
                                    className={`w-3 h-3 ${meta.color}`}
                                  />
                                  <span
                                    className={`text-xs font-semibold ${meta.color}`}
                                  >
                                    {meta.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: linear-gradient(
            135deg,
            rgb(168, 85, 247),
            rgb(236, 72, 153)
          );
          cursor: pointer;
          border-radius: 50%;
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.5);
          transition: all 0.3s ease;
        }

        .slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
          box-shadow: 0 0 30px rgba(168, 85, 247, 0.8);
        }

        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: linear-gradient(
            135deg,
            rgb(168, 85, 247),
            rgb(236, 72, 153)
          );
          cursor: pointer;
          border-radius: 50%;
          border: none;
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.5);
          transition: all 0.3s ease;
        }

        .slider::-moz-range-thumb:hover {
          transform: scale(1.2);
          box-shadow: 0 0 30px rgba(168, 85, 247, 0.8);
        }
      `}</style>
    </div>
  );
};

export default LiveStreamUsersPage;
