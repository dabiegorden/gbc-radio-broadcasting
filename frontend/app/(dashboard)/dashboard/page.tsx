"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Users,
  Radio,
  TrendingUp,
  Activity,
  Calendar,
  MessageSquare,
  Eye,
  BarChart3,
  Clock,
  Heart,
  Signal,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalPrograms: number;
  livePrograms: number;
  totalEngagements: number;
  totalListeners: number;
  currentListeners: number;
  avgEngagementScore: number;
}

interface RecentProgram {
  _id: string;
  title: string;
  host: string;
  category: string;
  isLive: boolean;
  currentListeners: number;
  scheduleStartTime: string;
}

interface TrendData {
  label: string;
  value: number;
  change: number;
}

const AdminDashboardHomePage = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentPrograms, setRecentPrograms] = useState<RecentProgram[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem("token");

      // Fetch analytics
      const analyticsRes = await fetch(`${API_URL}/analytics/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setStats(analyticsData.analytics.summary);
      }

      // Fetch recent programs
      const programsRes = await fetch(`${API_URL}/programs?limit=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (programsRes.ok) {
        const programsData = await programsRes.json();
        setRecentPrograms(programsData.data || []);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  // Get user from localStorage
  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    }
    fetchDashboardData();
  }, []);

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  // Calculate trend percentage (mock data for now)
  const calculateTrend = (current: number, type: string): number => {
    // In production, you'd compare with previous period
    const trends: { [key: string]: number } = {
      users: 12.5,
      programs: 8.3,
      engagements: 15.7,
      listeners: -3.2,
    };
    return trends[type] || 0;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-purple-300 text-lg font-semibold">
            Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-8 h-8 text-purple-400" />
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-linear-to-r from-purple-400 via-pink-400 to-purple-400">
              {getGreeting()}, {user?.firstName || "Admin"}!
            </h1>
          </div>
          <p className="text-purple-300 text-lg">
            Here's what's happening with your radio station today
          </p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Users */}
          <div className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-6 hover:scale-105 transition-all duration-300 shadow-xl group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-500/20 rounded-xl group-hover:bg-purple-500/30 transition-colors">
                <Users className="w-6 h-6 text-purple-400" />
              </div>
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                  calculateTrend(stats?.totalUsers || 0, "users") >= 0
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {calculateTrend(stats?.totalUsers || 0, "users") >= 0 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {Math.abs(calculateTrend(stats?.totalUsers || 0, "users"))}%
              </div>
            </div>
            <h3 className="text-purple-300 text-sm font-semibold mb-1">
              Total Users
            </h3>
            <p className="text-4xl font-black text-white mb-1">
              {stats?.totalUsers || 0}
            </p>
            <p className="text-purple-400 text-sm">
              {stats?.activeUsers || 0} active
            </p>
          </div>

          {/* Total Programs */}
          <div className="bg-linear-to-br from-blue-900/40 to-cyan-900/40 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-6 hover:scale-105 transition-all duration-300 shadow-xl group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-500/20 rounded-xl group-hover:bg-blue-500/30 transition-colors">
                <Radio className="w-6 h-6 text-blue-400" />
              </div>
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                  calculateTrend(stats?.totalPrograms || 0, "programs") >= 0
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {calculateTrend(stats?.totalPrograms || 0, "programs") >= 0 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {Math.abs(
                  calculateTrend(stats?.totalPrograms || 0, "programs"),
                )}
                %
              </div>
            </div>
            <h3 className="text-blue-300 text-sm font-semibold mb-1">
              Total Programs
            </h3>
            <p className="text-4xl font-black text-white mb-1">
              {stats?.totalPrograms || 0}
            </p>
            <p className="text-blue-400 text-sm">
              {stats?.livePrograms || 0} live now
            </p>
          </div>

          {/* Total Engagements */}
          <div className="bg-linear-to-br from-pink-900/40 to-rose-900/40 backdrop-blur-xl border border-pink-500/30 rounded-2xl p-6 hover:scale-105 transition-all duration-300 shadow-xl group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-pink-500/20 rounded-xl group-hover:bg-pink-500/30 transition-colors">
                <MessageSquare className="w-6 h-6 text-pink-400" />
              </div>
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                  calculateTrend(stats?.totalEngagements || 0, "engagements") >=
                  0
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {calculateTrend(stats?.totalEngagements || 0, "engagements") >=
                0 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {Math.abs(
                  calculateTrend(stats?.totalEngagements || 0, "engagements"),
                )}
                %
              </div>
            </div>
            <h3 className="text-pink-300 text-sm font-semibold mb-1">
              Total Engagements
            </h3>
            <p className="text-4xl font-black text-white mb-1">
              {stats?.totalEngagements || 0}
            </p>
            <p className="text-pink-400 text-sm">
              {(stats?.avgEngagementScore || 0).toFixed(1)} avg score
            </p>
          </div>

          {/* Total Listeners */}
          <div className="bg-linear-to-br from-green-900/40 to-emerald-900/40 backdrop-blur-xl border border-green-500/30 rounded-2xl p-6 hover:scale-105 transition-all duration-300 shadow-xl group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-500/20 rounded-xl group-hover:bg-green-500/30 transition-colors">
                <Activity className="w-6 h-6 text-green-400" />
              </div>
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                  calculateTrend(stats?.totalListeners || 0, "listeners") >= 0
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {calculateTrend(stats?.totalListeners || 0, "listeners") >=
                0 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {Math.abs(
                  calculateTrend(stats?.totalListeners || 0, "listeners"),
                )}
                %
              </div>
            </div>
            <h3 className="text-green-300 text-sm font-semibold mb-1">
              Total Listeners
            </h3>
            <p className="text-4xl font-black text-white mb-1">
              {stats?.totalListeners || 0}
            </p>
            <p className="text-green-400 text-sm">
              {stats?.currentListeners || 0} listening now
            </p>
          </div>
        </div>

        {/* Quick Actions & Recent Programs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Quick Actions */}
          <div className="lg:col-span-1">
            <div className="bg-linear-to-br from-slate-900/40 to-purple-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-purple-500/20 rounded-xl">
                  <Zap className="w-6 h-6 text-purple-400" />
                </div>
                <h2 className="text-2xl font-black text-white">
                  Quick Actions
                </h2>
              </div>

              <div className="space-y-3">
                <Link
                  href="/dashboard/programs"
                  className="block p-4 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-xl transition-all duration-300 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Radio className="w-5 h-5 text-purple-400" />
                      <span className="text-white font-semibold">
                        Manage Programs
                      </span>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-purple-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </div>
                </Link>

                <Link
                  href="/dashboard/streaming"
                  className="block p-4 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-xl transition-all duration-300 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Signal className="w-5 h-5 text-green-400" />
                      <span className="text-white font-semibold">
                        Live Streaming
                      </span>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-green-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </div>
                </Link>

                <Link
                  href="/dashboard/analytics"
                  className="block p-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl transition-all duration-300 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <BarChart3 className="w-5 h-5 text-blue-400" />
                      <span className="text-white font-semibold">
                        View Analytics
                      </span>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-blue-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </div>
                </Link>

                <Link
                  href="/dashboard/users"
                  className="block p-4 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 rounded-xl transition-all duration-300 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-pink-400" />
                      <span className="text-white font-semibold">
                        Manage Users
                      </span>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-pink-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* Recent Programs */}
          <div className="lg:col-span-2">
            <div className="bg-linear-to-br from-slate-900/40 to-purple-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-500/20 rounded-xl">
                    <Calendar className="w-6 h-6 text-purple-400" />
                  </div>
                  <h2 className="text-2xl font-black text-white">
                    Recent Programs
                  </h2>
                </div>
                <Link
                  href="/dashboard/programs"
                  className="text-purple-400 hover:text-purple-300 text-sm font-semibold flex items-center gap-1"
                >
                  View All
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="space-y-3">
                {recentPrograms.length > 0 ? (
                  recentPrograms.map((program) => (
                    <div
                      key={program._id}
                      className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl hover:bg-purple-500/15 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="text-white font-bold mb-1">
                            {program.title}
                          </h3>
                          <p className="text-purple-300 text-sm">
                            {program.host}
                          </p>
                        </div>
                        {program.isLive && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
                            <Signal className="w-3 h-3 text-green-400 animate-pulse" />
                            <span className="text-green-400 text-xs font-semibold">
                              LIVE
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-xs">
                          {program.category}
                        </span>
                        <div className="flex items-center gap-1 text-purple-400">
                          <Users className="w-4 h-4" />
                          {program.currentListeners}
                        </div>
                        <div className="flex items-center gap-1 text-purple-400">
                          <Clock className="w-4 h-4" />
                          {new Date(
                            program.scheduleStartTime,
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-purple-400">
                    No programs found
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Performance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Engagement Rate */}
          <div className="bg-linear-to-br from-slate-900/40 to-purple-900/40 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-pink-500/20 rounded-xl">
                <Heart className="w-5 h-5 text-pink-400" />
              </div>
              <h3 className="text-white font-bold">Engagement Rate</h3>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <p className="text-3xl font-black text-white">
                {(stats?.avgEngagementScore || 0).toFixed(1)}
              </p>
              <span className="text-purple-400 text-sm font-semibold">
                /100
              </span>
            </div>
            <div className="w-full bg-purple-900/50 rounded-full h-2 mb-2">
              <div
                className="bg-linear-to-r from-pink-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${stats?.avgEngagementScore || 0}%` }}
              ></div>
            </div>
            <p className="text-purple-400 text-sm">Average engagement score</p>
          </div>

          {/* Active Programs */}
          <div className="bg-linear-to-br from-slate-900/40 to-blue-900/40 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <Eye className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-white font-bold">Live Programs</h3>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <p className="text-3xl font-black text-white">
                {stats?.livePrograms || 0}
              </p>
              <span className="text-blue-400 text-sm font-semibold">
                /{stats?.totalPrograms || 0}
              </span>
            </div>
            <div className="w-full bg-blue-900/50 rounded-full h-2 mb-2">
              <div
                className="bg-linear-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${stats?.totalPrograms ? (stats.livePrograms / stats.totalPrograms) * 100 : 0}%`,
                }}
              ></div>
            </div>
            <p className="text-blue-400 text-sm">Currently broadcasting</p>
          </div>

          {/* Active Listeners */}
          <div className="bg-linear-to-br from-slate-900/40 to-green-900/40 backdrop-blur-xl border border-green-500/30 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-green-500/20 rounded-xl">
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="text-white font-bold">Active Listeners</h3>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <p className="text-3xl font-black text-white">
                {stats?.currentListeners || 0}
              </p>
              <span className="text-green-400 text-sm font-semibold">now</span>
            </div>
            <div className="w-full bg-green-900/50 rounded-full h-2 mb-2">
              <div
                className="bg-linear-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500 animate-pulse"
                style={{
                  width: `${stats?.totalListeners ? (stats.currentListeners / stats.totalListeners) * 100 : 0}%`,
                }}
              ></div>
            </div>
            <p className="text-green-400 text-sm">
              {stats?.totalListeners || 0} total listeners
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardHomePage;
