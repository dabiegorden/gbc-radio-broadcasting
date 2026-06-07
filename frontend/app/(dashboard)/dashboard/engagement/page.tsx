"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import {
  MessageSquare,
  Heart,
  Share2,
  UserPlus,
  TrendingUp,
  Trash2,
  Edit2,
  Send,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  Sparkles,
  BarChart3,
  Clock,
  Users,
  Radio,
  Smile,
  Meh,
  Frown,
  X,
  Save,
  Loader2,
} from "lucide-react";
import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Engagement {
  _id: string;
  user: {
    _id: string;
    fullName: string;
    email: string;
  };
  program: {
    _id: string;
    title: string;
    category?: string;
  };
  engagementType: "listening" | "comment" | "like" | "share" | "follow";
  comment?: {
    text: string;
    sentiment: "positive" | "neutral" | "negative" | null;
    engagementScore: number;
    aiAnalysis?: {
      summary: string;
      keywords: string[];
      predictedFollowUp: boolean;
    };
  };
  listeningDuration: number;
  sessionId: string;
  deviceInfo?: string;
  location?: string;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
}

interface EngagementStats {
  totalEngagements: number;
  commentCount: number;
  likeCount: number;
  shareCount: number;
  followCount: number;
  averageListeningDuration: number;
  totalListeningTime: number;
}

interface SentimentBreakdown {
  _id: string;
  count: number;
  avgScore: number;
}

interface Program {
  _id: string;
  title: string;
}

