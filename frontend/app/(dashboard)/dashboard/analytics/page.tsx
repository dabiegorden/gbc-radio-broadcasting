"use client";

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
  Radio,
  MessageSquare,
  Heart,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  RefreshCw,
  Loader2,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface DashboardAnalytics {
  summary: {
    totalUsers: number;
    activeUsers: number;
    totalPrograms: number;
    totalEngagements: number;
    livePrograms: number;
    totalListeners: number;
    currentListeners: number;
    avgEngagementScore: number;
  };
  engagementBreakdown: Array<{ _id: string; count: number }>;
  sentimentBreakdown: Array<{ _id: string; count: number }>;
  categoryPerformance: Array<{
    _id: string;
    count: number;
    totalListeners: number;
    avgEngagement: number;
  }>;
}

interface TrendData {
  _id: string;
  totalEngagements: number;
  avgScore: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
}

const COLORS = {
  primary: ["#f97316", "#fb923c", "#fdba74", "#fed7aa"],
  sentiment: {
    positive: "#22c55e",
    neutral: "#eab308",
    negative: "#ef4444",
  },
  engagement: ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b"],
};

const AdminAnalyticsPage = () => {
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  });
  const [trendPeriod, setTrendPeriod] = useState("30");

  // Fetch dashboard analytics
  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem("token");
      let url = `${API_URL}/api/analytics/dashboard`;

      const params = new URLSearchParams();
      if (dateRange.startDate) params.append("startDate", dateRange.startDate);
      if (dateRange.endDate) params.append("endDate", dateRange.endDate);

      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast.error("Failed to fetch analytics");
    }
  };

  // Fetch trends
  const fetchTrends = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/api/analytics/trends?days=${trendPeriod}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        setTrends(data.trends);
      }
    } catch (error) {
      console.error("Error fetching trends:", error);
    }
  };

  // Download PDF report
  const downloadPDFReport = async () => {
    setIsDownloading(true);
    try {
      const token = localStorage.getItem("token");
      let url = `${API_URL}/api/analytics/report/pdf`;

      const params = new URLSearchParams();
      if (dateRange.startDate) params.append("startDate", dateRange.startDate);
      if (dateRange.endDate) params.append("endDate", dateRange.endDate);
      params.append("includePrograms", "true");

      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = `analytics-report-${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);

        toast.success("Report downloaded successfully");
      } else {
        toast.error("Failed to generate report");
      }
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error("Failed to download report");
    } finally {
      setIsDownloading(false);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchAnalytics(), fetchTrends()]);
      setIsLoading(false);
    };

    loadData();
  }, [dateRange, trendPeriod]);

  // Refresh data
  const handleRefresh = async () => {
    toast.info("Refreshing data...");
    await Promise.all([fetchAnalytics(), fetchTrends()]);
    toast.success("Data refreshed");
  };

  // Format sentiment data for pie chart
  const sentimentData =
    analytics?.sentimentBreakdown.map((item) => ({
      name: item._id,
      value: item.count,
    })) || [];

  // Format engagement breakdown for pie chart
  const engagementData =
    analytics?.engagementBreakdown.map((item) => ({
      name: item._id,
      value: item.count,
    })) || [];

  // Format category performance for bar chart
  const categoryData =
    analytics?.categoryPerformance.map((item) => ({
      category: item._id,
      programs: item.count,
      listeners: item.totalListeners,
      engagement: item.avgEngagement,
    })) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-orange-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-orange-300 text-lg font-semibold">
            Loading analytics...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-orange-950 to-slate-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-linear-to-r from-orange-400 via-amber-400 to-orange-400 mb-2">
              Analytics & Insights
            </h1>
            <p className="text-orange-300 text-lg">
              Comprehensive performance metrics and predictions
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/30 rounded-xl text-orange-300 font-semibold flex items-center gap-2 transition-all duration-300"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>

            <button
              onClick={downloadPDFReport}
              disabled={isDownloading}
              className="px-4 py-2 bg-linear-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 rounded-xl text-white font-semibold flex items-center gap-2 transition-all duration-300 hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="bg-linear-to-br from-slate-900/40 to-orange-900/40 backdrop-blur-xl border border-orange-500/30 rounded-2xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-orange-300 font-semibold mb-2 text-sm">
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
                className="w-full px-4 py-2 bg-slate-900/50 border border-orange-500/30 rounded-xl text-white focus:outline-none focus:border-orange-500/50"
              />
            </div>

            <div>
              <label className="block text-orange-300 font-semibold mb-2 text-sm">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, endDate: e.target.value }))
                }
                className="w-full px-4 py-2 bg-slate-900/50 border border-orange-500/30 rounded-xl text-white focus:outline-none focus:border-orange-500/50"
              />
            </div>

            <div>
              <label className="block text-orange-300 font-semibold mb-2 text-sm">
                Trend Period (Days)
              </label>
              <select
                value={trendPeriod}
                onChange={(e) => setTrendPeriod(e.target.value)}
                className="w-full px-4 py-2 bg-slate-900/50 border border-orange-500/30 rounded-xl text-white focus:outline-none focus:border-orange-500/50 appearance-none cursor-pointer"
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
            <div className="bg-linear-to-br from-orange-900/40 to-amber-900/40 backdrop-blur-xl border border-orange-500/30 rounded-2xl p-6 hover:scale-105 transition-transform duration-300">
              <div className="flex items-center justify-between mb-3">
                <span className="text-orange-300 text-sm font-semibold">
                  Total Users
                </span>
                <Users className="w-5 h-5 text-orange-400" />
              </div>
              <p className="text-4xl font-black text-white mb-1">
                {analytics.summary?.totalUsers ?? 0}
              </p>
              <p className="text-orange-400 text-sm">
                {analytics.summary?.activeUsers ?? 0} active
              </p>
            </div>

            <div className="bg-linear-to-br from-blue-900/40 to-cyan-900/40 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-6 hover:scale-105 transition-transform duration-300">
              <div className="flex items-center justify-between mb-3">
                <span className="text-blue-300 text-sm font-semibold">
                  Total Programs
                </span>
                <Radio className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-4xl font-black text-white mb-1">
                {analytics.summary?.totalPrograms ?? 0}
              </p>
              <p className="text-blue-400 text-sm">
                {analytics.summary?.livePrograms ?? 0} live
              </p>
            </div>

            <div className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-6 hover:scale-105 transition-transform duration-300">
              <div className="flex items-center justify-between mb-3">
                <span className="text-purple-300 text-sm font-semibold">
                  Engagements
                </span>
                <MessageSquare className="w-5 h-5 text-purple-400" />
              </div>
              <p className="text-4xl font-black text-white mb-1">
                {analytics.summary?.totalEngagements ?? 0}
              </p>
              <p className="text-purple-400 text-sm">
                Avg Score:{" "}
                {(analytics.summary?.avgEngagementScore ?? 0).toFixed(1)}
              </p>
            </div>

            <div className="bg-linear-to-br from-green-900/40 to-emerald-900/40 backdrop-blur-xl border border-green-500/30 rounded-2xl p-6 hover:scale-105 transition-transform duration-300">
              <div className="flex items-center justify-between mb-3">
                <span className="text-green-300 text-sm font-semibold">
                  Total Listeners
                </span>
                <Activity className="w-5 h-5 text-green-400" />
              </div>
              <p className="text-4xl font-black text-white mb-1">
                {analytics.summary?.totalListeners ?? 0}
              </p>
              <p className="text-green-400 text-sm">
                {analytics.summary?.currentListeners ?? 0} listening now
              </p>
            </div>
          </div>
        )}

        {/* Engagement Trends Chart */}
        <div className="bg-linear-to-br from-slate-900/40 to-orange-900/40 backdrop-blur-xl border border-orange-500/30 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-orange-500/20 rounded-xl">
              <TrendingUp className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white">
                Engagement Trends
              </h3>
              <p className="text-orange-300 text-sm">
                Daily engagement over time
              </p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trends}>
              <defs>
                <linearGradient
                  id="colorEngagement"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="_id" stroke="#fb923c" />
              <YAxis stroke="#fb923c" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #f97316",
                  borderRadius: "12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="totalEngagements"
                stroke="#f97316"
                fillOpacity={1}
                fill="url(#colorEngagement)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Sentiment Analysis & Engagement Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sentiment Pie Chart */}
          <div className="bg-linear-to-br from-slate-900/40 to-orange-900/40 backdrop-blur-xl border border-orange-500/30 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-green-500/20 rounded-xl">
                <Heart className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white">
                  Sentiment Analysis
                </h3>
                <p className="text-orange-300 text-sm">
                  User sentiment breakdown
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
                    label={({ name, percent }: any) =>
                      `${name}: ${((percent || 0) * 100).toFixed(0)}%`
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
                          ]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #f97316",
                      borderRadius: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-75 flex items-center justify-center text-orange-400">
                No sentiment data available
              </div>
            )}
          </div>

          {/* Engagement Type Breakdown */}
          <div className="bg-linear-to-br from-slate-900/40 to-orange-900/40 backdrop-blur-xl border border-orange-500/30 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <PieChartIcon className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white">
                  Engagement Types
                </h3>
                <p className="text-orange-300 text-sm">Breakdown by activity</p>
              </div>
            </div>

            {engagementData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={engagementData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: any) =>
                      `${name}: ${((percent || 0) * 100).toFixed(0)}%`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {engagementData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          COLORS.engagement[index % COLORS.engagement.length]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #f97316",
                      borderRadius: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-75 flex items-center justify-center text-orange-400">
                No engagement data available
              </div>
            )}
          </div>
        </div>

        {/* Category Performance */}
        <div className="bg-linear-to-br from-slate-900/40 to-orange-900/40 backdrop-blur-xl border border-orange-500/30 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <BarChart3 className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white">
                Category Performance
              </h3>
              <p className="text-orange-300 text-sm">
                Programs and listeners by category
              </p>
            </div>
          </div>

          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="category" stroke="#fb923c" />
                <YAxis stroke="#fb923c" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #f97316",
                    borderRadius: "12px",
                  }}
                />
                <Legend />
                <Bar dataKey="programs" fill="#3b82f6" name="Programs" />
                <Bar dataKey="listeners" fill="#f97316" name="Listeners" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-75 flex items-center justify-center text-orange-400">
              No category data available
            </div>
          )}
        </div>

        {/* Sentiment Trend Line Chart */}
        <div className="bg-linear-to-br from-slate-900/40 to-orange-900/40 backdrop-blur-xl border border-orange-500/30 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <Activity className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white">
                Sentiment Timeline
              </h3>
              <p className="text-orange-300 text-sm">
                Daily sentiment distribution
              </p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="_id" stroke="#fb923c" />
              <YAxis stroke="#fb923c" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #f97316",
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
        </div>

        {/* AI Insights & Predictions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Risk Factors */}
          <div className="bg-linear-to-br from-red-900/40 to-orange-900/40 backdrop-blur-xl border border-red-500/30 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-red-500/20 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white">Risk Factors</h3>
                <p className="text-orange-300 text-sm">
                  Areas requiring attention
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {analytics &&
              analytics.summary?.avgEngagementScore !== undefined &&
              analytics.summary.avgEngagementScore < 50 ? (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-300 text-sm">
                    Low average engagement score (
                    {analytics.summary.avgEngagementScore.toFixed(1)}/100)
                  </p>
                </div>
              ) : null}
              {analytics &&
              analytics.summary?.livePrograms !== undefined &&
              analytics.summary.livePrograms === 0 ? (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-300 text-sm">
                    No programs currently live
                  </p>
                </div>
              ) : null}
              {analytics &&
              analytics.summary?.currentListeners !== undefined &&
              analytics.summary.currentListeners < 10 ? (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-300 text-sm">
                    Low current listener count
                  </p>
                </div>
              ) : null}
              {analytics &&
                analytics.summary?.avgEngagementScore !== undefined &&
                analytics.summary?.livePrograms !== undefined &&
                analytics.summary?.currentListeners !== undefined &&
                analytics.summary.avgEngagementScore >= 50 &&
                analytics.summary.livePrograms > 0 &&
                analytics.summary.currentListeners >= 10 && (
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                    <p className="text-green-300 text-sm">
                      ✓ No major risks identified
                    </p>
                  </div>
                )}
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
                <p className="text-orange-300 text-sm">
                  Suggested improvements
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {analytics &&
              analytics.summary?.totalEngagements !== undefined &&
              analytics.summary.totalEngagements < 100 ? (
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <p className="text-green-300 text-sm">
                    💡 Increase social media promotion to boost engagement
                  </p>
                </div>
              ) : null}
              {analytics &&
              analytics.summary?.livePrograms !== undefined &&
              analytics.summary.livePrograms < 3 ? (
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <p className="text-green-300 text-sm">
                    💡 Schedule more live programs to increase listener
                    engagement
                  </p>
                </div>
              ) : null}
              {analytics &&
              analytics.summary?.avgEngagementScore !== undefined &&
              analytics.summary.avgEngagementScore > 70 ? (
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <p className="text-green-300 text-sm">
                    💡 Excellent engagement! Consider expanding to more time
                    slots
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsPage;
