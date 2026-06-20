"use client";

/**
 * AdminYoutubeInsightPage
 * ───────────────────────
 * Platform-wide YouTube Live "Analytics & Insights" dashboard — the YouTube
 * counterpart to the Radio Analytics page. Aggregates every monitored stream +
 * its live chat into one overview: key metrics, chat/sentiment trends,
 * sentiment breakdown, trending keywords, top streams, most active users, and
 * AI insights. Supports PDF export (mirrors the Radio Analytics report).
 *
 * Route: /dashboard/youtube-analysis-insight  (admin only).
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Download,
  TrendingUp,
  Users,
  Eye,
  Heart,
  MessageSquare,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  Activity,
  RefreshCw,
  Loader2,
  Youtube,
  Hash,
  Signal,
} from "lucide-react";
import {
  getYoutubeInsightDashboard,
  getYoutubeInsightTrends,
  downloadYoutubeInsightPDF,
  type YoutubeDashboardInsights,
  type YoutubeTrendPoint,
} from "@/services/youtubeApi";

const COLORS = {
  sentiment: {
    positive: "#22c55e",
    neutral: "#eab308",
    negative: "#ef4444",
  },
};

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

const AdminYoutubeInsightPage = () => {
  const [analytics, setAnalytics] = useState<YoutubeDashboardInsights | null>(
    null,
  );
  const [trends, setTrends] = useState<YoutubeTrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [dateRange, setDateRange] = useState({ startDate: "", endDate: "" });
  const [trendPeriod, setTrendPeriod] = useState("30");

  const fetchAnalytics = async () => {
    try {
      const data = await getYoutubeInsightDashboard({
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
      });
      setAnalytics(data);
    } catch (error) {
      console.error("Error fetching YouTube analytics:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to fetch YouTube analytics",
      );
    }
  };

  const fetchTrends = async () => {
    try {
      const data = await getYoutubeInsightTrends({
        days: parseInt(trendPeriod, 10),
      });
      setTrends(data);
    } catch (error) {
      console.error("Error fetching YouTube trends:", error);
    }
  };

  const downloadPDFReport = async () => {
    setIsDownloading(true);
    try {
      const blob = await downloadYoutubeInsightPDF({
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
        includeStreams: true,
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `youtube-analytics-report-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success("Report downloaded successfully");
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to download report",
      );
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchAnalytics(), fetchTrends()]);
      setIsLoading(false);
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, trendPeriod]);

  const handleRefresh = async () => {
    toast.info("Refreshing data...");
    await Promise.all([fetchAnalytics(), fetchTrends()]);
    toast.success("Data refreshed");
  };

  const sentimentData =
    analytics?.sentimentBreakdown
      .map((item) => ({ name: item._id, value: item.count }))
      .filter((d) => d.value > 0) || [];

  const keywordData =
    analytics?.trendingKeywords
      .slice(0, 10)
      .map((k) => ({ word: k.word, count: k.count })) || [];

  const topStreamsData =
    analytics?.topStreams.slice(0, 8).map((s) => ({
      name: s.title.length > 18 ? `${s.title.slice(0, 18)}…` : s.title,
      views: s.views,
      messages: s.totalMessages,
    })) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-purple-300 text-lg font-semibold">
            Loading YouTube analytics...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-linear-to-r from-purple-400 via-pink-400 to-purple-400 mb-2 flex items-center gap-3">
              <Youtube className="w-9 h-9 text-red-500" />
              YouTube Analytics & Insights
            </h1>
            <p className="text-purple-300 text-lg">
              Live stream engagement, sentiment, and AI-driven insights
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 font-semibold flex items-center gap-2 transition-all duration-300"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>

            <button
              onClick={downloadPDFReport}
              disabled={isDownloading}
              className="px-4 py-2 bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-semibold flex items-center gap-2 transition-all duration-300 hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export PDF
                </>
              )}
            </button>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="bg-linear-to-br from-slate-900/40 to-purple-900/40 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-purple-300 font-semibold mb-2 text-sm">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) =>
                  setDateRange((prev) => ({
                    ...prev,
                    startDate: e.target.value,
                  }))
                }
                className="w-full px-4 py-2 bg-slate-900/50 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="block text-purple-300 font-semibold mb-2 text-sm">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, endDate: e.target.value }))
                }
                className="w-full px-4 py-2 bg-slate-900/50 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="block text-purple-300 font-semibold mb-2 text-sm">
                Trend Period (Days)
              </label>
              <select
                value={trendPeriod}
                onChange={(e) => setTrendPeriod(e.target.value)}
                className="w-full px-4 py-2 bg-slate-900/50 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50 appearance-none cursor-pointer"
              >
                <option value="7">Last 7 Days</option>
                <option value="14">Last 14 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="60">Last 60 Days</option>
                <option value="90">Last 90 Days</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Key Metrics */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-linear-to-br from-red-900/40 to-pink-900/40 backdrop-blur-xl border border-red-500/30 rounded-2xl p-6 hover:scale-105 transition-transform duration-300">
              <div className="flex items-center justify-between mb-3">
                <span className="text-red-300 text-sm font-semibold">
                  Total Streams
                </span>
                <Youtube className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-4xl font-black text-white mb-1">
                {analytics.summary.totalStreams}
              </p>
              <p className="text-red-400 text-sm">
                {analytics.summary.liveStreams} live now
              </p>
            </div>

            <div className="bg-linear-to-br from-amber-900/40 to-orange-900/40 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-6 hover:scale-105 transition-transform duration-300">
              <div className="flex items-center justify-between mb-3">
                <span className="text-amber-300 text-sm font-semibold">
                  Total Views
                </span>
                <Eye className="w-5 h-5 text-amber-400" />
              </div>
              <p className="text-4xl font-black text-white mb-1">
                {fmtNum(analytics.summary.totalViews)}
              </p>
              <p className="text-amber-400 text-sm">
                {fmtNum(analytics.summary.currentViewers)} watching now
              </p>
            </div>

            <div className="bg-linear-to-br from-pink-900/40 to-rose-900/40 backdrop-blur-xl border border-pink-500/30 rounded-2xl p-6 hover:scale-105 transition-transform duration-300">
              <div className="flex items-center justify-between mb-3">
                <span className="text-pink-300 text-sm font-semibold">
                  Total Likes
                </span>
                <Heart className="w-5 h-5 text-pink-400" />
              </div>
              <p className="text-4xl font-black text-white mb-1">
                {fmtNum(analytics.summary.totalLikes)}
              </p>
              <p className="text-pink-400 text-sm">
                Avg engagement {analytics.summary.avgEngagementScore.toFixed(2)}%
              </p>
            </div>

            <div className="bg-linear-to-br from-sky-900/40 to-cyan-900/40 backdrop-blur-xl border border-sky-500/30 rounded-2xl p-6 hover:scale-105 transition-transform duration-300">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sky-300 text-sm font-semibold">
                  Live Chat Messages
                </span>
                <MessageSquare className="w-5 h-5 text-sky-400" />
              </div>
              <p className="text-4xl font-black text-white mb-1">
                {fmtNum(analytics.summary.totalMessages)}
              </p>
              <p className="text-sky-400 text-sm">
                {fmtNum(analytics.summary.totalComments)} video comments
              </p>
            </div>
          </div>
        )}

        {/* Chat Volume Trends */}
        <div className="bg-linear-to-br from-slate-900/40 to-purple-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white">
                Live Chat Trends
              </h3>
              <p className="text-purple-300 text-sm">
                Daily chat message volume over time
              </p>
            </div>
          </div>

          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="_id" stroke="#c084fc" />
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
                  dataKey="totalMessages"
                  stroke="#a855f7"
                  fillOpacity={1}
                  fill="url(#colorMessages)"
                  name="Messages"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-75 flex items-center justify-center text-purple-400">
              No chat trend data available
            </div>
          )}
        </div>

        {/* Sentiment + Trending Keywords */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sentiment Pie Chart */}
          <div className="bg-linear-to-br from-slate-900/40 to-purple-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8">
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
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={sentimentData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry: { name?: string; percent?: number }) =>
                      `${entry.name}: ${((entry.percent || 0) * 100).toFixed(0)}%`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {sentimentData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          COLORS.sentiment[
                            entry.name as keyof typeof COLORS.sentiment
                          ] || "#a855f7"
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
              <div className="h-75 flex items-center justify-center text-purple-400">
                No sentiment data available
              </div>
            )}
          </div>

          {/* Trending Keywords */}
          <div className="bg-linear-to-br from-slate-900/40 to-purple-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-amber-500/20 rounded-xl">
                <Hash className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white">
                  Trending Keywords
                </h3>
                <p className="text-purple-300 text-sm">
                  Most mentioned words in chat
                </p>
              </div>
            </div>

            {keywordData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={keywordData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis type="number" stroke="#c084fc" allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="word"
                    stroke="#c084fc"
                    width={90}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #a855f7",
                      borderRadius: "12px",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#f59e0b"
                    radius={[0, 6, 6, 0]}
                    name="Mentions"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-75 flex items-center justify-center text-purple-400">
                No keyword data available
              </div>
            )}
          </div>
        </div>

        {/* Top Streams Performance */}
        <div className="bg-linear-to-br from-slate-900/40 to-purple-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <BarChart3 className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white">
                Top Stream Performance
              </h3>
              <p className="text-purple-300 text-sm">
                Views and chat activity by stream
              </p>
            </div>
          </div>

          {topStreamsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topStreamsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="name" stroke="#c084fc" />
                <YAxis stroke="#c084fc" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #a855f7",
                    borderRadius: "12px",
                  }}
                />
                <Legend />
                <Bar dataKey="views" fill="#3b82f6" name="Views" />
                <Bar dataKey="messages" fill="#a855f7" name="Chat Messages" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-75 flex items-center justify-center text-purple-400">
              No stream data available
            </div>
          )}
        </div>

        {/* Sentiment Timeline + Most Active Users */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sentiment Timeline */}
          <div className="lg:col-span-2 bg-linear-to-br from-slate-900/40 to-purple-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <Activity className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white">
                  Sentiment Timeline
                </h3>
                <p className="text-purple-300 text-sm">
                  Daily sentiment distribution in chat
                </p>
              </div>
            </div>

            {trends.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="_id" stroke="#c084fc" />
                  <YAxis stroke="#c084fc" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #a855f7",
                      borderRadius: "12px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="positiveCount"
                    stroke="#22c55e"
                    strokeWidth={2}
                    name="Positive"
                  />
                  <Line
                    type="monotone"
                    dataKey="neutralCount"
                    stroke="#eab308"
                    strokeWidth={2}
                    name="Neutral"
                  />
                  <Line
                    type="monotone"
                    dataKey="negativeCount"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="Negative"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-75 flex items-center justify-center text-purple-400">
                No sentiment timeline data available
              </div>
            )}
          </div>

          {/* Most Active Users */}
          <div className="bg-linear-to-br from-slate-900/40 to-purple-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-6">
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

        {/* Top Streams Table */}
        {analytics && analytics.topStreams.length > 0 && (
          <div className="bg-linear-to-br from-slate-900/40 to-purple-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-red-500/20 rounded-xl">
                <Signal className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white">
                  Stream Leaderboard
                </h3>
                <p className="text-purple-300 text-sm">
                  Monitored streams ranked by views
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-purple-300 text-xs uppercase border-b border-purple-500/20">
                    <th className="py-3 px-2">#</th>
                    <th className="py-3 px-2">Stream</th>
                    <th className="py-3 px-2 text-right">Views</th>
                    <th className="py-3 px-2 text-right">Likes</th>
                    <th className="py-3 px-2 text-right">Messages</th>
                    <th className="py-3 px-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topStreams.map((s, i) => (
                    <tr
                      key={s._id}
                      className="border-b border-purple-500/10 hover:bg-purple-500/5"
                    >
                      <td className="py-3 px-2 text-purple-400 text-sm">
                        {i + 1}
                      </td>
                      <td className="py-3 px-2">
                        <p className="text-white text-sm font-semibold truncate max-w-xs">
                          {s.title}
                        </p>
                        <p className="text-purple-500 text-xs truncate max-w-xs">
                          {s.channelTitle}
                        </p>
                      </td>
                      <td className="py-3 px-2 text-right text-amber-300 text-sm">
                        {fmtNum(s.views)}
                      </td>
                      <td className="py-3 px-2 text-right text-pink-300 text-sm">
                        {fmtNum(s.likes)}
                      </td>
                      <td className="py-3 px-2 text-right text-sky-300 text-sm">
                        {fmtNum(s.totalMessages)}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            s.liveStatus === "live"
                              ? "bg-red-500/20 text-red-300 border border-red-500/40"
                              : "bg-zinc-500/20 text-zinc-300 border border-zinc-500/40"
                          }`}
                        >
                          {s.liveStatus.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AI Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Risk Factors */}
          <div className="bg-linear-to-br from-red-900/40 to-pink-900/40 backdrop-blur-xl border border-red-500/30 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-red-500/20 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white">Risk Factors</h3>
                <p className="text-purple-300 text-sm">
                  Areas requiring attention
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {(analytics?.insights?.riskFactors?.length
                ? analytics.insights.riskFactors
                : ["No major risks identified"]
              ).map((risk, index) => {
                const isPositive = risk
                  .toLowerCase()
                  .includes("no major risks");
                return (
                  <div
                    key={index}
                    className={`p-4 rounded-xl border ${
                      isPositive
                        ? "bg-green-500/10 border-green-500/30"
                        : "bg-red-500/10 border-red-500/30"
                    }`}
                  >
                    <p
                      className={`text-sm ${
                        isPositive ? "text-green-300" : "text-red-300"
                      }`}
                    >
                      {isPositive ? "✓ " : "⚠ "}
                      {risk}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-linear-to-br from-green-900/40 to-emerald-900/40 backdrop-blur-xl border border-green-500/30 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-green-500/20 rounded-xl">
                <Lightbulb className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white">
                  AI Recommendations
                </h3>
                <p className="text-purple-300 text-sm">Suggested improvements</p>
              </div>
            </div>

            <div className="space-y-3">
              {(analytics?.insights?.recommendations?.length
                ? analytics.insights.recommendations
                : ["Continue current strategies and monitor engagement"]
              ).map((rec, index) => (
                <div
                  key={index}
                  className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl"
                >
                  <p className="text-green-300 text-sm">💡 {rec}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminYoutubeInsightPage;
