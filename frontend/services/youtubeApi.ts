// services/youtubeApi.ts
//
// API service for the YouTube Live monitoring + analytics backend.
// Matches the routes mounted at `${API_URL}/youtube`. Every page that
// touches YouTube streams should import from here instead of inlining fetch.
//
// Place at: services/youtubeApi.ts  (imported as "@/services/youtubeApi").
// Adjust the import alias if your "@/" points somewhere other than project root.

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ─── Types (match the backend response shapes) ────────────────────────────────

export interface EngagementStats {
  totalMessages: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  engagementScore: number;
  lastComputedAt: string | null;
}

export interface YoutubeStream {
  _id: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  title: string | null;
  channelTitle: string | null;
  thumbnail: string | null;
  views: number;
  likes: number;
  commentCount: number;
  currentViewers: number;
  liveStatus: "upcoming" | "live" | "none" | "ended" | "unknown";
  isLiveNow: boolean;
  youtubeLiveChatId: string | null;
  engagementStats: EngagementStats;
  lastSyncedAt: string | null;
  monitoringEnabled: boolean;
  linkedProgram?: { _id: string; title: string } | string | null;
  createdAt: string;
  updatedAt: string;
  // flattened convenience fields present on GET /youtube/:id
  viewers?: number;
}

export interface YoutubeAnalytics {
  totalMessages: number;
  positivePercentage: number;
  negativePercentage: number;
  neutralPercentage: number;
  sentimentCounts?: { positive: number; negative: number; neutral: number };
  messagesPerMinute: Array<{ minute: string; messages: number }>;
  mostActiveUsers: Array<{ user: string; messages: number }>;
  topKeywords: Array<{ word: string; count: number }>;
  engagementScore: number;
  engagementGrowth: number;
}

export interface YoutubeChat {
  authorName: string;
  message: string;
  publishedAt: string;
  sentiment: "positive" | "negative" | "neutral";
  sentimentConfidence?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToken(): string {
  return typeof window !== "undefined"
    ? localStorage.getItem("token") || ""
    : "";
}

function authHeaders(withJson = false): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getToken()}`,
  };
  if (withJson) headers["Content-Type"] = "application/json";
  return headers;
}

async function handle(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Request failed (${res.status})`);
  }
  return data;
}

// ─── Services ─────────────────────────────────────────────────────────────────

/** Start monitoring a YouTube URL. Backend extracts the video id + metadata. */
export async function createStream(youtubeUrl: string, linkedProgram?: string) {
  const res = await fetch(`${API_URL}/youtube`, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify({ youtubeUrl, linkedProgram }),
  });
  return handle(res) as Promise<{
    success: boolean;
    message: string;
    stream: YoutubeStream;
  }>;
}

/** List monitored streams (optionally filtered by live status). */
export async function getStreams(params?: {
  status?: string;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  const url = `${API_URL}/youtube${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(url, { headers: authHeaders() });
  return handle(res) as Promise<{
    success: boolean;
    streams: YoutubeStream[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }>;
}

/** One stream WITH analytics + recent chats (the unified response). */
export async function getSingleStream(id: string) {
  const res = await fetch(`${API_URL}/youtube/${id}`, {
    headers: authHeaders(),
  });
  return handle(res) as Promise<{
    success: boolean;
    stream: YoutubeStream;
    analytics: YoutubeAnalytics;
    recentChats: YoutubeChat[];
  }>;
}

/** Analytics only (lighter payload). */
export async function getAnalytics(id: string) {
  const res = await fetch(`${API_URL}/youtube/${id}/analytics`, {
    headers: authHeaders(),
  });
  const data = await handle(res);
  return data.analytics as YoutubeAnalytics;
}

/**
 * Live chats. The backend returns recentChats embedded in the single-stream
 * response, so this resolves them from there (no separate chats endpoint).
 */
export async function getLiveChats(id: string) {
  const data = await getSingleStream(id);
  return data.recentChats || [];
}

/** Force an immediate stats + chat sync (admin "Refresh"). */
export async function syncStream(id: string) {
  const res = await fetch(`${API_URL}/youtube/${id}/sync`, {
    method: "POST",
    headers: authHeaders(),
  });
  return handle(res) as Promise<{
    success: boolean;
    message: string;
    newMessages: number;
    stats: Partial<YoutubeStream>;
  }>;
}

/** Update a stream (toggle monitoring, link a program). */
export async function updateStream(
  id: string,
  payload: { monitoringEnabled?: boolean; linkedProgram?: string | null },
) {
  const res = await fetch(`${API_URL}/youtube/${id}`, {
    method: "PUT",
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  });
  return handle(res);
}

/** Stop monitoring + delete stored chat. */
export async function deleteStream(id: string) {
  const res = await fetch(`${API_URL}/youtube/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handle(res);
}
