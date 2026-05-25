"use client";

/**
 * AdminLiveStreamPage  (v2 — program-independent)
 * ─────────────────────────────────────────────────
 * The admin can go live instantly without selecting a Program.
 * Every broadcast is saved as a LiveSession in MongoDB and the
 * recording is uploaded to Cloudinary for later viewing.
 *
 * Tabs:
 *   Studio   — start / manage the current live session
 *   Replays  — browse past recordings and watch via Cloudinary URL
 *
 * Route: /dashboard/live-stream  (admin only)
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  StreamVideo,
  StreamCall,
  StreamVideoClient,
  LivestreamLayout,
  useCallStateHooks,
  CallingState,
} from "@stream-io/video-react-sdk";
import { toast } from "sonner";
import {
  Radio,
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MonitorOff,
  PhoneOff,
  Users,
  Clock,
  Signal,
  RefreshCw,
  MessageSquare,
  Send,
  Play,
  Film,
  Tv2,
  X,
  Tag,
  AlignLeft,
  Loader2,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// ─── Types ────────────────────────────────────────────────────────────────────
interface StreamCredentials {
  token: string;
  streamUserId: string;
  displayName: string;
  apiKey: string;
}

interface LiveSession {
  _id: string;
  title: string;
  description: string;
  hostDisplayName: string;
  streamCallId: string;
  status: "live" | "processing" | "available" | "ended";
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
}

interface Recording {
  _id: string;
  title: string;
  description: string;
  host: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  playbackUrl: string;
  thumbnailUrl?: string;
  tags: string[];
  coverImage?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const authHeader = () => ({
  Authorization: `Bearer ${
    typeof window !== "undefined" ? localStorage.getItem("token") : ""
  }`,
  "Content-Type": "application/json",
});

const fmtDuration = (seconds: number | null | undefined) => {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// ─── LiveControls (inner — only rendered when a call is active) ───────────────
const LiveControls = ({
  onEnd,
  isEnding,
}: {
  onEnd: () => void;
  isEnding: boolean;
}) => {
  const {
    useMicrophoneState,
    useCameraState,
    useScreenShareState,
    useParticipantCount,
    useCallCallingState,
  } = useCallStateHooks();

  const { microphone, isMute: isMicMuted } = useMicrophoneState();
  const { camera, isMute: isCamOff } = useCameraState();
  const { screenShare, status: ssStatus } = useScreenShareState();
  const participantCount = useParticipantCount();
  const callingState = useCallCallingState();

  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (callingState === CallingState.JOINED) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callingState]);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600)
      .toString()
      .padStart(2, "0");
    const m = Math.floor((s % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return h === "00" ? `${m}:${sec}` : `${h}:${m}:${sec}`;
  };

  const isSS = ssStatus === "enabled";

  return (
    <div className="flex flex-col h-full">
      {/* Status bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-red-600/20 border-b border-red-500/30">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="absolute inset-0 w-3 h-3 rounded-full bg-red-500 animate-ping opacity-75" />
          </div>
          <span className="text-red-300 font-bold text-sm tracking-widest">
            ON AIR
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2 text-purple-300">
            <Clock className="w-4 h-4" />
            <span className="font-mono font-bold">{fmt(elapsed)}</span>
          </div>
          <div className="flex items-center gap-2 text-purple-300">
            <Users className="w-4 h-4" />
            <span className="font-bold">{participantCount}</span>
          </div>
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 relative overflow-hidden bg-black">
        <LivestreamLayout
          enableFullScreen
          muted={false}
          showParticipantCount
          showDuration
        />
      </div>

      {/* Control bar */}
      <div className="flex items-center justify-center gap-4 px-6 py-4 bg-slate-900/80 border-t border-purple-500/30">
        <button
          onClick={() =>
            isMicMuted ? microphone.enable() : microphone.disable()
          }
          className={`p-4 rounded-full border transition-all duration-300 hover:scale-110 ${
            isMicMuted
              ? "bg-red-600/30 border-red-500/50 text-red-300"
              : "bg-purple-600/20 border-purple-500/30 text-purple-300 hover:bg-purple-600/30"
          }`}
          title={isMicMuted ? "Unmute" : "Mute"}
        >
          {isMicMuted ? (
            <MicOff className="w-6 h-6" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </button>

        <button
          onClick={() => (isCamOff ? camera.enable() : camera.disable())}
          className={`p-4 rounded-full border transition-all duration-300 hover:scale-110 ${
            isCamOff
              ? "bg-red-600/30 border-red-500/50 text-red-300"
              : "bg-purple-600/20 border-purple-500/30 text-purple-300 hover:bg-purple-600/30"
          }`}
          title={isCamOff ? "Camera on" : "Camera off"}
        >
          {isCamOff ? (
            <VideoOff className="w-6 h-6" />
          ) : (
            <Video className="w-6 h-6" />
          )}
        </button>

        <button
          onClick={() => (isSS ? screenShare.disable() : screenShare.enable())}
          className={`p-4 rounded-full border transition-all duration-300 hover:scale-110 ${
            isSS
              ? "bg-blue-600/30 border-blue-500/50 text-blue-300"
              : "bg-purple-600/20 border-purple-500/30 text-purple-300 hover:bg-purple-600/30"
          }`}
          title={isSS ? "Stop sharing" : "Share screen"}
        >
          {isSS ? (
            <MonitorOff className="w-6 h-6" />
          ) : (
            <MonitorUp className="w-6 h-6" />
          )}
        </button>

        <button
          onClick={onEnd}
          disabled={isEnding}
          className="p-4 rounded-full bg-red-600 hover:bg-red-500 disabled:opacity-50 border border-red-400 text-white transition-all duration-300 hover:scale-110 ml-4 flex items-center gap-2"
          title="End stream"
        >
          {isEnding ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <PhoneOff className="w-6 h-6" />
          )}
        </button>
      </div>
    </div>
  );
};