const AdminEngagementPage = () => {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [filteredEngagements, setFilteredEngagements] = useState<Engagement[]>(
    [],
  );
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<string>("");
  const [stats, setStats] = useState<EngagementStats | null>(null);
  const [sentimentBreakdown, setSentimentBreakdown] = useState<
    SentimentBreakdown[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSentiment, setFilterSentiment] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEngagement, setSelectedEngagement] =
    useState<Engagement | null>(null);
  const [commentText, setCommentText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // Initialize WebSocket
  useEffect(() => {
    socketRef.current = io(API_URL);

    socketRef.current.on("connect", () => {
      console.log("WebSocket connected");
    });

    socketRef.current.on("engagement-created", (data: any) => {
      console.log("New engagement:", data);
      fetchEngagements();
      if (selectedProgram) {
        fetchStats(selectedProgram);
      }
    });

    socketRef.current.on("engagement-updated", (data: any) => {
      console.log("Engagement updated:", data);
      fetchEngagements();
    });

    socketRef.current.on("engagement-deleted", (data: any) => {
      console.log("Engagement deleted:", data);
      fetchEngagements();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Fetch programs
  const fetchPrograms = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/programs`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPrograms(data.programs || []);
      }
    } catch (error) {
      console.error("Error fetching programs:", error);
    }
  };

  // Fetch engagements
  const fetchEngagements = async () => {
    try {
      const token = localStorage.getItem("token");
      let url = `${API_URL}/engagement?limit=100`;

      if (selectedProgram) {
        url += `&programId=${selectedProgram}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEngagements(data.engagements || []);
        setFilteredEngagements(data.engagements || []);
      }
    } catch (error) {
      console.error("Error fetching engagements:", error);
      toast.error("Failed to fetch engagements");
    }
  };

  // Fetch stats
  const fetchStats = async (programId: string) => {
    try {
      const response = await fetch(`${API_URL}/engagement/stats/${programId}`);

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setSentimentBreakdown(data.sentimentBreakdown || []);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchPrograms(), fetchEngagements()]);
      setIsLoading(false);
    };

    loadData();
  }, []);

  // Fetch stats when program selected
  useEffect(() => {
    if (selectedProgram) {
      fetchStats(selectedProgram);
      fetchEngagements();
    }
  }, [selectedProgram]);

  // Apply filters and search
  useEffect(() => {
    let result = [...engagements];

    // Search
    if (searchQuery) {
      result = result.filter(
        (eng) =>
          eng.comment?.text
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          eng.user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          eng.program.title.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    // Filter by type
    if (filterType) {
      result = result.filter((eng) => eng.engagementType === filterType);
    }

    // Filter by sentiment
    if (filterSentiment) {
      result = result.filter(
        (eng) => eng.comment?.sentiment === filterSentiment,
      );
    }

    setFilteredEngagements(result);
  }, [engagements, searchQuery, filterType, filterSentiment]);

  // Create comment
  const handleCreateComment = async () => {
    if (!commentText.trim() || !selectedProgram) {
      toast.error("Please select a program and enter a comment");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/engagement`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          programId: selectedProgram,
          engagementType: "comment",
          comment: commentText,
          sessionId: `session_${Date.now()}`,
        }),
      });

      if (response.ok) {
        toast.success("Comment posted successfully");
        setShowCommentModal(false);
        setCommentText("");
        fetchEngagements();
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to post comment");
      }
    } catch (error) {
      console.error("Error creating comment:", error);
      toast.error("Failed to post comment");
    }
  };

  // Update engagement
  const handleUpdateEngagement = async () => {
    if (!selectedEngagement || !commentText.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/engagement/${selectedEngagement._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            comment: commentText,
          }),
        },
      );

      if (response.ok) {
        toast.success("Comment updated successfully");
        setShowEditModal(false);
        setSelectedEngagement(null);
        setCommentText("");
        fetchEngagements();
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to update comment");
      }
    } catch (error) {
      console.error("Error updating engagement:", error);
      toast.error("Failed to update comment");
    }
  };

  // Delete engagement
  const handleDeleteEngagement = async (id: string) => {
    if (!confirm("Are you sure you want to delete this engagement?")) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/engagement/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast.success("Engagement deleted successfully");
        fetchEngagements();
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to delete engagement");
      }
    } catch (error) {
      console.error("Error deleting engagement:", error);
      toast.error("Failed to delete engagement");
    }
  };

  // Batch analyze comments
  const handleBatchAnalyze = async () => {
    const commentEngagements = engagements.filter(
      (eng) => eng.engagementType === "comment",
    );

    if (commentEngagements.length === 0) {
      toast.error("No comments to analyze");
      return;
    }

    setIsAnalyzing(true);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/engagement/analyze-batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          engagementIds: commentEngagements.map((eng) => eng._id),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(
          `Analyzed ${data.summary.successful} of ${data.summary.total} comments`,
        );
        fetchEngagements();
      } else {
        toast.error("Failed to analyze comments");
      }
    } catch (error) {
      console.error("Error analyzing comments:", error);
      toast.error("Failed to analyze comments");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Open edit modal
  const openEditModal = (engagement: Engagement) => {
    setSelectedEngagement(engagement);
    setCommentText(engagement.comment?.text || "");
    setShowEditModal(true);
  };

  // Get sentiment icon and color
  const getSentimentDisplay = (sentiment: string | null | undefined) => {
    switch (sentiment) {
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
      case "neutral":
      default:
        return {
          icon: <Meh className="w-4 h-4" />,
          color: "text-yellow-400",
          bg: "bg-yellow-500/20",
          border: "border-yellow-500/30",
        };
    }
  };

  // Get engagement type icon
  const getEngagementIcon = (type: string) => {
    switch (type) {
      case "comment":
        return <MessageSquare className="w-5 h-5" />;
      case "like":
        return <Heart className="w-5 h-5" />;
      case "share":
        return <Share2 className="w-5 h-5" />;
      case "follow":
        return <UserPlus className="w-5 h-5" />;
      default:
        return <Radio className="w-5 h-5" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-purple-300 text-lg font-semibold">
            Loading engagements...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-linear-to-r from-purple-400 via-pink-400 to-purple-400 mb-2">
              Engagement Analytics
            </h1>
            <p className="text-purple-300 text-lg">
              Real-time engagement tracking • AI-powered insights
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowCommentModal(true)}
              disabled={!selectedProgram}
              className="px-6 py-3 bg-linear-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-semibold flex items-center gap-2 transition-all duration-300 hover:scale-105 shadow-lg shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MessageSquare className="w-5 h-5" />
              New Comment
            </button>

            <button
              onClick={handleBatchAnalyze}
              disabled={isAnalyzing}
              className="px-6 py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 font-semibold flex items-center gap-2 transition-all duration-300 disabled:opacity-50"
            >
              {isAnalyzing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
              AI Analyze
            </button>
          </div>
        </div>

        {/* Program Selector & Search */}
        <div className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-6 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-purple-300 text-sm font-semibold mb-2">
                Select Program
              </label>
              <select
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
                className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
              >
                <option value="">All Programs</option>
                {programs.map((program) => (
                  <option key={program._id} value={program._id}>
                    {program.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-purple-300 text-sm font-semibold mb-2">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-purple-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search engagements, users, comments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 ${showFilters ? "bg-purple-600/30" : "bg-purple-600/20"} hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 font-semibold flex items-center gap-2 transition-all`}
            >
              <Filter className="w-4 h-4" />
              Filters
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
              />
            </button>

            <button
              onClick={fetchEngagements}
              className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 font-semibold flex items-center gap-2 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-purple-500/20">
              <div>
                <label className="block text-purple-300 text-sm font-semibold mb-2">
                  Engagement Type
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-4 py-2 bg-black/30 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                >
                  <option value="">All Types</option>
                  <option value="comment">Comments</option>
                  <option value="like">Likes</option>
                  <option value="share">Shares</option>
                  <option value="follow">Follows</option>
                </select>
              </div>

              <div>
                <label className="block text-purple-300 text-sm font-semibold mb-2">
                  Sentiment
                </label>
                <select
                  value={filterSentiment}
                  onChange={(e) => setFilterSentiment(e.target.value)}
                  className="w-full px-4 py-2 bg-black/30 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                >
                  <option value="">All Sentiments</option>
                  <option value="positive">Positive</option>
                  <option value="neutral">Neutral</option>
                  <option value="negative">Negative</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Dashboard */}
      {selectedProgram && stats && (
        <div className="max-w-7xl mx-auto mb-8 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <BarChart3 className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-purple-300 text-sm font-semibold">
                  Total Engagements
                </p>
                <p className="text-3xl font-black text-white">
                  {stats.totalEngagements}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-linear-to-br from-blue-900/40 to-cyan-900/40 backdrop-blur-xl border border-blue-500/30 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <MessageSquare className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-blue-300 text-sm font-semibold">Comments</p>
                <p className="text-3xl font-black text-white">
                  {stats.commentCount}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-linear-to-br from-pink-900/40 to-rose-900/40 backdrop-blur-xl border border-pink-500/30 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-pink-500/20 rounded-xl">
                <Heart className="w-6 h-6 text-pink-400" />
              </div>
              <div>
                <p className="text-pink-300 text-sm font-semibold">Likes</p>
                <p className="text-3xl font-black text-white">
                  {stats.likeCount}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-linear-to-br from-green-900/40 to-emerald-900/40 backdrop-blur-xl border border-green-500/30 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-green-500/20 rounded-xl">
                <Clock className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-green-300 text-sm font-semibold">
                  Avg. Time
                </p>
                <p className="text-3xl font-black text-white">
                  {Math.round(stats.averageListeningDuration / 60)}m
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sentiment Breakdown */}
      {selectedProgram && sentimentBreakdown.length > 0 && (
        <div className="max-w-7xl mx-auto mb-8">
          <div className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8 shadow-2xl">
            <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
              <TrendingUp className="w-7 h-7 text-purple-400" />
              Sentiment Distribution
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sentimentBreakdown.map((sentiment) => {
                const display = getSentimentDisplay(sentiment._id);
                return (
                  <div
                    key={sentiment._id}
                    className={`p-6 ${display.bg} border ${display.border} rounded-2xl`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={display.color}>{display.icon}</div>
                      <h4 className={`text-lg font-bold ${display.color}`}>
                        {sentiment._id.charAt(0).toUpperCase() +
                          sentiment._id.slice(1)}
                      </h4>
                    </div>
                    <p className="text-4xl font-black text-white mb-1">
                      {sentiment.count}
                    </p>
                    <p className="text-purple-300 text-sm">
                      Avg. Score: {Math.round(sentiment.avgScore)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Engagements List */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8 shadow-2xl">
          <h3 className="text-2xl font-black text-white mb-6">
            Engagements ({filteredEngagements.length})
          </h3>

          {filteredEngagements.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-purple-400/50 mx-auto mb-4" />
              <p className="text-purple-300 text-lg">No engagements found</p>
              <p className="text-purple-400/70">
                {searchQuery || filterType || filterSentiment
                  ? "Try adjusting your filters"
                  : "Start engaging with your programs!"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEngagements.map((engagement) => (
                <div
                  key={engagement._id}
                  className="p-6 bg-black/20 rounded-2xl border border-purple-500/20 hover:border-purple-500/50 transition-all duration-300"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                          {getEngagementIcon(engagement.engagementType)}
                        </div>
                        <div>
                          <h4 className="text-white font-bold">
                            {engagement.user.fullName}
                          </h4>
                          <p className="text-purple-400 text-sm">
                            {engagement?.program?.title}
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-xs font-semibold">
                          {engagement.engagementType}
                        </span>
                      </div>

                      {engagement.comment && (
                        <div className="mb-3">
                          <p className="text-white mb-2">
                            {engagement.comment.text}
                          </p>

                          {engagement.comment.aiAnalysis && (
                            <div className="bg-black/30 border border-purple-500/20 rounded-xl p-4 mt-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-4 h-4 text-purple-400" />
                                <span className="text-purple-300 text-sm font-semibold">
                                  AI Analysis
                                </span>
                              </div>
                              <p className="text-purple-200 text-sm mb-2">
                                {engagement.comment.aiAnalysis.summary}
                              </p>
                              {engagement.comment.aiAnalysis.keywords.length >
                                0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {engagement.comment.aiAnalysis.keywords.map(
                                    (keyword, idx) => (
                                      <span
                                        key={idx}
                                        className="px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-xs"
                                      >
                                        {keyword}
                                      </span>
                                    ),
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-sm text-purple-300">
                        {engagement.comment?.sentiment && (
                          <div
                            className={`flex items-center gap-1 px-3 py-1 ${getSentimentDisplay(engagement.comment.sentiment).bg} border ${getSentimentDisplay(engagement.comment.sentiment).border} rounded-full`}
                          >
                            {
                              getSentimentDisplay(engagement.comment.sentiment)
                                .icon
                            }
                            <span
                              className={
                                getSentimentDisplay(
                                  engagement.comment.sentiment,
                                ).color
                              }
                            >
                              {engagement.comment.sentiment}
                            </span>
                            {engagement.comment.engagementScore > 0 && (
                              <span
                                className={
                                  getSentimentDisplay(
                                    engagement.comment.sentiment,
                                  ).color
                                }
                              >
                                • {engagement.comment.engagementScore}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(engagement.createdAt).toLocaleString()}
                        </div>

                        {engagement.listeningDuration > 0 && (
                          <div className="flex items-center gap-1">
                            <Radio className="w-4 h-4" />
                            {Math.round(engagement.listeningDuration / 60)}m
                            listened
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {engagement.engagementType === "comment" && (
                        <button
                          onClick={() => openEditModal(engagement)}
                          className="p-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg transition-all duration-300 hover:scale-110"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4 text-blue-400" />
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteEngagement(engagement._id)}
                        className="p-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg transition-all duration-300 hover:scale-110"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Comment Modal */}
      {showCommentModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-linear-to-br from-purple-900/95 to-pink-900/95 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8 max-w-2xl w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-black text-white">New Comment</h2>
              <button
                onClick={() => {
                  setShowCommentModal(false);
                  setCommentText("");
                }}
                className="p-2 hover:bg-purple-600/20 rounded-xl transition-all"
              >
                <X className="w-6 h-6 text-purple-300" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-purple-300 text-sm font-semibold mb-2">
                  Your Comment
                </label>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
                  placeholder="Share your thoughts about this program..."
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setShowCommentModal(false);
                    setCommentText("");
                  }}
                  className="flex-1 px-6 py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateComment}
                  className="flex-1 px-6 py-3 bg-linear-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-lg"
                >
                  <Send className="w-5 h-5" />
                  Post Comment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Comment Modal */}
      {showEditModal && selectedEngagement && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-linear-to-br from-purple-900/95 to-pink-900/95 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8 max-w-2xl w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-black text-white">Edit Comment</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedEngagement(null);
                  setCommentText("");
                }}
                className="p-2 hover:bg-purple-600/20 rounded-xl transition-all"
              >
                <X className="w-6 h-6 text-purple-300" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-purple-300 text-sm font-semibold mb-2">
                  Your Comment
                </label>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
                  placeholder="Update your comment..."
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedEngagement(null);
                    setCommentText("");
                  }}
                  className="flex-1 px-6 py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateEngagement}
                  className="flex-1 px-6 py-3 bg-linear-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-lg"
                >
                  <Save className="w-5 h-5" />
                  Update Comment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEngagementPage;
