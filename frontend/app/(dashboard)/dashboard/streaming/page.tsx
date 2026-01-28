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
  Activity,
  TrendingUp,
  Clock,
  Signal,
  Waves,
  BarChart3,
  RefreshCw,
  CheckCircle2,
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
}

interface StreamMetrics {
  totalLiveStreams: number;
  totalListeners: number;
  streamDetails: Array<{
    id: string;
    title: string;
    listeners: number;
    uptime: number;
  }>;
}

const AdminStreamingPage = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(70);
  const [livePrograms, setLivePrograms] = useState<Program[]>([]);
  const [metrics, setMetrics] = useState<StreamMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentProgram, setCurrentProgram] = useState<Program | null>(null);
  const [streamHealth, setStreamHealth] = useState<
    "healthy" | "warning" | "error"
  >("healthy");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const socketRef = useRef<Socket | null>(null);

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

    socketRef.current.on("stream-status-updated", (data: any) => {
      console.log("Stream status updated:", data);
      fetchLiveStreams();
      fetchMetrics();
    });

    socketRef.current.on("listener-joined", (data: any) => {
      console.log("Listener joined:", data);
      fetchMetrics();
    });

    socketRef.current.on("listener-left", (data: any) => {
      console.log("Listener left:", data);
      fetchMetrics();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Fetch live streams
  const fetchLiveStreams = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/programs?isLive=true`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setLivePrograms(data.programs || []);

      // Set current program to first live program if none selected
      if (data.programs && data.programs.length > 0 && !currentProgram) {
        setCurrentProgram(data.programs[0]);
      }
    } catch (error) {
      console.error("Error fetching live streams:", error);
      toast.error("Failed to fetch live streams");
    }
  };

  // Fetch metrics
  const fetchMetrics = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/streaming/health/metrics`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics);

        // Determine stream health
        if (data.metrics.totalLiveStreams === 0) {
          setStreamHealth("error");
        } else if (data.metrics.totalListeners < 10) {
          setStreamHealth("warning");
        } else {
          setStreamHealth("healthy");
        }
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
    }
  };

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchLiveStreams(), fetchMetrics()]);
      setIsLoading(false);
    };

    loadData();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchLiveStreams();
      fetchMetrics();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Switch to a different program
  const switchProgram = async (program: Program) => {
    // Stop current playback
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    // Notify server of listener leaving current program
    if (currentProgram) {
      try {
        await fetch(`${API_URL}/api/streaming/${currentProgram._id}/leave`, {
          method: "POST",
        });
      } catch (error) {
        console.error("Error leaving stream:", error);
      }
    }

    // Set new program
    setCurrentProgram(program);
    toast.success(`Switched to ${program.title}`);
  };

  // Handle play/pause
  const togglePlayPause = async () => {
    if (!currentProgram) {
      toast.error("Please select a program to play");
      return;
    }

    // Use streamingUrl from program or fallback to default
    const streamUrl =
      currentProgram.streamingUrl || "http://stream.zeno.fm/7ans4am829duv";

    try {
      if (isPlaying) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        setIsPlaying(false);

        // Notify server of listener leaving
        await fetch(`${API_URL}/api/streaming/${currentProgram._id}/leave`, {
          method: "POST",
        });
      } else {
        // Create new audio element with current stream URL
        if (audioRef.current) {
          audioRef.current.pause();
        }

        audioRef.current = new Audio(streamUrl);
        audioRef.current.volume = volume / 100;

        await audioRef.current.play();
        setIsPlaying(true);

        // Notify server of listener joining
        await fetch(`${API_URL}/api/streaming/${currentProgram._id}/join`, {
          method: "POST",
        });

        toast.success("Stream started");
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
    if (newVolume === 0) {
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
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

  // Refresh data
  const handleRefresh = async () => {
    toast.info("Refreshing data...");
    await Promise.all([fetchLiveStreams(), fetchMetrics()]);
    toast.success("Data refreshed");
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
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-linear-to-r from-purple-400 via-pink-400 to-purple-400 mb-2">
              Live Radio Streaming
            </h1>
            <p className="text-purple-300 text-lg">
              Broadcasting live • Real-time analytics
            </p>
          </div>

          <button
            onClick={handleRefresh}
            className="px-6 py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 font-semibold flex items-center gap-2 transition-all duration-300 hover:scale-105"
          >
            <RefreshCw className="w-5 h-5" />
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Player Card */}
        <div className="lg:col-span-2">
          <div className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8 shadow-2xl">
            {/* Stream Status Indicator */}
            <div className="flex items-center gap-3 mb-6">
              <div className="relative">
                <div
                  className={`w-4 h-4 rounded-full ${streamHealth === "healthy" ? "bg-green-500" : streamHealth === "warning" ? "bg-yellow-500" : "bg-red-500"}`}
                ></div>
                <div
                  className={`absolute inset-0 w-4 h-4 rounded-full ${streamHealth === "healthy" ? "bg-green-500" : streamHealth === "warning" ? "bg-yellow-500" : "bg-red-500"} animate-ping opacity-75`}
                ></div>
              </div>
              <span className="text-purple-200 font-semibold">
                {streamHealth === "healthy"
                  ? "Stream Healthy"
                  : streamHealth === "warning"
                    ? "Low Listeners"
                    : "No Live Streams"}
              </span>
            </div>

            {/* Program Info */}
            {currentProgram ? (
              <div className="mb-8">
                <h2 className="text-3xl font-black text-white mb-2">
                  {currentProgram.title}
                </h2>
                <p className="text-purple-300 text-lg mb-1">
                  Hosted by {currentProgram.host}
                </p>
                <p className="text-purple-400/80">
                  {currentProgram.description}
                </p>
                <div className="flex gap-2 mt-4">
                  <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-sm font-semibold">
                    {currentProgram.category}
                  </span>
                  <span className="px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full text-green-300 text-sm font-semibold flex items-center gap-1">
                    <Signal className="w-3 h-3" />
                    LIVE
                  </span>
                </div>
              </div>
            ) : (
              <div className="mb-8">
                <h2 className="text-3xl font-black text-white mb-2">
                  No Live Program
                </h2>
                <p className="text-purple-300">
                  Waiting for broadcast to start...
                </p>
              </div>
            )}

            {/* Waveform Visualization */}
            <div className="relative h-24 bg-black/30 rounded-2xl mb-8 overflow-hidden border border-purple-500/20">
              <div className="absolute inset-0 flex items-center justify-center gap-1 px-4">
                {Array.from({ length: 50 }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 bg-linear-to-t from-purple-500 to-pink-500 rounded-full transition-all duration-300 ${
                      isPlaying ? "animate-pulse" : ""
                    }`}
                    style={{
                      height: isPlaying ? `${Math.random() * 100}%` : "20%",
                      animationDelay: `${i * 0.05}s`,
                    }}
                  ></div>
                ))}
              </div>
            </div>

            {/* Player Controls */}
            <div className="space-y-6">
              {/* Play/Pause Button */}
              <div className="flex justify-center">
                <button
                  onClick={togglePlayPause}
                  disabled={!currentProgram}
                  className="w-20 h-20 bg-linear-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPlaying ? (
                    <Pause className="w-10 h-10 text-white group-hover:scale-110 transition-transform" />
                  ) : (
                    <Play className="w-10 h-10 text-white ml-1 group-hover:scale-110 transition-transform" />
                  )}
                </button>
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
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    className="w-full h-2 bg-purple-900/50 rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-linear(to right, rgb(168, 85, 247) 0%, rgb(168, 85, 247) ${isMuted ? 0 : volume}%, rgb(88, 28, 135) ${isMuted ? 0 : volume}%, rgb(88, 28, 135) 100%)`,
                    }}
                  />
                </div>

                <span className="text-purple-300 font-semibold w-12 text-right">
                  {isMuted ? 0 : volume}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Sidebar */}
        <div className="space-y-6">
          {/* Live Stats */}
          <div className="bg-linear-to-br from-green-900/40 to-emerald-900/40 backdrop-blur-xl border border-green-500/30 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-green-500/20 rounded-xl">
                <Activity className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-black text-white">Live Stats</h3>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-black/20 rounded-xl border border-green-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-green-300 text-sm font-semibold">
                    Active Streams
                  </span>
                  <Radio className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-4xl font-black text-white">
                  {livePrograms.length}
                </p>
              </div>

              <div className="p-4 bg-black/20 rounded-xl border border-green-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-green-300 text-sm font-semibold">
                    Total Listeners
                  </span>
                  <Users className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-4xl font-black text-white">
                  {livePrograms.reduce((sum, p) => sum + p.currentListeners, 0)}
                </p>
              </div>

              <div className="p-4 bg-black/20 rounded-xl border border-green-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-green-300 text-sm font-semibold">
                    Avg. per Stream
                  </span>
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-4xl font-black text-white">
                  {livePrograms.length > 0
                    ? Math.round(
                        livePrograms.reduce(
                          (sum, p) => sum + p.currentListeners,
                          0,
                        ) / livePrograms.length,
                      )
                    : 0}
                </p>
              </div>
            </div>
          </div>

          {/* Stream Details */}
          {metrics?.streamDetails && metrics.streamDetails.length > 0 && (
            <div className="bg-linear-to-br from-blue-900/40 to-cyan-900/40 backdrop-blur-xl border border-blue-500/30 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-500/20 rounded-xl">
                  <BarChart3 className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-xl font-black text-white">
                  Stream Details
                </h3>
              </div>

              <div className="space-y-3">
                {metrics.streamDetails.map((stream) => (
                  <div
                    key={stream.id}
                    className="p-4 bg-black/20 rounded-xl border border-blue-500/20"
                  >
                    <h4 className="text-white font-bold mb-2">
                      {stream.title}
                    </h4>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-blue-300">
                        <Users className="w-4 h-4" />
                        {stream.listeners} listeners
                      </div>
                      <div className="flex items-center gap-2 text-blue-300">
                        <Clock className="w-4 h-4" />
                        {stream.uptime}m
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live Programs List */}
      {livePrograms.length > 0 && (
        <div className="max-w-7xl mx-auto mt-6">
          <div className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <Waves className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-2xl font-black text-white">
                All Live Programs ({livePrograms.length})
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {livePrograms.map((program) => (
                <div
                  key={program._id}
                  className={`p-5 bg-black/20 rounded-xl border transition-all duration-300 cursor-pointer hover:scale-105 ${
                    currentProgram?._id === program._id
                      ? "border-purple-500/70 bg-purple-500/10 ring-2 ring-purple-500/50"
                      : "border-purple-500/20 hover:border-purple-500/50"
                  }`}
                  onClick={() => switchProgram(program)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="text-white font-bold text-lg">
                      {program.title}
                    </h4>
                    <div className="flex items-center gap-2">
                      {currentProgram?._id === program._id && (
                        <CheckCircle2 className="w-5 h-5 text-purple-400" />
                      )}
                      <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
                        <Signal className="w-3 h-3 text-green-400" />
                        <span className="text-green-400 text-xs font-semibold">
                          LIVE
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-purple-300 text-sm mb-3">{program.host}</p>

                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-xs font-semibold">
                      {program.category}
                    </span>
                    <div className="flex items-center gap-1 text-purple-300 text-sm">
                      <Users className="w-4 h-4" />
                      {program.currentListeners}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* No Live Programs Message */}
      {livePrograms.length === 0 && (
        <div className="max-w-7xl mx-auto mt-6">
          <div className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-12 shadow-2xl text-center">
            <Radio className="w-16 h-16 text-purple-400/50 mx-auto mb-4" />
            <h3 className="text-2xl font-black text-white mb-2">
              No Live Programs
            </h3>
            <p className="text-purple-300">
              There are currently no programs broadcasting. Check back later!
            </p>
          </div>
        </div>
      )}

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: linear-linear(
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
          background: linear-linear(
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

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminStreamingPage;
