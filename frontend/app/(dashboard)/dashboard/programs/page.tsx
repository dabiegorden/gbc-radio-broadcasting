"use client";

import { useEffect, useState, useCallback } from "react";
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

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getStatusColor = (status: string) => {
  switch (status) {
    case "live":
      return "bg-amber-500/20 border-amber-500/40 text-amber-300";
    case "scheduled":
      return "bg-sky-500/20 border-sky-500/40 text-sky-300";
    case "completed":
      return "bg-emerald-500/20 border-emerald-500/40 text-emerald-300";
    case "cancelled":
      return "bg-red-500/20 border-red-500/40 text-red-300";
    default:
      return "bg-zinc-500/20 border-zinc-500/40 text-zinc-300";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "live":
      return <Signal className="w-3.5 h-3.5" />;
    case "scheduled":
      return <Clock className="w-3.5 h-3.5" />;
    case "completed":
      return <CheckCircle2 className="w-3.5 h-3.5" />;
    case "cancelled":
      return <XCircle className="w-3.5 h-3.5" />;
    default:
      return <AlertCircle className="w-3.5 h-3.5" />;
  }
};

// ─── Program Form ─────────────────────────────────────────────────────────────

const ProgramForm = ({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  submitLabel,
  isEdit = false,
}: {
  formData: ProgramFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProgramFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  submitLabel: string;
  isEdit?: boolean;
}) => {
  const [activeSection, setActiveSection] = useState<
    "basic" | "schedule" | "streaming"
  >("basic");

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setFormData((prev) => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const toggleDay = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      recurringDays: prev.recurringDays.includes(day)
        ? prev.recurringDays.filter((d) => d !== day)
        : [...prev.recurringDays, day],
    }));
  };

  const sections = [
    { id: "basic", label: "Basic Info" },
    { id: "schedule", label: "Schedule" },
    { id: "streaming", label: "Broadcast" },
  ] as const;

  const inputCls =
    "w-full px-4 py-3 bg-black/30 border border-purple-700/40 rounded-xl text-white placeholder-purple-600/50 focus:outline-none focus:border-purple-500/60 focus:bg-black/40 transition-all text-sm";

  return (
    <form onSubmit={onSubmit} className="flex flex-col h-full">
      <div className="flex gap-1 mb-6 p-1 bg-purple-900/30 rounded-2xl border border-purple-800/40">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveSection(s.id)}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              activeSection === s.id
                ? "bg-purple-600/30 border border-purple-500/40 text-purple-200"
                : "text-purple-500 hover:text-purple-300"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 pr-1">
        {activeSection === "basic" && (
          <>
            <div>
              <label className="block text-purple-300 text-xs font-semibold uppercase tracking-wider mb-2">
                Program Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                placeholder="Enter program title"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-purple-300 text-xs font-semibold uppercase tracking-wider mb-2">
                Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                rows={4}
                placeholder="Describe your program"
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-purple-300 text-xs font-semibold uppercase tracking-wider mb-2">
                  Host Name *
                </label>
                <input
                  type="text"
                  name="host"
                  value={formData.host}
                  onChange={handleChange}
                  required
                  placeholder="Host name"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-purple-300 text-xs font-semibold uppercase tracking-wider mb-2">
                  Category *
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className={inputCls}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} style={{ background: "#1a0a2e" }}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-purple-300 text-xs font-semibold uppercase tracking-wider mb-2">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                name="tags"
                value={formData.tags}
                onChange={handleChange}
                placeholder="music, morning-show, news"
                className={inputCls}
              />
            </div>
          </>
        )}

        {activeSection === "schedule" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-purple-300 text-xs font-semibold uppercase tracking-wider mb-2">
                  Start Time *
                </label>
                <input
                  type="datetime-local"
                  name="scheduleStartTime"
                  value={formData.scheduleStartTime}
                  onChange={handleChange}
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-purple-300 text-xs font-semibold uppercase tracking-wider mb-2">
                  End Time *
                </label>
                <input
                  type="datetime-local"
                  name="scheduleEndTime"
                  value={formData.scheduleEndTime}
                  onChange={handleChange}
                  required
                  className={inputCls}
                />
              </div>
            </div>

            <div className="p-4 bg-purple-900/20 rounded-2xl border border-purple-800/40">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  className={`relative w-11 h-6 rounded-full transition-colors ${formData.isRecurring ? "bg-purple-600" : "bg-purple-900/60"}`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${formData.isRecurring ? "translate-x-6" : "translate-x-1"}`}
                  />
                  <input
                    type="checkbox"
                    name="isRecurring"
                    checked={formData.isRecurring}
                    onChange={handleChange}
                    className="sr-only"
                  />
                </div>
                <span className="text-white font-semibold text-sm">
                  Recurring Program
                </span>
              </label>

              {formData.isRecurring && (
                <div className="mt-4">
                  <p className="text-purple-400 text-xs font-semibold uppercase tracking-wider mb-3">
                    Repeat on:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          formData.recurringDays.includes(day)
                            ? "bg-purple-600/30 border border-purple-500/50 text-purple-200"
                            : "bg-purple-900/20 border border-purple-800/40 text-purple-500 hover:border-purple-600/40"
                        }`}
                      >
                        {day.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeSection === "streaming" && (
          <div className="space-y-4">
            <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Radio className="w-5 h-5 text-purple-400" />
                <span className="text-purple-300 font-bold text-sm">
                  Primary Broadcast URL
                </span>
              </div>
              <p className="text-purple-500 text-xs mb-3">
                Your main radio/HLS/RTMP live stream. This is the audio stream
                played directly in the app.
              </p>
              <input
                type="url"
                name="streamingUrl"
                value={formData.streamingUrl}
                onChange={handleChange}
                placeholder="https://stream.example.com/live  or  http://stream.zeno.fm/..."
                className={inputCls}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-6 mt-4 border-t border-purple-800/40">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-5 py-3 bg-purple-900/20 hover:bg-purple-900/30 border border-purple-700/40 rounded-xl text-purple-300 font-semibold text-sm transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 px-5 py-3 bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/20"
        >
          <Save className="w-4 h-4" /> {submitLabel}
        </button>
      </div>
    </form>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

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

  const emptyForm = (): ProgramFormData => ({
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

  const [formData, setFormData] = useState<ProgramFormData>(emptyForm());

  const fetchPrograms = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/programs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPrograms(data.programs || []);
        setFilteredPrograms(data.programs || []);
      }
    } catch {
      toast.error("Failed to fetch programs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  useEffect(() => {
    let result = [...programs];
    if (searchQuery) {
      result = result.filter((p) =>
        [p.title, p.description, p.host, ...p.tags].some((v) =>
          v.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
      );
    }
    if (filterCategory)
      result = result.filter((p) => p.category === filterCategory);
    if (filterStatus) result = result.filter((p) => p.status === filterStatus);
    result.sort((a, b) => {
      let av: any = a[sortBy as keyof Program];
      let bv: any = b[sortBy as keyof Program];
      if (sortBy.includes("Time") || sortBy.includes("At")) {
        av = new Date(av).getTime();
        bv = new Date(bv).getTime();
      }
      return sortOrder === "asc" ? (av > bv ? 1 : -1) : av < bv ? 1 : -1;
    });
    setFilteredPrograms(result);
  }, [programs, searchQuery, filterCategory, filterStatus, sortBy, sortOrder]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/programs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          tags: formData.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      if (res.ok) {
        toast.success("Program created");
        setShowCreateModal(false);
        setFormData(emptyForm());
        fetchPrograms();
      } else {
        const err = await res.json();
        toast.error(err.message || "Failed to create");
      }
    } catch {
      toast.error("Failed to create program");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProgram) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/programs/${selectedProgram._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          tags: formData.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      if (res.ok) {
        toast.success("Program updated");
        setShowEditModal(false);
        setSelectedProgram(null);
        setFormData(emptyForm());
        fetchPrograms();
      } else {
        const err = await res.json();
        toast.error(err.message || "Failed to update");
      }
    } catch {
      toast.error("Failed to update program");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this program?")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/programs/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Deleted");
        fetchPrograms();
      } else {
        const err = await res.json();
        toast.error(err.message);
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  const toggleLiveStatus = async (id: string, current: boolean) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/programs/${id}/live`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isLive: !current }),
      });
      if (res.ok) {
        toast.success(!current ? "Program is LIVE" : "Program offline");
        fetchPrograms();
      } else {
        const err = await res.json();
        toast.error(err.message);
      }
    } catch {
      toast.error("Failed to update live status");
    }
  };

  const openEdit = (program: Program) => {
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-purple-300 text-lg font-semibold">
            Loading programs...
          </p>
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: "Total Programs",
      value: programs.length,
      icon: Radio,
      colorClass: "from-purple-900/40 to-purple-800/20 border-purple-500/20",
      iconColor: "text-purple-400 bg-purple-500/20",
      textColor: "text-purple-300",
    },
    {
      label: "Live Now",
      value: programs.filter((p) => p.isLive).length,
      icon: Signal,
      colorClass: "from-green-900/40 to-green-800/20 border-green-500/20",
      iconColor: "text-green-400 bg-green-500/20",
      textColor: "text-green-300",
    },
    {
      label: "Scheduled",
      value: programs.filter((p) => p.status === "scheduled").length,
      icon: Clock,
      colorClass: "from-sky-900/40 to-sky-800/20 border-sky-500/20",
      iconColor: "text-sky-400 bg-sky-500/20",
      textColor: "text-sky-300",
    },
    {
      label: "Total Listeners",
      value: programs.reduce((s, p) => s + p.totalListeners, 0),
      icon: Users,
      colorClass: "from-pink-900/40 to-pink-800/20 border-pink-500/20",
      iconColor: "text-pink-400 bg-pink-500/20",
      textColor: "text-pink-300",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0d0918; }
        ::-webkit-scrollbar-thumb { background: #4c1d95; border-radius: 2px; }
        input[type="datetime-local"]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
        select option { background: #1a0a2e; }
      `}</style>

      {/* Header */}
      <div className="border-b border-purple-800/40 bg-purple-950/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Radio className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1
                className="text-xl font-black text-white tracking-tight"
                style={{ fontFamily: "Syne, sans-serif" }}
              >
                Program Management
              </h1>
              <p className="text-purple-400 text-xs">
                {programs.length} programs total
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setFormData(emptyForm());
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-purple-500/20 hover:scale-105"
          >
            <Plus className="w-4 h-4" /> New Program
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className={`rounded-2xl border bg-gradient-to-br p-5 ${s.colorClass} backdrop-blur-xl`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.iconColor}`}
              >
                <s.icon className="w-5 h-5" />
              </div>
              <p
                className="text-3xl font-black text-white"
                style={{ fontFamily: "Syne, sans-serif" }}
              >
                {s.value}
              </p>
              <p className={`text-xs font-semibold mt-0.5 ${s.textColor}`}>
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* Search + Filters */}
        <div className="bg-purple-900/20 backdrop-blur-xl border border-purple-800/40 rounded-2xl p-5 space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500" />
              <input
                type="text"
                placeholder="Search by title, host, description, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-black/30 border border-purple-800/40 rounded-xl text-white placeholder-purple-600/50 focus:outline-none focus:border-purple-600/60 text-sm transition-all"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                showFilters
                  ? "bg-purple-600/20 border-purple-500/40 text-purple-200"
                  : "bg-black/20 border-purple-800/40 text-purple-400 hover:border-purple-700/60"
              }`}
            >
              <Filter className="w-4 h-4" /> Filters
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`}
              />
            </button>
            <button
              onClick={fetchPrograms}
              className="flex items-center gap-2 px-4 py-3 bg-black/20 border border-purple-800/40 rounded-xl text-purple-400 hover:border-purple-700/60 text-sm font-semibold transition-all"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-purple-800/30">
              {[
                {
                  label: "Category",
                  value: filterCategory,
                  set: setFilterCategory,
                  opts: ["", ...CATEGORIES],
                },
                {
                  label: "Status",
                  value: filterStatus,
                  set: setFilterStatus,
                  opts: ["", ...STATUS_OPTIONS],
                },
              ].map((f) => (
                <div key={f.label}>
                  <label className="block text-purple-500 text-xs font-semibold uppercase tracking-wider mb-2">
                    {f.label}
                  </label>
                  <select
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                    className="w-full px-4 py-2.5 bg-black/30 border border-purple-800/40 rounded-xl text-white text-sm focus:outline-none focus:border-purple-600/60"
                  >
                    <option value="">All {f.label}s</option>
                    {f.opts.slice(1).map((o) => (
                      <option key={o} value={o}>
                        {o.charAt(0).toUpperCase() + o.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <div>
                <label className="block text-purple-500 text-xs font-semibold uppercase tracking-wider mb-2">
                  Sort By
                </label>
                <div className="flex gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="flex-1 px-4 py-2.5 bg-black/30 border border-purple-800/40 rounded-xl text-white text-sm focus:outline-none focus:border-purple-600/60"
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
                    className="px-4 py-2.5 bg-black/30 border border-purple-800/40 rounded-xl text-purple-400 hover:border-purple-700/60 transition-all text-sm font-bold"
                  >
                    {sortOrder === "asc" ? "↑" : "↓"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Programs List */}
        <div className="space-y-3">
          {filteredPrograms.length === 0 ? (
            <div className="text-center py-20 bg-purple-900/10 border border-purple-800/30 rounded-2xl">
              <Radio className="w-12 h-12 text-purple-700 mx-auto mb-3" />
              <p className="text-purple-300 font-semibold">No programs found</p>
              <p className="text-purple-600 text-sm mt-1">
                {searchQuery || filterCategory || filterStatus
                  ? "Try adjusting your filters"
                  : "Create your first program to get started"}
              </p>
            </div>
          ) : (
            filteredPrograms.map((program) => (
              <div
                key={program._id}
                className="group p-5 bg-gradient-to-br from-purple-900/20 to-pink-900/10 backdrop-blur-xl border border-purple-800/30 hover:border-purple-600/40 rounded-2xl transition-all duration-200"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                      <h3
                        className="text-base font-black text-white truncate"
                        style={{ fontFamily: "Syne, sans-serif" }}
                      >
                        {program.title}
                      </h3>
                      {program.isLive && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 border border-green-500/40 rounded-full">
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                          <span className="text-green-300 text-xs font-bold">
                            ON AIR
                          </span>
                        </span>
                      )}
                      <span
                        className={`flex items-center gap-1 px-2.5 py-0.5 border rounded-full text-xs font-semibold ${getStatusColor(program.status)}`}
                      >
                        {getStatusIcon(program.status)}
                        {program.status.toUpperCase()}
                      </span>
                    </div>

                    <p className="text-purple-400 text-sm mb-3 line-clamp-1">
                      {program.description}
                    </p>

                    {/* Meta */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-purple-500 mb-3">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {program.host}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(
                          program.scheduleStartTime,
                        ).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(program.scheduleStartTime).toLocaleTimeString(
                          [],
                          { hour: "2-digit", minute: "2-digit" },
                        )}{" "}
                        –{" "}
                        {new Date(program.scheduleEndTime).toLocaleTimeString(
                          [],
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {program.currentListeners} live
                      </span>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      <span className="px-2.5 py-1 bg-purple-900/40 border border-purple-700/40 rounded-lg text-purple-400 text-xs font-medium">
                        {program.category}
                      </span>
                      {program.isRecurring && (
                        <span className="px-2.5 py-1 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400 text-xs font-medium">
                          Recurring
                        </span>
                      )}
                      {program.tags.slice(0, 2).map((tag, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 bg-purple-900/20 border border-purple-800/30 rounded-lg text-purple-600 text-xs"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() =>
                        toggleLiveStatus(program._id, program.isLive)
                      }
                      className={`p-2.5 rounded-xl border transition-all duration-200 ${
                        program.isLive
                          ? "bg-red-500/10 border-red-500/30 hover:bg-red-500/20"
                          : "bg-green-500/10 border-green-500/30 hover:bg-green-500/20"
                      }`}
                      title={program.isLive ? "End broadcast" : "Go live"}
                    >
                      <Video
                        className={`w-4 h-4 ${program.isLive ? "text-red-400" : "text-green-400"}`}
                      />
                    </button>
                    <button
                      onClick={() => openEdit(program)}
                      className="p-2.5 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-700/40 hover:border-purple-600/60 rounded-xl transition-all"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4 text-purple-400" />
                    </button>
                    <button
                      onClick={() => handleDelete(program._id)}
                      className="p-2.5 bg-red-500/5 hover:bg-red-500/15 border border-red-500/20 hover:border-red-500/40 rounded-xl transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-950 via-purple-950/80 to-slate-900 border border-purple-700/40 rounded-3xl p-7 w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl shadow-purple-500/10">
            <div className="flex items-center justify-between mb-6">
              <h2
                className="text-xl font-black text-white"
                style={{ fontFamily: "Syne, sans-serif" }}
              >
                New Program
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData(emptyForm());
                }}
                className="p-2 hover:bg-purple-900/40 rounded-xl transition-all"
              >
                <X className="w-5 h-5 text-purple-400" />
              </button>
            </div>
            <ProgramForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleCreate}
              onCancel={() => {
                setShowCreateModal(false);
                setFormData(emptyForm());
              }}
              submitLabel="Create Program"
            />
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedProgram && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-950 via-purple-950/80 to-slate-900 border border-purple-700/40 rounded-3xl p-7 w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl shadow-purple-500/10">
            <div className="flex items-center justify-between mb-6">
              <h2
                className="text-xl font-black text-white"
                style={{ fontFamily: "Syne, sans-serif" }}
              >
                Edit Program
              </h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedProgram(null);
                  setFormData(emptyForm());
                }}
                className="p-2 hover:bg-purple-900/40 rounded-xl transition-all"
              >
                <X className="w-5 h-5 text-purple-400" />
              </button>
            </div>
            <ProgramForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleUpdate}
              onCancel={() => {
                setShowEditModal(false);
                setSelectedProgram(null);
                setFormData(emptyForm());
              }}
              submitLabel="Save Changes"
              isEdit
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProgramsPage;
