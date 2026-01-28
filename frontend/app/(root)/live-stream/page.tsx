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
  Clock,
  Signal,
  Sparkles,
  TrendingUp,
  Smile,
  Meh,
  Frown,
  Loader2,
  RefreshCw,
  ChevronDown,
  Calendar,
} from "lucide-react";
import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

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
  const [likeCount, setLikeCount] = useState(0);
  const [shareCount, setShareCount] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest comment
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
      console.log("New engagement:", data);
      if (currentProgram && data.programId === currentProgram._id) {
        fetchEngagements(currentProgram._id);

        // Update counts
        if (data.engagement.engagementType === "like") {
          setLikeCount((prev) => prev + 1);
        } else if (data.engagement.engagementType === "share") {
          setShareCount((prev) => prev + 1);
        }
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
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
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

      // Count likes and shares
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

    // Refresh live streams every 30 seconds
    const interval = setInterval(fetchLiveStreams, 30000);
    return () => clearInterval(interval);
  }, []);

  // Switch program
  const switchProgram = async (program: Program) => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    // Leave current stream
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
        if (audioRef.current) {
          audioRef.current.pause();
        }
        setIsPlaying(false);

        await fetch(`${API_URL}/api/streaming/${currentProgram._id}/leave`, {
          method: "POST",
        });
      } else {
        if (audioRef.current) {
          audioRef.current.pause();
        }

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

  // Handle volume
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }
    setIsMuted(newVolume === 0);
  };

  // Toggle mute
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

  // Post comment
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

  // Handle like
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
      console.error("Error liking:", error);
      toast.error("Failed to like");
    }
  };

  // Handle share
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

        // Copy to clipboard
        const url = window.location.href;
        navigator.clipboard.writeText(url);

        toast.success("Link copied to clipboard! 🔗");
      }
    } catch (error) {
      console.error("Error sharing:", error);
      toast.error("Failed to share");
    }
  };

  // Get sentiment display
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
                  {livePrograms.length} programs live
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
          {/* Main Player Section */}
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
                      ></div>
                    ))}
                  </div>
                </div>

                {/* Player Controls */}
                <div className="space-y-6">
                  {/* Play/Pause & Engagement */}
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
                          className={`w-5 h-5 ${hasLiked ? "text-pink-400 fill-pink-400" : "text-pink-400"} group-hover:scale-110 transition-transform`}
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
                      className={`w-6 h-6 transition-transform ${showComments ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>

                {showComments && (
                  <>
                    {/* Comment Input */}
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

                    {/* Comments List */}
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
                                  className={`flex items-center gap-1 px-2 py-1 ${getSentimentDisplay(engagement.comment.sentiment).bg} rounded-full`}
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

          {/* Sidebar - Live Programs */}
          <div className="space-y-6">
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
                  {livePrograms.map((program) => (
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

                      <div className="flex items-center justify-between text-xs">
                        <span className="px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 font-semibold">
                          {program.category}
                        </span>
                        <div className="flex items-center gap-1 text-purple-300">
                          <Users className="w-3 h-3" />
                          {program.currentListeners}
                        </div>
                      </div>
                    </div>
                  ))}
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
