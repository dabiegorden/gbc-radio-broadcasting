"use client";

/**
 * AdminYoutubeAnalyticsPage
 * ─────────────────────────
 * AI-based real-time YouTube Live Stream monitoring + analytics.
 *
 * Master view  : add a YouTube URL + grid of monitored streams.
 * Detail view  : live overview cards, live chat feed, sentiment breakdown,
 *                chat-activity graph, trending keywords, most active users.
 *
 * Realtime (socket.io) — joins room `youtube-<id>` and listens for:
 *   liveStatsUpdated   → viewers / likes / views
 *   newLiveChatMessage → appends to the chat feed
 *   analyticsUpdated   → sentiment %, engagement score/growth
 *
 * Route: /dashboard/youtube  (admin only). Matches the existing purple/pink
 * dashboard design language — no new design system introduced.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Youtube,
  Plus,
  Loader2,
  RefreshCw,
  Trash2,
  BarChart3,
  ArrowLeft,
  Eye,
  Heart,
  Users,
  MessageSquare,
  Activity,
  Signal,
  Radio,
  Smile,
  Meh,
  Frown,
  TrendingUp,
  Hash,
  Clock,
  ExternalLink,
} from "lucide-react";
import {
  createStream,
  getStreams,
  getSingleStream,
  syncStream,
  deleteStream,
  type YoutubeStream,
  type YoutubeAnalytics,
  type YoutubeChat,
} from "@/services/youtubeApi";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const SENTIMENT_COLORS = {
  positive: "#22c55e",
  neutral: "#eab308",
  negative: "#ef4444",
};

function sentimentDisplay(s: string | null | undefined) {
  switch (s) {
    case "positive":
      return {
        icon: <Smile className="w-4 h-4" />,
        color: "text-green-400",
        bg: "bg-green-500/20",
        border: "border-green-500/30",
      };
    case "negative":
      return {
        icon: <Frown className="w-4 h-4" />,
        color: "text-red-400",
        bg: "bg-red-500/20",
        border: "border-red-500/30",
      };
    default:
      return {
        icon: <Meh className="w-4 h-4" />,
        color: "text-yellow-400",
        bg: "bg-yellow-500/20",
        border: "border-yellow-500/30",
      };
  }
}

const LiveBadge = ({ status }: { status: string }) => {
  if (status === "live") {
    return (
      <span className="flex items-center gap-1 px-2.5 py-0.5 bg-red-500/20 border border-red-500/40 rounded-full">
        <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
        <span className="text-red-300 text-xs font-bold">LIVE</span>
      </span>
    );
  }
  const map: Record<string, string> = {
    upcoming: "bg-sky-500/20 border-sky-500/40 text-sky-300",
    ended: "bg-zinc-500/20 border-zinc-500/40 text-zinc-300",
    none: "bg-zinc-500/20 border-zinc-500/40 text-zinc-300",
    unknown: "bg-purple-500/20 border-purple-500/40 text-purple-300",
  };
  return (
    <span
      className={`flex items-center gap-1 px-2.5 py-0.5 border rounded-full text-xs font-semibold ${map[status] || map.unknown}`}
    >
      <Signal className="w-3 h-3" />
      {status.toUpperCase()}
    </span>
  );
};

// ─── Overview stat card ───────────────────────────────────────────────────────

const StatCard = ({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: any;
  accent: string;
}) => (
  <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-6">
    <div className="flex items-center justify-between mb-3">
      <span className="text-purple-300 text-sm font-semibold">{label}</span>
      <Icon className={`w-5 h-5 ${accent}`} />
    </div>
    <p className="text-4xl font-black text-white">{value}</p>
  </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────

const AdminYoutubeAnalyticsPage = () => {
  // List state
  const [streams, setStreams] = useState<YoutubeStream[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [newUrl, setNewUrl] = useState("");
  const [creating, setCreating] = useState(false);

  // Detail state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stream, setStream] = useState<YoutubeStream | null>(null);
  const [analytics, setAnalytics] = useState<YoutubeAnalytics | null>(null);
  const [chats, setChats] = useState<YoutubeChat[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Fetch list ───────────────────────────────────────────────────────────
  const fetchList = useCallback(async () => {
    try {
      const data = await getStreams({ limit: 50 });
      setStreams(data.streams || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load streams");
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // ── Fetch detail ─────────────────────────────────────────────────────────
  const fetchDetail = useCallback(async (id: string) => {
    setIsLoadingDetail(true);
    try {
      const data = await getSingleStream(id);
      setStream(data.stream);
      setAnalytics(data.analytics);
      setChats(data.recentChats || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load stream analytics");
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) fetchDetail(selectedId);
  }, [selectedId, fetchDetail]);

  // ── Realtime socket (scoped to the selected stream) ───────────────────────
  useEffect(() => {
    if (!selectedId) return;

    const socket = io(API_URL_FALLBACK());
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-youtube-stream", { streamId: selectedId });
    });

    socket.on("liveStatsUpdated", (data: any) => {
      if (data.streamId !== selectedId) return;
      setStream((prev) => (prev ? { ...prev, ...data.stats } : prev));
    });

    socket.on("newLiveChatMessage", (data: any) => {
      if (data.streamId !== selectedId) return;
      setChats((prev) => [...prev, ...(data.messages || [])].slice(-200));
    });

    socket.on("analyticsUpdated", (data: any) => {
      if (data.streamId !== selectedId) return;
      setAnalytics((prev) => (prev ? { ...prev, ...data.analytics } : prev));
    });

    return () => {
      socket.emit("leave-youtube-stream", { streamId: selectedId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [selectedId]);

  // Auto-scroll chat feed as new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

  // ── Create ───────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    const url = newUrl.trim();
    if (!url) {
      toast.error("Please paste a YouTube Live URL");
      return;
    }
    if (!/youtube\.com|youtu\.be/i.test(url)) {
      toast.error("That doesn't look like a YouTube URL");
      return;
    }
    setCreating(true);
    try {
      const data = await createStream(url);
      toast.success(`Now monitoring: ${data.stream.title || "stream"}`);
      setNewUrl("");
      setStreams((prev) => [
        data.stream,
        ...prev.filter((s) => s._id !== data.stream._id),
      ]);
    } catch (err: any) {
      toast.error(err.message || "Failed to add stream");
    } finally {
      setCreating(false);
    }
  };

  // ── Sync ─────────────────────────────────────────────────────────────────
  const handleSync = async (id: string) => {
    setSyncing(true);
    try {
      const data = await syncStream(id);
      toast.success(
        data.newMessages > 0
          ? `Synced · ${data.newMessages} new messages`
          : "Synced",
      );
      if (selectedId === id) await fetchDetail(id);
      else await fetchList();
    } catch (err: any) {
      toast.error(err.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm("Stop monitoring and delete this stream's stored chat?"))
      return;
    try {
      await deleteStream(id);
      toast.success("Stream deleted");
      setStreams((prev) => prev.filter((s) => s._id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Loading (list)
  // ─────────────────────────────────────────────────────────────────────────
  if (isLoadingList) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-purple-300 text-lg font-semibold">
            Loading streams...
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DETAIL / ANALYTICS VIEW
  // ─────────────────────────────────────────────────────────────────────────
  if (selectedId) {
    const currentViewers = stream?.currentViewers ?? stream?.viewers ?? 0;

    const sentimentData = analytics
      ? [
          { name: "positive", value: analytics.positivePercentage },
          { name: "neutral", value: analytics.neutralPercentage },
          { name: "negative", value: analytics.negativePercentage },
        ].filter((d) => d.value > 0)
      : [];

    const activityData =
      analytics?.messagesPerMinute.map((m) => ({
        time: m.minute.length > 11 ? m.minute.slice(11) : m.minute,
        messages: m.messages,
      })) || [];

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedId(null)}
                className="p-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 transition-all"
                title="Back to streams"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-black text-white flex items-center gap-3">
                  <Youtube className="w-8 h-8 text-red-500" />
                  {stream?.title || "Stream Analytics"}
                </h1>
                <p className="text-purple-300 text-sm mt-1">
                  {stream?.channelTitle || "—"}
                  {stream && (
                    <>
                      {" · "}
                      <span className="inline-flex items-center gap-1">
                        {stream.liveStatus}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {stream && <LiveBadge status={stream.liveStatus} />}
              {stream?.youtubeUrl && (
                <a
                  href={stream.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 font-semibold flex items-center gap-2 transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open
                </a>
              )}
              <button
                onClick={() => selectedId && handleSync(selectedId)}
                disabled={syncing}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {syncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Sync
              </button>
            </div>
          </div>

          {isLoadingDetail && !analytics ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* Embedded video player */}
              {stream?.youtubeVideoId && (
                <div className="bg-gradient-to-br from-slate-900/40 to-purple-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-4 sm:p-6">
                  <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black">
                    <iframe
                      src={`https://www.youtube.com/embed/${stream.youtubeVideoId}?autoplay=0`}
                      title={stream.title || "YouTube live stream"}
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                </div>
              )}

              {/* Live overview cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard
                  label="Current Viewers"
                  value={fmtNum(currentViewers)}
                  icon={Users}
                  accent="text-red-400"
                />
                <StatCard
                  label="Total Views"
                  value={fmtNum(stream?.views)}
                  icon={Eye}
                  accent="text-amber-400"
                />
                <StatCard
                  label="Likes"
                  value={fmtNum(stream?.likes)}
                  icon={Heart}
                  accent="text-pink-400"
                />
                <StatCard
                  label="Live Messages"
                  value={fmtNum(analytics?.totalMessages)}
                  icon={MessageSquare}
                  accent="text-sky-400"
                />
                <StatCard
                  label="Engagement"
                  value={`${analytics?.engagementScore ?? 0}%`}
                  icon={Activity}
                  accent="text-green-400"
                />
              </div>

              {/* Charts row: sentiment + chat activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sentiment */}
                <div className="bg-gradient-to-br from-slate-900/40 to-purple-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-green-500/20 rounded-xl">
                      <Heart className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-white">
                        Sentiment Analysis
                      </h3>
                      <p className="text-purple-300 text-sm">
                        AI classification of live chat
                      </p>
                    </div>
                  </div>
                  {sentimentData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={sentimentData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }: any) => `${name}: ${value}%`}
                          outerRadius={100}
                          dataKey="value"
                        >
                          {sentimentData.map((entry) => (
                            <Cell
                              key={entry.name}
                              fill={
                                SENTIMENT_COLORS[
                                  entry.name as keyof typeof SENTIMENT_COLORS
                                ]
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            border: "1px solid #a855f7",
                            borderRadius: "12px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[280px] flex items-center justify-center text-purple-400">
                      No chat sentiment yet
                    </div>
                  )}
                </div>

                {/* Chat activity */}
                <div className="bg-gradient-to-br from-slate-900/40 to-purple-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-purple-500/20 rounded-xl">
                      <TrendingUp className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-white">
                        Chat Activity
                      </h3>
                      <p className="text-purple-300 text-sm">
                        Messages per minute
                      </p>
                    </div>
                  </div>
                  {activityData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={activityData}>
                        <defs>
                          <linearGradient
                            id="chatGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#a855f7"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#a855f7"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#ffffff10"
                        />
                        <XAxis dataKey="time" stroke="#c084fc" />
                        <YAxis stroke="#c084fc" allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            border: "1px solid #a855f7",
                            borderRadius: "12px",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="messages"
                          stroke="#a855f7"
                          fillOpacity={1}
                          fill="url(#chatGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[280px] flex items-center justify-center text-purple-400">
                      No chat activity yet
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom row: chat feed + keywords/users */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Live chat feed */}
                <div className="lg:col-span-2 bg-gradient-to-br from-slate-900/40 to-purple-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-sky-500/20 rounded-xl">
                      <MessageSquare className="w-6 h-6 text-sky-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-white">
                        Live Chat Feed
                      </h3>
                      <p className="text-purple-300 text-sm">
                        {chats.length} recent messages
                      </p>
                    </div>
                  </div>

                  <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
                    {chats.length === 0 ? (
                      <div className="text-center py-12 text-purple-400">
                        {stream?.isLiveNow
                          ? "Waiting for chat messages..."
                          : "No live chat available (stream not live)"}
                      </div>
                    ) : (
                      chats.map((c, i) => {
                        const d = sentimentDisplay(c.sentiment);
                        return (
                          <div
                            key={`${c.publishedAt}-${i}`}
                            className="p-3 bg-black/20 border border-purple-500/20 rounded-xl"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-white font-semibold text-sm">
                                {c.authorName}
                              </span>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${d.bg} border ${d.border} ${d.color}`}
                                >
                                  {d.icon}
                                  {c.sentiment}
                                </span>
                                <span className="text-purple-500 text-xs flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(c.publishedAt).toLocaleTimeString(
                                    [],
                                    { hour: "2-digit", minute: "2-digit" },
                                  )}
                                </span>
                              </div>
                            </div>
                            <p className="text-purple-200 text-sm">
                              {c.message}
                            </p>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </div>

                {/* Keywords + active users */}
                <div className="space-y-6">
                  {/* Trending keywords */}
                  <div className="bg-gradient-to-br from-slate-900/40 to-purple-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Hash className="w-5 h-5 text-amber-400" />
                      <h3 className="text-lg font-black text-white">
                        Trending Keywords
                      </h3>
                    </div>
                    {analytics && analytics.topKeywords.length > 0 ? (
                      <div className="space-y-2">
                        {analytics.topKeywords.slice(0, 10).map((k) => (
                          <div
                            key={k.word}
                            className="flex items-center justify-between p-2 bg-black/20 rounded-lg"
                          >
                            <span className="text-purple-200 text-sm">
                              {k.word}
                            </span>
                            <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded-full text-amber-300 text-xs font-bold">
                              {k.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-purple-400 text-sm py-4 text-center">
                        No keywords yet
                      </p>
                    )}
                  </div>

                  {/* Most active users */}
                  <div className="bg-gradient-to-br from-slate-900/40 to-purple-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="w-5 h-5 text-pink-400" />
                      <h3 className="text-lg font-black text-white">
                        Most Active Users
                      </h3>
                    </div>
                    {analytics && analytics.mostActiveUsers.length > 0 ? (
                      <div className="space-y-2">
                        {analytics.mostActiveUsers.slice(0, 10).map((u, i) => (
                          <div
                            key={`${u.user}-${i}`}
                            className="flex items-center justify-between p-2 bg-black/20 rounded-lg"
                          >
                            <span className="text-purple-200 text-sm truncate flex items-center gap-2">
                              <span className="text-purple-500 text-xs w-4">
                                {i + 1}
                              </span>
                              {u.user}
                            </span>
                            <span className="px-2 py-0.5 bg-pink-500/20 border border-pink-500/30 rounded-full text-pink-300 text-xs font-bold">
                              {u.messages}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-purple-400 text-sm py-4 text-center">
                        No active users yet
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MASTER / LIST VIEW
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 mb-2 flex items-center gap-3">
            <Youtube className="w-9 h-9 text-red-500" />
            YouTube Live Analytics
          </h1>
          <p className="text-purple-300 text-lg">
            AI-based real-time monitoring of YouTube Live streams
          </p>
        </div>

        {/* Create bar */}
        <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-6">
          <label className="block text-purple-300 text-sm font-semibold mb-2">
            Add a YouTube Live URL
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="https://youtube.com/watch?v=VIDEO_ID"
              className="flex-1 px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
            />
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
            >
              {creating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
              Add Stream
            </button>
          </div>
          <p className="text-purple-500 text-xs mt-2">
            The backend extracts the video ID and pulls title, channel,
            thumbnail, stats, and live chat automatically.
          </p>
        </div>

        {/* Stream grid */}
        {streams.length === 0 ? (
          <div className="bg-gradient-to-br from-slate-900/40 to-purple-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-12 text-center">
            <Radio className="w-16 h-16 text-purple-400/40 mx-auto mb-4" />
            <h3 className="text-2xl font-black text-white mb-2">
              No streams yet
            </h3>
            <p className="text-purple-300">
              Add a YouTube Live URL above to start monitoring.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {streams.map((s) => {
              const viewers = s.currentViewers ?? 0;
              const engagement = s.engagementStats?.engagementScore ?? 0;
              return (
                <div
                  key={s._id}
                  className="bg-gradient-to-br from-purple-900/30 to-pink-900/10 backdrop-blur-xl border border-purple-500/30 hover:border-purple-500/50 rounded-2xl overflow-hidden transition-all duration-300 group"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-slate-800 overflow-hidden">
                    {s.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.thumbnail}
                        alt={s.title || "thumbnail"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Youtube className="w-12 h-12 text-red-500/40" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <LiveBadge status={s.liveStatus} />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-5">
                    <h3 className="text-white font-bold truncate">
                      {s.title || "Untitled stream"}
                    </h3>
                    <p className="text-purple-400 text-sm mt-0.5 truncate">
                      {s.channelTitle || "—"}
                    </p>

                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-2 mt-4">
                      <div className="text-center">
                        <Users className="w-3.5 h-3.5 text-red-400 mx-auto mb-1" />
                        <p className="text-white text-sm font-bold">
                          {fmtNum(viewers)}
                        </p>
                        <p className="text-purple-500 text-[10px]">Viewers</p>
                      </div>
                      <div className="text-center">
                        <Eye className="w-3.5 h-3.5 text-amber-400 mx-auto mb-1" />
                        <p className="text-white text-sm font-bold">
                          {fmtNum(s.views)}
                        </p>
                        <p className="text-purple-500 text-[10px]">Views</p>
                      </div>
                      <div className="text-center">
                        <Heart className="w-3.5 h-3.5 text-pink-400 mx-auto mb-1" />
                        <p className="text-white text-sm font-bold">
                          {fmtNum(s.likes)}
                        </p>
                        <p className="text-purple-500 text-[10px]">Likes</p>
                      </div>
                      <div className="text-center">
                        <Activity className="w-3.5 h-3.5 text-green-400 mx-auto mb-1" />
                        <p className="text-white text-sm font-bold">
                          {engagement}%
                        </p>
                        <p className="text-purple-500 text-[10px]">Engage</p>
                      </div>
                    </div>

                    <p className="text-purple-500 text-xs mt-4">
                      Created {fmtDate(s.createdAt)}
                    </p>

                    {/* Actions */}
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => setSelectedId(s._id)}
                        className="flex-1 px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <BarChart3 className="w-4 h-4" />
                        Analytics
                      </button>
                      <button
                        onClick={() => handleSync(s._id)}
                        disabled={syncing}
                        className="p-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 transition-all disabled:opacity-50"
                        title="Sync now"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(s._id)}
                        className="p-2 bg-red-600/10 hover:bg-red-600/20 border border-red-500/30 rounded-xl text-red-400 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// API base — kept local so the socket connection matches the rest of the app.
function API_URL_FALLBACK() {
  return process.env.NEXT_PUBLIC_API_URL as string;
}

export default AdminYoutubeAnalyticsPage;
