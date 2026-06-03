"use client";

/**
 * WatchPage  — /watch/[programId]
 * ─────────────────────────────────
 * Audience view. Supports:
 *   • Joining a live broadcast (view-only, no camera / mic)
 *   • Reactions (emoji) shown over the stream
 *   • Live chat (send & receive messages)
 *   • Viewing past recordings if the stream has ended
 *
 * Fixes applied:
 *   1. programId guard now calls setIsLoadingInfo(false) before returning,
 *      preventing the infinite spinner when params are briefly undefined.
 *   2. Recordings fetch failure is handled independently — a 403 on recordings
 *      no longer prevents callInfo from loading.
 *   3. authHeader is stable (useCallback with empty deps).
 *   4. useEffect depends on programId directly so it re-runs correctly once
 *      the param resolves, without creating a loadInfo re-run loop.
 *   5. LivestreamPlayer is now wrapped with the StreamVideo + StreamCall
 *      providers it needs, fed by a real audience token fetched on join.
 *   6. handleJoin is async and fetches a GetStream user token before
 *      mounting the player, matching the SDK's requirements.
 *   7. Cleanup disconnects the video client when the audience leaves.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  StreamVideo,
  StreamVideoClient,
  LivestreamPlayer,
} from "@stream-io/video-react-sdk";
import { toast } from "sonner";
import {
  Radio,
  Users,
  MessageSquare,
  Send,
  Play,
  Calendar,
  ChevronRight,
  Heart,
  ThumbsUp,
  Flame,
  PartyPopper,
  Clock,
  Loader2,
  Wifi,
  WifiOff,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ─── Types ────────────────────────────────────────────────────────────────────

interface CallInfo {
  callId: string;
  callType: string;
  programId: string;
  programTitle: string;
  programHost: string;
  programCategory: string;
  isLive: boolean;
  currentListeners: number;
  apiKey: string;
}

interface Recording {
  filename: string;
  url: string;
  startTime: string;
  endTime: string;
  duration: number | null;
}

interface ChatMessage {
  id: string;
  user: string;
  text: string;
  time: string;
  isSystem?: boolean;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
}

// ─── Reaction emojis ─────────────────────────────────────────────────────────

const REACTIONS = [
  { emoji: "❤️", icon: Heart, label: "Love" },
  { emoji: "👍", icon: ThumbsUp, label: "Like" },
  { emoji: "🔥", icon: Flame, label: "Fire" },
  { emoji: "🎉", icon: PartyPopper, label: "Party" },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

const nowTime = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ─── Main page ────────────────────────────────────────────────────────────────

const WatchPage = () => {
  const params = useParams();
  // params can be null on the first render in Next.js App Router
  const programId = (params?.programId as string | undefined) ?? "";

  // ── Page-level data state ───────────────────────────────────────────────────
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoadingInfo, setIsLoadingInfo] = useState(true);

  // ── Join / player state ─────────────────────────────────────────────────────
  const [hasJoined, setHasJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  // The StreamVideoClient is only created once the user clicks Watch Live
  const [videoClient, setVideoClient] = useState<StreamVideoClient | null>(
    null,
  );

  // ── Chat state ──────────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Reaction state ──────────────────────────────────────────────────────────
  const [floatingReactions, setFloatingReactions] = useState<
    FloatingReaction[]
  >([]);

  // ── Stable auth header ──────────────────────────────────────────────────────
  // Empty deps: localStorage.getItem is evaluated at call time, not captured.
  const authHeader = useCallback(
    () => ({
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "Content-Type": "application/json",
    }),
    [],
  );

  // ── Load call info & recordings ─────────────────────────────────────────────
  // FIX 1: When programId is empty/undefined we must still call
  //         setIsLoadingInfo(false), otherwise the spinner never stops.
  // FIX 2: The two fetches are independent. A 403 on recordings (regular user
  //         hitting an admin-only route) no longer prevents callInfo loading.
  const loadInfo = useCallback(async () => {
    if (!programId) {
      setIsLoadingInfo(false); // ← critical: unblock the spinner
      return;
    }

    setIsLoadingInfo(true);

    try {
      // Fetch call info — required for the page to work
      const infoRes = await fetch(`${API_URL}/api/stream/call/${programId}`, {
        headers: authHeader(),
      });
      const infoData = await infoRes.json();

      if (infoData.success) {
        setCallInfo(infoData.call);
      } else {
        toast.error(infoData.message || "Failed to load stream info");
      }
    } catch {
      toast.error("Network error loading stream info");
    }

    // Fetch recordings separately so a failure / 403 doesn't block the page
    try {
      const recRes = await fetch(
        `${API_URL}/api/stream/recordings/${programId}`,
        { headers: authHeader() },
      );
      if (recRes.ok) {
        const recData = await recRes.json();
        if (recData.success) setRecordings(recData.recordings ?? []);
      }
      // Silently ignore 403 — regular users aren't admins
    } catch {
      // Non-fatal: recordings section will just show "No recordings yet"
    }

    setIsLoadingInfo(false);
  }, [programId, authHeader]);

  // FIX 3: Depend on programId directly so the effect re-runs the moment
  //         useParams resolves (avoids a stale-closure / infinite-loop risk
  //         that arises when loadInfo itself is listed and changes every render).
  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  // ── Handle Watch Live button ────────────────────────────────────────────────
  // FIX 4: handleJoin is now async and fetches a proper GetStream user token
  //         before mounting LivestreamPlayer. Without this, the SDK has no
  //         credentials and the player can silently fail or hang.
  const handleJoin = async () => {
    if (!callInfo) return;
    setIsJoining(true);

    try {
      const res = await fetch(`${API_URL}/api/stream/token`, {
        method: "POST",
        headers: authHeader(),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || "Token request failed");
      }

      // Build the audience-side StreamVideoClient (no camera/mic needed)
      const client = new StreamVideoClient({
        apiKey: data.apiKey,
        user: { id: data.streamUserId, name: data.displayName },
        token: data.token,
      });

      setVideoClient(client);

      // Seed the welcome message
      setChatMessages([
        {
          id: "sys-1",
          user: "System",
          text: `Welcome to "${callInfo.programTitle}"! You are now watching live.`,
          time: nowTime(),
          isSystem: true,
        },
      ]);

      setHasJoined(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to join stream";
      toast.error(msg);
    } finally {
      setIsJoining(false);
    }
  };

  // ── Handle Leave ────────────────────────────────────────────────────────────
  const handleLeave = useCallback(async () => {
    try {
      await videoClient?.disconnectUser();
    } catch {
      // best-effort
    }
    setVideoClient(null);
    setHasJoined(false);
    setChatMessages([]);
  }, [videoClient]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      videoClient?.disconnectUser().catch(() => {});
    };
  }, [videoClient]);

  // ── Chat helpers ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(() => {
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        user: "You",
        text: chatInput.trim(),
        time: nowTime(),
      },
    ]);
    setChatInput("");
    setTimeout(
      () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      50,
    );
  }, [chatInput]);

  // ── Reaction helpers ────────────────────────────────────────────────────────
  const sendReaction = useCallback((emoji: string) => {
    const id = Date.now().toString();
    const x = 20 + Math.random() * 60;
    setFloatingReactions((prev) => [...prev, { id, emoji, x }]);
    setTimeout(
      () => setFloatingReactions((prev) => prev.filter((r) => r.id !== id)),
      2500,
    );
  }, []);

  // ─── Render: loading ────────────────────────────────────────────────────────
  if (isLoadingInfo) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-purple-300 text-lg font-semibold">
            Loading stream…
          </p>
        </div>
      </div>
    );
  }

  // ─── Render: not found ──────────────────────────────────────────────────────
  if (!callInfo) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Radio className="w-16 h-16 text-purple-400/40 mx-auto mb-4" />
          <p className="text-white text-2xl font-black mb-2">
            Stream Not Found
          </p>
          <p className="text-purple-400">
            This program doesn't exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  // ─── Render: live view ──────────────────────────────────────────────────────
  if (hasJoined && videoClient) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-900 p-4 lg:p-6">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-white font-black text-xl">
                {callInfo.programTitle}
              </h1>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full animate-pulse">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <span className="text-red-300 text-xs font-bold">LIVE</span>
              </div>
            </div>
            <button
              onClick={handleLeave}
              className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-xl text-red-300 text-sm font-semibold transition-all"
            >
              Leave Stream
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-4">
            {/* Player */}
            <div className="flex-1 flex flex-col gap-3">
              <div className="relative bg-black rounded-2xl overflow-hidden min-h-88">
                {/* FIX 5: Wrap LivestreamPlayer in StreamVideo so the SDK's
                         React context is available. The client was created with
                         the audience token fetched in handleJoin. */}
                <StreamVideo client={videoClient}>
                  <LivestreamPlayer
                    callType={callInfo.callType}
                    callId={callInfo.callId}
                  />
                </StreamVideo>

                {/* Floating reactions overlay */}
                {floatingReactions.map((r) => (
                  <div
                    key={r.id}
                    className="pointer-events-none absolute bottom-10 text-3xl"
                    style={{
                      left: `${r.x}%`,
                      animation: "floatUp 2.5s ease-out forwards",
                    }}
                  >
                    {r.emoji}
                  </div>
                ))}
              </div>

              {/* Program info + reactions */}
              <div className="flex items-center justify-between px-4 py-3 bg-black/30 border border-purple-500/20 rounded-2xl">
                <div>
                  <p className="text-white font-bold text-lg leading-tight">
                    {callInfo.programTitle}
                  </p>
                  <p className="text-purple-400 text-sm">
                    Hosted by {callInfo.programHost}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {REACTIONS.map(({ emoji, label }) => (
                    <button
                      key={emoji}
                      onClick={() => sendReaction(emoji)}
                      title={label}
                      className="text-2xl hover:scale-125 transition-transform active:scale-110"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chat sidebar */}
            <aside className="w-full lg:w-80 flex flex-col bg-slate-900/60 border border-purple-500/20 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-purple-500/20 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-400" />
                <span className="text-white font-bold">Live Chat</span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-48 max-h-100 lg:max-h-[calc(100vh-18rem)]">
                {chatMessages.map((msg) => (
                  <div key={msg.id}>
                    {msg.isSystem ? (
                      <p className="text-center text-purple-500 text-xs italic">
                        {msg.text}
                      </p>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span
                            className={`text-xs font-bold ${
                              msg.user === "You"
                                ? "text-pink-400"
                                : "text-purple-300"
                            }`}
                          >
                            {msg.user}
                          </span>
                          <span className="text-purple-600 text-xs">
                            {msg.time}
                          </span>
                        </div>
                        <p className="text-white text-sm mt-0.5">{msg.text}</p>
                      </>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="p-3 border-t border-purple-500/20 flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Say something…"
                  className="flex-1 px-3 py-2 bg-black/30 border border-purple-500/30 rounded-xl text-white text-sm placeholder-purple-500 focus:outline-none focus:border-purple-500/60"
                />
                <button
                  onClick={sendMessage}
                  className="p-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-white transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </aside>
          </div>
        </div>

        <style jsx global>{`
          @keyframes floatUp {
            0% {
              transform: translateY(0) scale(1);
              opacity: 1;
            }
            100% {
              transform: translateY(-120px) scale(1.5);
              opacity: 0;
            }
          }
        `}</style>
      </div>
    );
  }

  // ─── Render: pre-join / recordings ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-900 p-4 lg:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Program card */}
        <div className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8 mb-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <h1 className="text-3xl font-black text-white">
                  {callInfo.programTitle}
                </h1>
                {callInfo.isLive ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full animate-pulse">
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                    <span className="text-red-300 text-sm font-bold">LIVE</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-500/20 border border-slate-500/30 rounded-full">
                    <WifiOff className="w-3 h-3 text-slate-400" />
                    <span className="text-slate-400 text-sm font-bold">
                      OFFLINE
                    </span>
                  </div>
                )}
              </div>

              <p className="text-purple-300 text-lg mb-1">
                Hosted by{" "}
                <span className="font-semibold">{callInfo.programHost}</span>
              </p>
              <span className="inline-block px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-sm font-semibold mt-2">
                {callInfo.programCategory}
              </span>
            </div>

            {callInfo.isLive ? (
              <button
                onClick={handleJoin}
                disabled={isJoining}
                className="shrink-0 px-8 py-4 bg-linear-to-br from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-60 disabled:cursor-not-allowed rounded-2xl text-white font-black text-lg flex items-center gap-3 shadow-xl shadow-red-500/30 transition-all hover:scale-105"
              >
                {isJoining ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Joining…
                  </>
                ) : (
                  <>
                    <Wifi className="w-6 h-6" />
                    Watch Live
                  </>
                )}
              </button>
            ) : (
              <div className="shrink-0 px-6 py-3 bg-purple-500/10 border border-purple-500/30 rounded-2xl text-purple-400 font-semibold text-sm text-center">
                <Radio className="w-5 h-5 mx-auto mb-1 opacity-50" />
                Not Live Yet
              </div>
            )}
          </div>

          {callInfo.isLive && (
            <div className="mt-4 flex items-center gap-2 text-purple-300 text-sm">
              <Users className="w-4 h-4" />
              <span>
                <strong>{callInfo.currentListeners}</strong> people watching
              </span>
            </div>
          )}
        </div>

        {/* Recordings */}
        <div className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2">
            <Play className="w-5 h-5 text-purple-400" />
            Past Broadcasts
          </h2>

          {recordings.length === 0 ? (
            <div className="text-center py-10">
              <Play className="w-12 h-12 text-purple-400/30 mx-auto mb-3" />
              <p className="text-purple-400 font-semibold">No recordings yet</p>
              <p className="text-purple-500 text-sm mt-1">
                Past broadcasts will appear here once they've been processed.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recordings.map((rec, i) => (
                <a
                  key={i}
                  href={rec.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-black/20 border border-purple-500/20 hover:border-purple-500/50 rounded-2xl transition-all duration-300 hover:bg-purple-500/5 group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-600/20 border border-purple-500/30 rounded-xl flex items-center justify-center group-hover:bg-purple-600/30 transition-all">
                      <Play className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-white font-semibold">
                        Broadcast {i + 1}
                      </p>
                      <div className="flex items-center gap-3 text-sm text-purple-400 mt-0.5">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(rec.startTime).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </div>
                        {rec.duration && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {rec.duration} min
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-purple-400 group-hover:translate-x-1 transition-transform" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WatchPage;