// ─── Recording card ───────────────────────────────────────────────────────────
const RecordingCard = ({
  rec,
  onWatch,
}: {
  rec: Recording;
  onWatch: (rec: Recording) => void;
}) => (
  <div className="bg-black/30 border border-purple-500/20 rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all duration-300 group">
    {/* Thumbnail */}
    <div
      className="relative aspect-video bg-slate-800 overflow-hidden cursor-pointer"
      onClick={() => onWatch(rec)}
    >
      {rec.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={rec.thumbnailUrl}
          alt={rec.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Film className="w-12 h-12 text-purple-500/40" />
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
        <div className="w-14 h-14 rounded-full bg-purple-600/80 flex items-center justify-center">
          <Play className="w-7 h-7 text-white ml-1" />
        </div>
      </div>
      {rec.durationSeconds && (
        <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 rounded text-white text-xs font-mono">
          {fmtDuration(rec.durationSeconds)}
        </span>
      )}
    </div>

    {/* Info */}
    <div className="p-4">
      <p className="text-white font-semibold truncate">{rec.title}</p>
      <p className="text-purple-400 text-xs mt-1">{rec.host}</p>
      <p className="text-purple-500 text-xs mt-1">{fmtDate(rec.startedAt)}</p>
      {rec.description && (
        <p className="text-purple-300/70 text-xs mt-2 line-clamp-2">
          {rec.description}
        </p>
      )}
    </div>
  </div>
);

// ─── Video modal ──────────────────────────────────────────────────────────────
const VideoModal = ({
  rec,
  onClose,
}: {
  rec: Recording;
  onClose: () => void;
}) => (
  <div
    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
    onClick={onClose}
  >
    <div
      className="w-full max-w-4xl bg-slate-900 rounded-3xl overflow-hidden border border-purple-500/30 shadow-2xl shadow-purple-500/20"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-purple-500/20">
        <div>
          <p className="text-white font-bold text-lg">{rec.title}</p>
          <p className="text-purple-400 text-sm">
            {rec.host} · {fmtDate(rec.startedAt)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-purple-500/20 rounded-xl text-purple-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="aspect-video bg-black">
        <video
          src={rec.playbackUrl}
          controls
          autoPlay
          className="w-full h-full"
          poster={rec.thumbnailUrl}
        />
      </div>

      {rec.description && (
        <div className="px-6 py-4 border-t border-purple-500/20">
          <p className="text-purple-300 text-sm">{rec.description}</p>
        </div>
      )}
    </div>
  </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────
const AdminLiveStreamPage = () => {
  // ── Tab state ───────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"studio" | "replays">("studio");

  // ── Go-live form ─────────────────────────────────────────────────────────────
  const [sessionTitle, setSessionTitle] = useState("Live Broadcast");
  const [sessionDescription, setSessionDescription] = useState("");
  const [sessionTags, setSessionTags] = useState("");

  // ── Stream state ─────────────────────────────────────────────────────────────
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [activeSession, setActiveSession] = useState<LiveSession | null>(null);
  const [streamCreds, setStreamCreds] = useState<StreamCredentials | null>(
    null,
  );
  const [videoClient, setVideoClient] = useState<StreamVideoClient | null>(
    null,
  );
  const [activeCall, setActiveCall] = useState<any | null>(null);

  // ── Chat sidebar ─────────────────────────────────────────────────────────────
  const [chatOpen, setChatOpen] = useState(true);
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { id: string; user: string; text: string; time: string }[]
  >([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Recordings tab ───────────────────────────────────────────────────────────
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [recordingsLoading, setRecordingsLoading] = useState(false);
  const [watchingRec, setWatchingRec] = useState<Recording | null>(null);

  // ── Fetch GetStream token ────────────────────────────────────────────────────
  const fetchStreamToken = useCallback(async () => {
    if (streamCreds) return streamCreds;
    const res = await fetch(`${API_URL}/api/stream/token`, {
      method: "POST",
      headers: authHeader(),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    setStreamCreds(data);
    return data as StreamCredentials;
  }, [streamCreds]);

  // ── Fetch recordings ─────────────────────────────────────────────────────────
  const fetchRecordings = useCallback(async () => {
    setRecordingsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/stream/sessions/recordings`, {
        headers: authHeader(),
      });
      const data = await res.json();
      if (data.success) setRecordings(data.recordings || []);
    } catch {
      toast.error("Failed to load recordings");
    } finally {
      setRecordingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "replays") fetchRecordings();
  }, [tab, fetchRecordings]);

  // ── Go Live ──────────────────────────────────────────────────────────────────
  const handleGoLive = async () => {
    if (!sessionTitle.trim()) {
      toast.error("Please enter a session title");
      return;
    }

    setIsStarting(true);
    try {
      // 1. Get stream token
      const creds = await fetchStreamToken();

      // 2. Create the session on the backend (no program required)
      const sessionRes = await fetch(`${API_URL}/api/stream/session/start`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({
          title: sessionTitle.trim(),
          description: sessionDescription.trim(),
          tags: sessionTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      const sessionData = await sessionRes.json();
      if (!sessionData.success) throw new Error(sessionData.message);

      // 3. Build StreamVideoClient
      const client = new StreamVideoClient({
        apiKey: creds.apiKey,
        user: { id: creds.streamUserId, name: creds.displayName },
        token: creds.token,
      });

      // 4. Join the call
      const call = client.call("livestream", sessionData.session.callId);
      await call.join({ create: false });
      await call.camera.enable();
      await call.microphone.enable();

      setVideoClient(client);
      setActiveCall(call);
      setActiveSession(sessionData.session);
      setIsLive(true);

      toast.success(`🔴 You are now live: ${sessionTitle}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to go live");
    } finally {
      setIsStarting(false);
    }
  };

  // ── End Stream ───────────────────────────────────────────────────────────────
  const handleEndStream = async () => {
    if (!activeSession || !activeCall) return;
    setIsEnding(true);
    try {
      await activeCall.leave();

      await fetch(`${API_URL}/api/stream/session/${activeSession._id}/end`, {
        method: "POST",
        headers: authHeader(),
      });

      await videoClient?.disconnectUser();

      setVideoClient(null);
      setActiveCall(null);
      setActiveSession(null);
      setIsLive(false);
      setStreamCreds(null);

      toast.success(
        "Stream ended. Recording is being processed and will appear in Replays shortly.",
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to end stream");
    } finally {
      setIsEnding(false);
    }
  };

  // ── Chat ─────────────────────────────────────────────────────────────────────
  const sendChatMessage = () => {
    if (!chatMessage.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        user: "You (Host)",
        text: chatMessage.trim(),
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
    setChatMessage("");
    setTimeout(
      () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      50,
    );
  };

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (activeCall) activeCall.leave().catch(() => {});
      if (videoClient) videoClient.disconnectUser().catch(() => {});
    };
  }, [activeCall, videoClient]);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 flex flex-col">
      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <header className="px-8 py-5 border-b border-purple-500/20 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400">
            Presenter Studio
          </h1>
          <p className="text-purple-400 text-sm mt-1">
            Go live instantly · Auto-recording · Replay on demand
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 bg-black/30 p-1.5 rounded-2xl border border-purple-500/20">
          <button
            onClick={() => setTab("studio")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
              tab === "studio"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
                : "text-purple-400 hover:text-white"
            }`}
          >
            <Tv2 className="w-4 h-4" />
            Studio
          </button>
          <button
            onClick={() => setTab("replays")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
              tab === "replays"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
                : "text-purple-400 hover:text-white"
            }`}
          >
            <Film className="w-4 h-4" />
            Replays
          </button>
        </div>
      </header>

      {/* ── Studio tab ───────────────────────────────────────────────────────── */}
      {tab === "studio" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel — go-live form (hidden when live) */}
          {!isLive && (
            <aside className="w-96 border-r border-purple-500/20 flex flex-col p-6 gap-5 overflow-y-auto shrink-0">
              <div>
                <h2 className="text-white font-black text-xl mb-1">
                  Start a Broadcast
                </h2>
                <p className="text-purple-400 text-sm">
                  Go live instantly — no program required.
                </p>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-purple-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Tv2 className="w-3.5 h-3.5" />
                  Session Title
                </label>
                <input
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  placeholder="e.g. Morning Drive Show"
                  className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-500/60 focus:outline-none focus:border-purple-500/60 transition-colors"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-purple-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <AlignLeft className="w-3.5 h-3.5" />
                  Description{" "}
                  <span className="text-purple-500 normal-case font-normal">
                    (optional)
                  </span>
                </label>
                <textarea
                  value={sessionDescription}
                  onChange={(e) => setSessionDescription(e.target.value)}
                  placeholder="What's this broadcast about?"
                  rows={3}
                  className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-500/60 focus:outline-none focus:border-purple-500/60 transition-colors resize-none"
                />
              </div>

              {/* Tags */}
              <div className="space-y-1.5">
                <label className="text-purple-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  Tags{" "}
                  <span className="text-purple-500 normal-case font-normal">
                    (comma-separated)
                  </span>
                </label>
                <input
                  value={sessionTags}
                  onChange={(e) => setSessionTags(e.target.value)}
                  placeholder="music, talk-show, live"
                  className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-500/60 focus:outline-none focus:border-purple-500/60 transition-colors"
                />
              </div>

              {/* Recording notice */}
              <div className="flex items-start gap-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                <Signal className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <p className="text-purple-300 text-xs leading-relaxed">
                  Your broadcast will be <strong>automatically recorded</strong>{" "}
                  and saved to Cloudinary. It will appear in the{" "}
                  <strong>Replays</strong> tab once processing is complete.
                </p>
              </div>

              {/* Go Live button */}
              <div className="mt-auto">
                <button
                  onClick={handleGoLive}
                  disabled={isStarting || !sessionTitle.trim()}
                  className="w-full py-4 bg-gradient-to-br from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl text-white font-black text-lg flex items-center justify-center gap-3 shadow-2xl shadow-red-500/30 transition-all duration-300 hover:scale-105"
                >
                  {isStarting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Going Live…
                    </>
                  ) : (
                    <>
                      <Radio className="w-6 h-6" />
                      Go Live
                    </>
                  )}
                </button>
              </div>
            </aside>
          )}

          {/* Main area */}
          <main className="flex-1 flex overflow-hidden">
            {isLive && videoClient && activeCall ? (
              <StreamVideo client={videoClient}>
                <StreamCall call={activeCall}>
                  <div className="flex flex-1 overflow-hidden">
                    {/* Video + controls */}
                    <div className="flex-1 flex flex-col">
                      <LiveControls
                        onEnd={handleEndStream}
                        isEnding={isEnding}
                      />
                    </div>

                    {/* Chat sidebar */}
                    {chatOpen && (
                      <aside className="w-80 border-l border-purple-500/20 flex flex-col bg-slate-900/60 shrink-0">
                        <div className="px-4 py-3 border-b border-purple-500/20 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-purple-300 font-bold">
                            <MessageSquare className="w-5 h-5" />
                            Live Chat
                          </div>
                          <button
                            onClick={() => setChatOpen(false)}
                            className="text-purple-400 hover:text-white transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                          {chatMessages.length === 0 && (
                            <p className="text-purple-500 text-sm text-center mt-8">
                              No messages yet. Start the conversation!
                            </p>
                          )}
                          {chatMessages.map((msg) => (
                            <div key={msg.id}>
                              <span className="text-purple-300 text-xs font-bold">
                                {msg.user}
                              </span>
                              <span className="text-purple-500 text-xs ml-2">
                                {msg.time}
                              </span>
                              <p className="text-white text-sm mt-0.5">
                                {msg.text}
                              </p>
                            </div>
                          ))}
                          <div ref={chatEndRef} />
                        </div>

                        <div className="p-3 border-t border-purple-500/20 flex gap-2">
                          <input
                            value={chatMessage}
                            onChange={(e) => setChatMessage(e.target.value)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && sendChatMessage()
                            }
                            placeholder="Send a message…"
                            className="flex-1 px-3 py-2 bg-black/30 border border-purple-500/30 rounded-xl text-white text-sm placeholder-purple-500 focus:outline-none focus:border-purple-500/60"
                          />
                          <button
                            onClick={sendChatMessage}
                            className="p-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-white transition-all"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </aside>
                    )}

                    {!chatOpen && (
                      <button
                        onClick={() => setChatOpen(true)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 hover:bg-purple-600/40 transition-all"
                      >
                        <MessageSquare className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </StreamCall>
              </StreamVideo>
            ) : (
              /* Placeholder when not live */
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center max-w-sm">
                  <div className="w-24 h-24 bg-purple-600/20 border border-purple-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Radio className="w-12 h-12 text-purple-400" />
                  </div>
                  <h2 className="text-2xl font-black text-white mb-3">
                    Ready to Broadcast?
                  </h2>
                  <p className="text-purple-400 text-sm">
                    Fill in the session details on the left, then click{" "}
                    <strong className="text-purple-300">Go Live</strong>.
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* ── Replays tab ──────────────────────────────────────────────────────── */}
      {tab === "replays" && (
        <div className="flex-1 overflow-y-auto p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-white font-black text-2xl">
                Past Recordings
              </h2>
              <p className="text-purple-400 text-sm mt-1">
                All sessions are recorded automatically and stored on
                Cloudinary.
              </p>
            </div>
            <button
              onClick={fetchRecordings}
              className="p-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 transition-all"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          {recordingsLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-purple-300">Loading recordings…</p>
              </div>
            </div>
          ) : recordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Film className="w-16 h-16 text-purple-500/30 mb-4" />
              <p className="text-white font-bold text-lg">No recordings yet</p>
              <p className="text-purple-400 text-sm mt-1 max-w-xs">
                Go live in the Studio tab. Once you end a session, the recording
                will appear here after processing.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {recordings.map((rec) => (
                <RecordingCard
                  key={rec._id}
                  rec={rec}
                  onWatch={setWatchingRec}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Video modal ───────────────────────────────────────────────────────── */}
      {watchingRec && (
        <VideoModal rec={watchingRec} onClose={() => setWatchingRec(null)} />
      )}
    </div>
  );
};

export default AdminLiveStreamPage;
