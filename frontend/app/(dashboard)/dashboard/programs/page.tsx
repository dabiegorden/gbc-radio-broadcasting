"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Radio,
  Clock,
  Users,
  TrendingUp,
  Calendar,
  MoreVertical,
  X,
  Save,
  RefreshCw,
  ChevronDown,
  Signal,
  Video,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";

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
  isRecurring: boolean;
  recurringDays: string[];
  streamingUrl: string | null;
  status: "scheduled" | "live" | "completed" | "cancelled";
  currentListeners: number;
  totalListeners: number;
  averageEngagementScore: number;
  coverImage: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface ProgramFormData {
  title: string;
  description: string;
  host: string;
  category: string;
  scheduleStartTime: string;
  scheduleEndTime: string;
  isRecurring: boolean;
  recurringDays: string[];
  streamingUrl: string;
  tags: string;
}

const CATEGORIES = [
  "news",
  "music",
  "talk-show",
  "drama",
  "sports",
  "educational",
  "entertainment",
  "other",
];

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const STATUS_OPTIONS = ["scheduled", "live", "completed", "cancelled"];

const AdminProgramsPage = () => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [filteredPrograms, setFilteredPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);

  const [formData, setFormData] = useState<ProgramFormData>({
    title: "",
    description: "",
    host: "",
    category: "other",
    scheduleStartTime: "",
    scheduleEndTime: "",
    isRecurring: false,
    recurringDays: [],
    streamingUrl: "",
    tags: "",
  });

  // Fetch programs
  const fetchPrograms = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/programs`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPrograms(data.programs || []);
        setFilteredPrograms(data.programs || []);
      }
    } catch (error) {
      console.error("Error fetching programs:", error);
      toast.error("Failed to fetch programs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  // Apply filters, search, and sorting
  useEffect(() => {
    let result = [...programs];

    // Search
    if (searchQuery) {
      result = result.filter(
        (program) =>
          program.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          program.description
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          program.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
          program.tags.some((tag) =>
            tag.toLowerCase().includes(searchQuery.toLowerCase())
          )
      );
    }

    // Filter by category
    if (filterCategory) {
      result = result.filter((program) => program.category === filterCategory);
    }

    // Filter by status
    if (filterStatus) {
      result = result.filter((program) => program.status === filterStatus);
    }

    // Sort
    result.sort((a, b) => {
      let aValue: any = a[sortBy as keyof Program];
      let bValue: any = b[sortBy as keyof Program];

      // Handle dates
      if (sortBy.includes("Time") || sortBy.includes("At")) {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredPrograms(result);
  }, [programs, searchQuery, filterCategory, filterStatus, sortBy, sortOrder]);

  // Handle form change
  const handleFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Handle recurring days toggle
  const toggleRecurringDay = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      recurringDays: prev.recurringDays.includes(day)
        ? prev.recurringDays.filter((d) => d !== day)
        : [...prev.recurringDays, day],
    }));
  };

  // Create program
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/programs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          tags: formData.tags.split(",").map((tag) => tag.trim()),
        }),
      });

      if (response.ok) {
        toast.success("Program created successfully");
        setShowCreateModal(false);
        resetForm();
        fetchPrograms();
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to create program");
      }
    } catch (error) {
      console.error("Error creating program:", error);
      toast.error("Failed to create program");
    }
  };

  // Update program
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProgram) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/api/programs/${selectedProgram._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...formData,
            tags: formData.tags.split(",").map((tag) => tag.trim()),
          }),
        }
      );

      if (response.ok) {
        toast.success("Program updated successfully");
        setShowEditModal(false);
        setSelectedProgram(null);
        resetForm();
        fetchPrograms();
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to update program");
      }
    } catch (error) {
      console.error("Error updating program:", error);
      toast.error("Failed to update program");
    }
  };

  // Delete program
  const handleDelete = async (programId: string) => {
    if (!confirm("Are you sure you want to delete this program?")) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/programs/${programId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toast.success("Program deleted successfully");
        fetchPrograms();
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to delete program");
      }
    } catch (error) {
      console.error("Error deleting program:", error);
      toast.error("Failed to delete program");
    }
  };

  // Toggle live status
  const toggleLiveStatus = async (programId: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/api/programs/${programId}/live`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ isLive: !currentStatus }),
        }
      );

      if (response.ok) {
        toast.success(`Program is now ${!currentStatus ? "live" : "offline"}`);
        fetchPrograms();
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to update live status");
      }
    } catch (error) {
      console.error("Error updating live status:", error);
      toast.error("Failed to update live status");
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      host: "",
      category: "other",
      scheduleStartTime: "",
      scheduleEndTime: "",
      isRecurring: false,
      recurringDays: [],
      streamingUrl: "",
      tags: "",
    });
  };

  // Open edit modal
  const openEditModal = (program: Program) => {
    setSelectedProgram(program);
    setFormData({
      title: program.title,
      description: program.description,
      host: program.host,
      category: program.category,
      scheduleStartTime: new Date(program.scheduleStartTime)
        .toISOString()
        .slice(0, 16),
      scheduleEndTime: new Date(program.scheduleEndTime)
        .toISOString()
        .slice(0, 16),
      isRecurring: program.isRecurring,
      recurringDays: program.recurringDays || [],
      streamingUrl: program.streamingUrl || "",
      tags: program.tags.join(", "),
    });
    setShowEditModal(true);
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "live":
        return "bg-green-500/20 border-green-500/30 text-green-300";
      case "scheduled":
        return "bg-blue-500/20 border-blue-500/30 text-blue-300";
      case "completed":
        return "bg-purple-500/20 border-purple-500/30 text-purple-300";
      case "cancelled":
        return "bg-red-500/20 border-red-500/30 text-red-300";
      default:
        return "bg-gray-500/20 border-gray-500/30 text-gray-300";
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "live":
        return <Signal className="w-4 h-4" />;
      case "scheduled":
        return <Clock className="w-4 h-4" />;
      case "completed":
        return <CheckCircle2 className="w-4 h-4" />;
      case "cancelled":
        return <XCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-purple-300 text-lg font-semibold">
            Loading programs...
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
              Program Management
            </h1>
            <p className="text-purple-300 text-lg">
              Create, manage, and schedule radio programs
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-linear-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-semibold flex items-center gap-2 transition-all duration-300 hover:scale-105 shadow-lg shadow-purple-500/50"
          >
            <Plus className="w-5 h-5" />
            Create Program
          </button>
        </div>

        {/* Search and Filters */}
        <div className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-6 shadow-2xl">
          {/* Search Bar */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-purple-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search programs by title, host, description, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50 transition-all"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-6 py-3 ${showFilters ? "bg-purple-600/30" : "bg-purple-600/20"} hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 font-semibold flex items-center gap-2 transition-all duration-300`}
            >
              <Filter className="w-5 h-5" />
              Filters
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
              />
            </button>

            <button
              onClick={fetchPrograms}
              className="px-6 py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 font-semibold flex items-center gap-2 transition-all duration-300"
            >
              <RefreshCw className="w-5 h-5" />
              Refresh
            </button>
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-purple-500/20">
              <div>
                <label className="block text-purple-300 text-sm font-semibold mb-2">
                  Category
                </label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-4 py-2 bg-black/30 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-purple-300 text-sm font-semibold mb-2">
                  Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-4 py-2 bg-black/30 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                >
                  <option value="">All Statuses</option>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-purple-300 text-sm font-semibold mb-2">
                  Sort By
                </label>
                <div className="flex gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="flex-1 px-4 py-2 bg-black/30 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="createdAt">Date Created</option>
                    <option value="scheduleStartTime">Start Time</option>
                    <option value="title">Title</option>
                    <option value="currentListeners">Listeners</option>
                  </select>
                  <button
                    onClick={() =>
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                    }
                    className="px-4 py-2 bg-black/30 border border-purple-500/30 rounded-xl text-purple-300 hover:bg-purple-600/20 transition-all"
                  >
                    {sortOrder === "asc" ? "↑" : "↓"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Programs Stats */}
      <div className="max-w-7xl mx-auto mb-8 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <Radio className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-purple-300 text-sm font-semibold">
                Total Programs
              </p>
              <p className="text-3xl font-black text-white">{programs.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-linear-to-br from-green-900/40 to-emerald-900/40 backdrop-blur-xl border border-green-500/30 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <Signal className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-green-300 text-sm font-semibold">Live Now</p>
              <p className="text-3xl font-black text-white">
                {programs.filter((p) => p.isLive).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-linear-to-br from-blue-900/40 to-cyan-900/40 backdrop-blur-xl border border-blue-500/30 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Clock className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-blue-300 text-sm font-semibold">Scheduled</p>
              <p className="text-3xl font-black text-white">
                {programs.filter((p) => p.status === "scheduled").length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-linear-to-br from-pink-900/40 to-rose-900/40 backdrop-blur-xl border border-pink-500/30 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-pink-500/20 rounded-xl">
              <Users className="w-6 h-6 text-pink-400" />
            </div>
            <div>
              <p className="text-pink-300 text-sm font-semibold">
                Total Listeners
              </p>
              <p className="text-3xl font-black text-white">
                {programs.reduce((sum, p) => sum + p.totalListeners, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Programs List */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8 shadow-2xl">
          {filteredPrograms.length === 0 ? (
            <div className="text-center py-12">
              <Radio className="w-16 h-16 text-purple-400/50 mx-auto mb-4" />
              <p className="text-purple-300 text-lg">No programs found</p>
              <p className="text-purple-400/70">
                {searchQuery || filterCategory || filterStatus
                  ? "Try adjusting your filters"
                  : "Create your first program to get started"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredPrograms.map((program) => (
                <div
                  key={program._id}
                  className="p-6 bg-black/20 rounded-2xl border border-purple-500/20 hover:border-purple-500/50 transition-all duration-300 group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-xl font-bold text-white">
                          {program.title}
                        </h3>
                        {program.isLive && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-full animate-pulse">
                            <Signal className="w-3 h-3 text-green-400" />
                            <span className="text-green-400 text-xs font-semibold">
                              LIVE
                            </span>
                          </div>
                        )}
                        <div
                          className={`flex items-center gap-1 px-3 py-1 border rounded-full text-xs font-semibold ${getStatusColor(program.status)}`}
                        >
                          {getStatusIcon(program.status)}
                          {program.status.toUpperCase()}
                        </div>
                      </div>

                      <p className="text-purple-300 mb-4 line-clamp-2">
                        {program.description}
                      </p>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="flex items-center gap-2 text-purple-300">
                          <Users className="w-4 h-4 text-purple-400" />
                          <span className="text-sm">
                            Host: <span className="font-semibold">{program.host}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-purple-300">
                          <Calendar className="w-4 h-4 text-purple-400" />
                          <span className="text-sm">
                            {new Date(program.scheduleStartTime).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-purple-300">
                          <Clock className="w-4 h-4 text-purple-400" />
                          <span className="text-sm">
                            {new Date(program.scheduleStartTime).toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" }
                            )}{" "}
                            -{" "}
                            {new Date(program.scheduleEndTime).toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" }
                            )}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-purple-300">
                          <TrendingUp className="w-4 h-4 text-purple-400" />
                          <span className="text-sm">
                            {program.currentListeners} listeners
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-xs font-semibold">
                          {program.category}
                        </span>
                        {program.isRecurring && (
                          <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-300 text-xs font-semibold">
                            Recurring
                          </span>
                        )}
                        {program.tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-pink-500/20 border border-pink-500/30 rounded-full text-pink-300 text-xs"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() =>
                          toggleLiveStatus(program._id, program.isLive)
                        }
                        className={`p-3 ${program.isLive ? "bg-red-600/20 hover:bg-red-600/30 border-red-500/30" : "bg-green-600/20 hover:bg-green-600/30 border-green-500/30"} border rounded-xl transition-all duration-300 hover:scale-110`}
                        title={program.isLive ? "Stop Broadcast" : "Go Live"}
                      >
                        <Video
                          className={`w-5 h-5 ${program.isLive ? "text-red-400" : "text-green-400"}`}
                        />
                      </button>

                      <button
                        onClick={() => openEditModal(program)}
                        className="p-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-xl transition-all duration-300 hover:scale-110"
                        title="Edit Program"
                      >
                        <Edit2 className="w-5 h-5 text-blue-400" />
                      </button>

                      <button
                        onClick={() => handleDelete(program._id)}
                        className="p-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-xl transition-all duration-300 hover:scale-110"
                        title="Delete Program"
                      >
                        <Trash2 className="w-5 h-5 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-linear-to-br from-purple-900/95 to-pink-900/95 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-black text-white">
                Create New Program
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="p-2 hover:bg-purple-600/20 rounded-xl transition-all"
              >
                <X className="w-6 h-6 text-purple-300" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-6">
              <div>
                <label className="block text-purple-300 text-sm font-semibold mb-2">
                  Program Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleFormChange}
                  required
                  className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
                  placeholder="Enter program title"
                />
              </div>

              <div>
                <label className="block text-purple-300 text-sm font-semibold mb-2">
                  Description *
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  required
                  rows={4}
                  className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
                  placeholder="Describe your program"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-purple-300 text-sm font-semibold mb-2">
                    Host Name *
                  </label>
                  <input
                    type="text"
                    name="host"
                    value={formData.host}
                    onChange={handleFormChange}
                    required
                    className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
                    placeholder="Enter host name"
                  />
                </div>

                <div>
                  <label className="block text-purple-300 text-sm font-semibold mb-2">
                    Category *
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleFormChange}
                    required
                    className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-purple-300 text-sm font-semibold mb-2">
                    Start Time *
                  </label>
                  <input
                    type="datetime-local"
                    name="scheduleStartTime"
                    value={formData.scheduleStartTime}
                    onChange={handleFormChange}
                    required
                    className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  />
                </div>

                <div>
                  <label className="block text-purple-300 text-sm font-semibold mb-2">
                    End Time *
                  </label>
                  <input
                    type="datetime-local"
                    name="scheduleEndTime"
                    value={formData.scheduleEndTime}
                    onChange={handleFormChange}
                    required
                    className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-purple-300 text-sm font-semibold mb-2">
                  Streaming URL
                </label>
                <input
                  type="url"
                  name="streamingUrl"
                  value={formData.streamingUrl}
                  onChange={handleFormChange}
                  className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
                  placeholder="https://stream.example.com/live"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-purple-300 mb-3">
                  <input
                    type="checkbox"
                    name="isRecurring"
                    checked={formData.isRecurring}
                    onChange={handleFormChange}
                    className="w-4 h-4 rounded border-purple-500/30 bg-black/30"
                  />
                  <span className="font-semibold">Recurring Program</span>
                </label>

                {formData.isRecurring && (
                  <div className="mt-3">
                    <label className="block text-purple-300 text-sm font-semibold mb-2">
                      Repeat on:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleRecurringDay(day)}
                          className={`px-4 py-2 rounded-xl border transition-all ${
                            formData.recurringDays.includes(day)
                              ? "bg-purple-600/30 border-purple-500/50 text-white"
                              : "bg-black/30 border-purple-500/30 text-purple-300"
                          }`}
                        >
                          {day.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-purple-300 text-sm font-semibold mb-2">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  name="tags"
                  value={formData.tags}
                  onChange={handleFormChange}
                  className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
                  placeholder="music, entertainment, morning-show"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-6 py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-linear-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-lg"
                >
                  <Save className="w-5 h-5" />
                  Create Program
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedProgram && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-linear-to-br from-purple-900/95 to-pink-900/95 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-black text-white">Edit Program</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedProgram(null);
                  resetForm();
                }}
                className="p-2 hover:bg-purple-600/20 rounded-xl transition-all"
              >
                <X className="w-6 h-6 text-purple-300" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-6">
              <div>
                <label className="block text-purple-300 text-sm font-semibold mb-2">
                  Program Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleFormChange}
                  required
                  className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
                  placeholder="Enter program title"
                />
              </div>

              <div>
                <label className="block text-purple-300 text-sm font-semibold mb-2">
                  Description *
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  required
                  rows={4}
                  className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
                  placeholder="Describe your program"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-purple-300 text-sm font-semibold mb-2">
                    Host Name *
                  </label>
                  <input
                    type="text"
                    name="host"
                    value={formData.host}
                    onChange={handleFormChange}
                    required
                    className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
                    placeholder="Enter host name"
                  />
                </div>

                <div>
                  <label className="block text-purple-300 text-sm font-semibold mb-2">
                    Category *
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleFormChange}
                    required
                    className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-purple-300 text-sm font-semibold mb-2">
                    Start Time *
                  </label>
                  <input
                    type="datetime-local"
                    name="scheduleStartTime"
                    value={formData.scheduleStartTime}
                    onChange={handleFormChange}
                    required
                    className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  />
                </div>

                <div>
                  <label className="block text-purple-300 text-sm font-semibold mb-2">
                    End Time *
                  </label>
                  <input
                    type="datetime-local"
                    name="scheduleEndTime"
                    value={formData.scheduleEndTime}
                    onChange={handleFormChange}
                    required
                    className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-purple-300 text-sm font-semibold mb-2">
                  Streaming URL
                </label>
                <input
                  type="url"
                  name="streamingUrl"
                  value={formData.streamingUrl}
                  onChange={handleFormChange}
                  className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
                  placeholder="https://stream.example.com/live"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-purple-300 mb-3">
                  <input
                    type="checkbox"
                    name="isRecurring"
                    checked={formData.isRecurring}
                    onChange={handleFormChange}
                    className="w-4 h-4 rounded border-purple-500/30 bg-black/30"
                  />
                  <span className="font-semibold">Recurring Program</span>
                </label>

                {formData.isRecurring && (
                  <div className="mt-3">
                    <label className="block text-purple-300 text-sm font-semibold mb-2">
                      Repeat on:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleRecurringDay(day)}
                          className={`px-4 py-2 rounded-xl border transition-all ${
                            formData.recurringDays.includes(day)
                              ? "bg-purple-600/30 border-purple-500/50 text-white"
                              : "bg-black/30 border-purple-500/30 text-purple-300"
                          }`}
                        >
                          {day.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-purple-300 text-sm font-semibold mb-2">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  name="tags"
                  value={formData.tags}
                  onChange={handleFormChange}
                  className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
                  placeholder="music, entertainment, morning-show"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedProgram(null);
                    resetForm();
                  }}
                  className="flex-1 px-6 py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-linear-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-lg"
                >
                  <Save className="w-5 h-5" />
                  Update Program
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProgramsPage;