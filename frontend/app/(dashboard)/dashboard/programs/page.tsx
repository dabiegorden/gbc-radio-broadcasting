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
  Youtube,
  Facebook,
  Instagram,
  Music2,
  Link2,
  Tv2,
  Trash,
  Eye,
  EyeOff,
  ExternalLink,
  Play,
  Heart,
  Share2,
  MessageSquare,
  BarChart3,
  RefreshCcw,
  Activity,
  Zap,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ─── Types ────────────────────────────────────────────────────────────────────

interface SocialStats {
  likes: number | "1.9k";
  comments: number | "200k";
  shares: number | "59.9k";
  views: number | "50m";
  fetchedAt: string;
}

interface SocialStream {
  _id?: string;
  platform: "youtube" | "facebook" | "instagram" | "tiktok";
  url: string;
  embedUrl?: string | null;
  label?: string;
  isActive: boolean;
  stats?: SocialStats;
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
  isRecurring: boolean;
  recurringDays: string[];
  streamingUrl: string | null;
  socialStreams: SocialStream[];
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
  socialStreams: SocialStream[];
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

const SOCIAL_PLATFORMS: {
  id: SocialStream["platform"];
  label: string;
  color: string;
  bg: string;
  border: string;
  placeholder: string;
  accent: string;
}[] = [
  {
    id: "youtube",
    label: "YouTube",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    placeholder: "https://youtube.com/watch?v=... or https://youtu.be/...",
    accent: "#ef4444",
  },
  {
    id: "facebook",
    label: "Facebook",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    placeholder: "https://facebook.com/video/...",
    accent: "#3b82f6",
  },
  {
    id: "instagram",
    label: "Instagram",
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/30",
    placeholder: "https://instagram.com/p/... or /reel/...",
    accent: "#ec4899",
  },
  {
    id: "tiktok",
    label: "TikTok",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    placeholder: "https://tiktok.com/@user/video/...",
    accent: "#06b6d4",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseFormattedNum(
  val: number | string | null | undefined,
): number | null {
  if (val == null) return null;
  if (typeof val === "number") return val;

  // Parse formatted strings like "50m", "1.9k", "200k"
  const match = String(val).match(/^([\d.]+)([kmb])?$/i);
  if (!match) return null;

  const num = parseFloat(match[1]);
  const suffix = match[2]?.toLowerCase();

  switch (suffix) {
    case "k":
      return num * 1_000;
    case "m":
      return num * 1_000_000;
    case "b":
      return num * 1_000_000_000;
    default:
      return num;
  }
}

function fmtNum(n: number | string | null | undefined): string {
  const parsed = parseFormattedNum(n);
  if (parsed == null) return "—";
  if (parsed >= 1_000_000) return `${(parsed / 1_000_000).toFixed(1)}M`;
  if (parsed >= 1_000) return `${(parsed / 1_000).toFixed(1)}K`;
  return String(Math.round(parsed));
}

const PlatformIcon = ({
  platform,
  className,
}: {
  platform: string;
  className?: string;
}) => {
  switch (platform) {
    case "youtube":
      return <Youtube className={className} />;
    case "facebook":
      return <Facebook className={className} />;
    case "instagram":
      return <Instagram className={className} />;
    case "tiktok":
      return <Music2 className={className} />;
    default:
      return <Link2 className={className} />;
  }
};

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

const getPlatformMeta = (platform: string) =>
  SOCIAL_PLATFORMS.find((p) => p.id === platform) ?? SOCIAL_PLATFORMS[0];

// ─── Stats Panel ──────────────────────────────────────────────────────────────

const StatsPanel = ({
  stream,
  programId,
  onRefresh,
}: {
  stream: SocialStream;
  programId: string;
  onRefresh: () => void;
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const meta = getPlatformMeta(stream.platform);
  const stats = stream.stats;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/programs/${programId}/social-streams/${stream.platform}/refresh-stats`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        toast.success(`${meta.label} stats refreshed`);
        onRefresh();
      }
    } catch {
      toast.error("Failed to refresh stats");
    } finally {
      setRefreshing(false);
    }
  };

  const statItems = [
    {
      icon: Heart,
      label: "Likes",
      value: stats?.likes,
      color: "text-pink-400",
    },
    {
      icon: MessageSquare,
      label: "Comments",
      value: stats?.comments,
      color: "text-sky-400",
    },
    {
      icon: Share2,
      label: "Shares",
      value: stats?.shares,
      color: "text-emerald-400",
    },
    { icon: Eye, label: "Views", value: stats?.views, color: "text-amber-400" },
  ];

  return (
    <div className={`mt-3 p-4 rounded-xl border ${meta.bg} ${meta.border}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className={`w-4 h-4 ${meta.color}`} />
          <span
            className={`text-xs font-bold uppercase tracking-wider ${meta.color}`}
          >
            {meta.label} Live Stats
          </span>
        </div>
        <div className="flex items-center gap-2">
          {stats?.fetchedAt && (
            <span className="text-xs text-purple-600">
              {new Date(stats.fetchedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 rounded-lg bg-black/20 hover:bg-black/30 transition-all disabled:opacity-50"
            title="Refresh stats"
          >
            <RefreshCcw
              className={`w-3.5 h-3.5 text-purple-400 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {statItems.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="text-center p-2 bg-black/20 rounded-lg">
            <Icon className={`w-3.5 h-3.5 ${color} mx-auto mb-1`} />
            <p className="text-white font-bold text-sm">{fmtNum(value)}</p>
            <p className="text-purple-500 text-xs">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Video Player Modal ───────────────────────────────────────────────────────

const VideoPlayerModal = ({
  stream,
  programId,
  onClose,
  onStatsRefresh,
}: {
  stream: SocialStream;
  programId: string;
  onClose: () => void;
  onStatsRefresh: () => void;
}) => {
  const meta = getPlatformMeta(stream.platform);
  const canEmbed = !!stream.embedUrl;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${meta.bg} ${meta.border} border`}>
              <PlatformIcon
                platform={stream.platform}
                className={`w-5 h-5 ${meta.color}`}
              />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">
                {stream.label || `${meta.label} Stream`}
              </h3>
              <p className={`text-sm ${meta.color}`}>{meta.label} Live</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={stream.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 text-sm font-semibold transition-all"
            >
              <ExternalLink className="w-4 h-4" /> Open in {meta.label}
            </a>
            <button
              onClick={onClose}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl transition-all"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Video */}
        <div className="relative bg-black rounded-2xl overflow-hidden border border-purple-500/20 shadow-2xl shadow-purple-500/10">
          {canEmbed ? (
            <div className="relative" style={{ paddingTop: "56.25%" }}>
              <iframe
                src={stream.embedUrl!}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                frameBorder="0"
                title={stream.label || `${meta.label} stream`}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div
                className={`w-20 h-20 rounded-2xl ${meta.bg} ${meta.border} border flex items-center justify-center mb-6`}
              >
                <PlatformIcon
                  platform={stream.platform}
                  className={`w-10 h-10 ${meta.color}`}
                />
              </div>
              <h4 className="text-white font-bold text-xl mb-2">
                Can&apos;t embed this {meta.label} stream
              </h4>
              <p className="text-purple-300 text-sm mb-6 max-w-md">
                {stream.platform === "tiktok"
                  ? "TikTok Live streams can't be embedded directly. Open in TikTok to watch."
                  : stream.platform === "instagram"
                    ? "Instagram Live streams can't be embedded. Open in Instagram to watch."
                    : "This stream can't be embedded. Open it directly to watch."}
              </p>
              <a
                href={stream.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 px-6 py-3 ${meta.bg} ${meta.border} border rounded-xl ${meta.color} font-bold transition-all hover:opacity-80`}
              >
                <ExternalLink className="w-5 h-5" /> Watch on {meta.label}
              </a>
            </div>
          )}
        </div>

        {/* Stats below video */}
        <StatsPanel
          stream={stream}
          programId={programId}
          onRefresh={onStatsRefresh}
        />
      </div>
    </div>
  );
};

// ─── Social Streams Editor ────────────────────────────────────────────────────

const SocialStreamsEditor = ({
  streams,
  onChange,
}: {
  streams: SocialStream[];
  onChange: (streams: SocialStream[]) => void;
}) => {
  const [activeTab, setActiveTab] =
    useState<SocialStream["platform"]>("youtube");
  const currentStream = streams.find((s) => s.platform === activeTab);
  const meta = getPlatformMeta(activeTab);

  const updateStream = (field: keyof SocialStream, value: string | boolean) => {
    const existing = streams.find((s) => s.platform === activeTab);
    if (existing) {
      onChange(
        streams.map((s) =>
          s.platform === activeTab ? { ...s, [field]: value } : s,
        ),
      );
    } else {
      onChange([
        ...streams,
        {
          platform: activeTab,
          url: "",
          label: "",
          isActive: true,
          [field]: value,
        },
      ]);
    }
  };

  const removeStream = (platform: string) =>
    onChange(streams.filter((s) => s.platform !== platform));

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {SOCIAL_PLATFORMS.map((p) => {
          const has = streams.some((s) => s.platform === p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveTab(p.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                activeTab === p.id
                  ? `${p.bg} ${p.border} ${p.color}`
                  : "bg-purple-900/20 border-purple-700/30 text-purple-400 hover:border-purple-600/50"
              }`}
            >
              <PlatformIcon platform={p.id} className="w-4 h-4" />
              {p.label}
              {has && (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${p.id === "youtube" ? "bg-red-400" : p.id === "facebook" ? "bg-blue-400" : p.id === "instagram" ? "bg-pink-400" : "bg-cyan-400"}`}
                />
              )}
            </button>
          );
        })}
      </div>

      <div
        className={`p-5 rounded-2xl border ${meta.bg} ${meta.border} space-y-4`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlatformIcon
              platform={activeTab}
              className={`w-5 h-5 ${meta.color}`}
            />
            <span className={`font-bold ${meta.color}`}>
              {meta.label} Stream
            </span>
          </div>
          {currentStream && (
            <button
              type="button"
              onClick={() => removeStream(activeTab)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold transition-all"
            >
              <Trash className="w-3 h-3" /> Remove
            </button>
          )}
        </div>

        <div>
          <label className="block text-purple-300 text-xs font-semibold uppercase tracking-wider mb-2">
            Stream URL
          </label>
          <input
            type="url"
            value={currentStream?.url ?? ""}
            onChange={(e) => updateStream("url", e.target.value)}
            className="w-full px-4 py-3 bg-black/40 border border-purple-700/40 rounded-xl text-white placeholder-purple-600/50 focus:outline-none focus:border-purple-500/60 transition-all text-sm"
            placeholder={meta.placeholder}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-purple-300 text-xs font-semibold uppercase tracking-wider mb-2">
              Label (optional)
            </label>
            <input
              type="text"
              value={currentStream?.label ?? ""}
              onChange={(e) => updateStream("label", e.target.value)}
              className="w-full px-4 py-3 bg-black/40 border border-purple-700/40 rounded-xl text-white placeholder-purple-600/50 focus:outline-none focus:border-purple-500/60 transition-all text-sm"
              placeholder={`e.g. Main ${meta.label} Live`}
            />
          </div>
          <div>
            <label className="block text-purple-300 text-xs font-semibold uppercase tracking-wider mb-2">
              Visibility
            </label>
            <button
              type="button"
              onClick={() =>
                updateStream("isActive", !(currentStream?.isActive ?? true))
              }
              className={`w-full px-4 py-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-all ${
                (currentStream?.isActive ?? true)
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-purple-900/20 border-purple-700/30 text-purple-500"
              }`}
            >
              {(currentStream?.isActive ?? true) ? (
                <>
                  <Eye className="w-4 h-4" /> Active
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4" /> Hidden
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {streams.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {streams.map((s) => {
            const m = getPlatformMeta(s.platform);
            return (
              <div
                key={s.platform}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${m.bg} ${m.border} ${m.color}`}
              >
                <PlatformIcon platform={s.platform} className="w-3.5 h-3.5" />
                {m.label}
                {!s.isActive && <EyeOff className="w-3 h-3 opacity-60" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
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
    "basic" | "schedule" | "streaming" | "social"
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
    { id: "social", label: "Social" },
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

        {activeSection === "social" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Tv2 className="w-5 h-5 text-pink-400" />
              <span className="text-pink-300 font-bold text-sm">
                Social Platform Streams
              </span>
            </div>
            <p className="text-purple-500 text-xs">
              Add YouTube, Facebook, Instagram, or TikTok stream links. Viewers
              can watch them embedded in the app or open in a new tab.
            </p>
            <SocialStreamsEditor
              streams={formData.socialStreams}
              onChange={(s) =>
                setFormData((prev) => ({ ...prev, socialStreams: s }))
              }
            />
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

// ─── Stream Bar ───────────────────────────────────────────────────────────────

const StreamPreviewBar = ({
  program,
  onPlay,
}: {
  program: Program;
  onPlay: (stream: SocialStream) => void;
}) => {
  const activeStreams = program.socialStreams?.filter((s) => s.isActive) ?? [];
  if (activeStreams.length === 0 && !program.streamingUrl) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {activeStreams.map((stream) => {
        const m = getPlatformMeta(stream.platform);
        const hasStats =
          stream.stats &&
          (stream.stats.likes != null || stream.stats.views != null);
        return (
          <button
            key={stream.platform}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPlay(stream);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all hover:opacity-80 ${m.bg} ${m.border} ${m.color}`}
          >
            <Play className="w-3 h-3" />
            {stream.label || m.label}
            {hasStats && (
              <span className="flex items-center gap-0.5 ml-1 opacity-75">
                <Activity className="w-2.5 h-2.5" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

// ─── Inline Social Stats Row (on program card) ────────────────────────────────

const SocialStatsRow = ({
  program,
  onRefresh,
}: {
  program: Program;
  onRefresh: () => void;
}) => {
  const activeStreams =
    program.socialStreams?.filter((s) => s.isActive && s.stats) ?? [];
  if (activeStreams.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-purple-800/30">
      <div className="flex items-center gap-1.5 mb-2">
        <Zap className="w-3 h-3 text-amber-400" />
        <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">
          Live Engagement
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {activeStreams.map((stream) => {
          const m = getPlatformMeta(stream.platform);
          const s = stream.stats!;
          const total = [s.likes, s.views, s.comments, s.shares].filter(
            (v) => v != null,
          );
          if (total.length === 0) return null;
          return (
            <div
              key={stream.platform}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${m.bg} ${m.border}`}
            >
              <PlatformIcon
                platform={stream.platform}
                className={`w-3 h-3 ${m.color}`}
              />
              <div className="flex items-center gap-2 text-xs">
                {s.views != null && (
                  <span className="flex items-center gap-1 text-amber-400">
                    <Eye className="w-3 h-3" />
                    {fmtNum(s.views)}
                  </span>
                )}
                {s.likes != null && (
                  <span className="flex items-center gap-1 text-pink-400">
                    <Heart className="w-3 h-3" />
                    {fmtNum(s.likes)}
                  </span>
                )}
                {s.comments != null && (
                  <span className="flex items-center gap-1 text-sky-400">
                    <MessageSquare className="w-3 h-3" />
                    {fmtNum(s.comments)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
  const [activeStream, setActiveStream] = useState<{
    stream: SocialStream;
    programId: string;
  } | null>(null);

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
    socialStreams: [],
    tags: "",
  });

  const [formData, setFormData] = useState<ProgramFormData>(emptyForm());

  const fetchPrograms = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/programs?withStats=true`, {
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
      socialStreams: program.socialStreams || [],
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

      {/* Video Player Modal */}
      {activeStream && (
        <VideoPlayerModal
          stream={activeStream.stream}
          programId={activeStream.programId}
          onClose={() => setActiveStream(null)}
          onStatsRefresh={fetchPrograms}
        />
      )}

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

                    {/* Stream play buttons */}
                    <StreamPreviewBar
                      program={program}
                      onPlay={(s) =>
                        setActiveStream({ stream: s, programId: program._id })
                      }
                    />

                    {/* Inline stats row */}
                    <SocialStatsRow
                      program={program}
                      onRefresh={fetchPrograms}
                    />
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
          <div className="bg-linear-to-br from-slate-950 via-purple-950/80 to-slate-900 border border-purple-700/40 rounded-3xl p-7 w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl shadow-purple-500/10">
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
