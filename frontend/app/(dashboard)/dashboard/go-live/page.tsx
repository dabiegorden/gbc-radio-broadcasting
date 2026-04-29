"use client";

/**
 * AdminLiveStreamPage
 * ───────────────────
 * Presenter control room. The admin:
 *   1. Picks a program
 *   2. Clicks "Go Live" → backend creates the GetStream call and marks the
 *      program live in MongoDB
 *   3. Camera / mic / screen-share controls appear
 *   4. Live chat & reactions are visible in the sidebar
 *   5. "End Stream" stops recording and marks the program offline
 *
 * Route: /dashboard/live-stream  (admin only)
 *
 * Install (once, in your Next.js project):
 *   npm install @stream-io/video-react-sdk
 *   npm install @stream-io/node-sdk   ← backend only, already handled
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  StreamVideo,
  StreamCall,
  StreamVideoClient,
  LivestreamLayout,
  useCallStateHooks,
  CallingState,
} from "@stream-io/video-react-sdk";
// CSS is imported globally — see stream.d.ts + globals.css
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
  ChevronDown,
  MessageSquare,
  Smile,
  Send,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Program {
  _id: string;
  title: string;
  host: string;
  category: string;
  isLive: boolean;
  status: string;
  currentListeners: number;
}

interface StreamCredentials {
  token: string;
  streamUserId: string;
  displayName: string;
  apiKey: string;
}

// ─── Inner component — rendered only when a call is active ───────────────────
const LiveControls = ({ call, onEnd }: { call: any; onEnd: () => void }) => {
  const {
    useMicrophoneState,
    useCameraState,
    useScreenShareState,
    useParticipantCount,
    useCallCallingState,
  } = useCallStateHooks();

  const { microphone, isMute: isMicMuted } = useMicrophoneState();
  const { camera, isMute: isCamOff } = useCameraState();
  const { screenShare, status: screenShareStatus } = useScreenShareState();
  const participantCount = useParticipantCount();
  const callingState = useCallCallingState();

  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Live duration timer
  useEffect(() => {
    if (callingState === CallingState.JOINED) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callingState]);

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600)
      .toString()
      .padStart(2, "0");
    const m = Math.floor((s % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return h === "00" ? `${m}:${sec}` : `${h}:${m}:${sec}`;
  };

  const isScreenSharing = screenShareStatus === "enabled";

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
            <span className="font-mono font-bold">
              {formatElapsed(elapsed)}
            </span>
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
        {/* Mic */}
        <button
          onClick={() =>
            isMicMuted ? microphone.enable() : microphone.disable()
          }
          className={`p-4 rounded-full border transition-all duration-300 hover:scale-110 ${
            isMicMuted
              ? "bg-red-600/30 border-red-500/50 text-red-300"
              : "bg-purple-600/20 border-purple-500/30 text-purple-300 hover:bg-purple-600/30"
          }`}
          title={isMicMuted ? "Unmute mic" : "Mute mic"}
        >
          {isMicMuted ? (
            <MicOff className="w-6 h-6" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </button>

        {/* Camera */}
        <button
          onClick={() => (isCamOff ? camera.enable() : camera.disable())}
          className={`p-4 rounded-full border transition-all duration-300 hover:scale-110 ${
            isCamOff
              ? "bg-red-600/30 border-red-500/50 text-red-300"
              : "bg-purple-600/20 border-purple-500/30 text-purple-300 hover:bg-purple-600/30"
          }`}
          title={isCamOff ? "Turn camera on" : "Turn camera off"}
        >
          {isCamOff ? (
            <VideoOff className="w-6 h-6" />
          ) : (
            <Video className="w-6 h-6" />
          )}
        </button>

        {/* Screen share */}
        <button
          onClick={() =>
            isScreenSharing ? screenShare.disable() : screenShare.enable()
          }
          className={`p-4 rounded-full border transition-all duration-300 hover:scale-110 ${
            isScreenSharing
              ? "bg-blue-600/30 border-blue-500/50 text-blue-300"
              : "bg-purple-600/20 border-purple-500/30 text-purple-300 hover:bg-purple-600/30"
          }`}
          title={isScreenSharing ? "Stop screen share" : "Share screen"}
        >
          {isScreenSharing ? (
            <MonitorOff className="w-6 h-6" />
          ) : (
            <MonitorUp className="w-6 h-6" />
          )}
        </button>

        {/* End stream */}
        <button
          onClick={onEnd}
          className="p-4 rounded-full bg-red-600 hover:bg-red-500 border border-red-400 text-white transition-all duration-300 hover:scale-110 ml-4"
          title="End stream"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
const AdminLiveStreamPage = () => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // GetStream state
  const [streamCreds, setStreamCreds] = useState<StreamCredentials | null>(
    null,
  );
  const [videoClient, setVideoClient] = useState<StreamVideoClient | null>(
    null,
  );
  const [activeCall, setActiveCall] = useState<any | null>(null);
  const [isLive, setIsLive] = useState(false);

  // Chat sidebar
  const [chatOpen, setChatOpen] = useState(true);
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { id: string; user: string; text: string; time: string }[]
  >([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const authHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "Content-Type": "application/json",
  });

  // ── Fetch programs ──────────────────────────────────────────────────────────
  const fetchPrograms = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/programs`, {
        headers: authHeader(),
      });
      const data = await res.json();
      setPrograms(data.programs || []);
    } catch {
      toast.error("Failed to load programs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  // ── Fetch a GetStream token for this admin user ─────────────────────────────
  const fetchStreamToken = useCallback(async () => {
    if (streamCreds) return streamCreds; // already have one
    const res = await fetch(`${API_URL}/api/stream/token`, {
      method: "POST",
      headers: authHeader(),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    setStreamCreds(data);
    return data as StreamCredentials;
  }, [streamCreds]);

  // ── Go Live ─────────────────────────────────────────────────────────────────
  const handleGoLive = async () => {
    if (!selectedProgram) {
      toast.error("Please select a program first");
      return;
    }

    setIsStarting(true);
    try {
      // 1. Get / refresh stream token
      const creds = await fetchStreamToken();

      // 2. Ask backend to create (or reuse) the GetStream call
      const callRes = await fetch(
        `${API_URL}/api/stream/call/${selectedProgram._id}`,
        { method: "POST", headers: authHeader() },
      );
      const callData = await callRes.json();
      if (!callData.success) throw new Error(callData.message);

      // 3. Build the StreamVideoClient on the frontend
      const client = new StreamVideoClient({
        apiKey: creds.apiKey,
        user: { id: creds.streamUserId, name: creds.displayName },
        token: creds.token,
      });

      // 4. Get the call reference and join
      const call = client.call("livestream", callData.call.callId);
      await call.join({ create: false });
      await call.camera.enable();
      await call.microphone.enable();

      setVideoClient(client);
      setActiveCall(call);
      setIsLive(true);

      // Update local program state
      setPrograms((prev) =>
        prev.map((p) =>
          p._id === selectedProgram._id
            ? { ...p, isLive: true, status: "live" }
            : p,
        ),
      );
      setSelectedProgram((p) => p && { ...p, isLive: true, status: "live" });

      toast.success(`🔴 You are now live: ${selectedProgram.title}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to go live");
    } finally {
      setIsStarting(false);
    }
  };

  // ── End Stream ──────────────────────────────────────────────────────────────
  const handleEndStream = async () => {
    if (!selectedProgram || !activeCall) return;
    setIsEnding(true);
    try {
      // Leave the call on the client side
      await activeCall.leave();

      // Tell the backend to end it (stops recording, marks program offline)
      await fetch(`${API_URL}/api/stream/call/${selectedProgram._id}/end`, {
        method: "POST",
        headers: authHeader(),
      });

      // Disconnect the video client
      await videoClient?.disconnectUser();

      setVideoClient(null);
      setActiveCall(null);
      setIsLive(false);
      setStreamCreds(null);

      setPrograms((prev) =>
        prev.map((p) =>
          p._id === selectedProgram._id
            ? { ...p, isLive: false, status: "completed" }
            : p,
        ),
      );
      setSelectedProgram(
        (p) => p && { ...p, isLive: false, status: "completed" },
      );

      toast.success("Stream ended. Recording is being processed.");
    } catch (err: any) {
      toast.error(err.message || "Failed to end stream");
    } finally {
      setIsEnding(false);
    }
  };

  // ── Simulate chat (GetStream chat SDK can be wired here) ────────────────────
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

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (activeCall) activeCall.leave().catch(() => {});
      if (videoClient) videoClient.disconnectUser().catch(() => {});
    };
  }, [activeCall, videoClient]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-purple-300 text-lg font-semibold">
            Loading programs...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-900 flex flex-col">
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <header className="px-8 py-5 border-b border-purple-500/20 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-linear-to-r from-purple-400 via-pink-400 to-purple-400">
            Presenter Studio
          </h1>
          <p className="text-purple-400 text-sm mt-1">
            Go live • Chat with your audience • Auto-recording enabled
          </p>
        </div>
        <button
          onClick={fetchPrograms}
          className="p-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 transition-all"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left panel — program picker + go-live button ────────────────── */}
        {!isLive && (
          <aside className="w-96 border-r border-purple-500/20 flex flex-col p-6 gap-6 overflow-y-auto">
            <div>
              <h2 className="text-white font-bold text-lg mb-4">
                Select a Program to Broadcast
              </h2>

              {programs.length === 0 ? (
                <p className="text-purple-400 text-sm">
                  No programs found. Create one first.
                </p>
              ) : (
                <div className="space-y-3">
                  {programs.map((program) => (
                    <button
                      key={program._id}
                      onClick={() => setSelectedProgram(program)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 ${
                        selectedProgram?._id === program._id
                          ? "border-purple-500/70 bg-purple-500/15 ring-2 ring-purple-500/40"
                          : "border-purple-500/20 bg-black/20 hover:border-purple-500/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold truncate">
                            {program.title}
                          </p>
                          <p className="text-purple-400 text-sm mt-0.5">
                            {program.host}
                          </p>
                        </div>
                        {program.isLive && (
                          <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 bg-green-500/20 border border-green-500/30 rounded-full text-green-400 text-xs font-bold">
                            <Signal className="w-3 h-3" /> LIVE
                          </span>
                        )}
                      </div>
                      <span className="inline-block mt-2 px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-xs">
                        {program.category}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Go Live button */}
            {selectedProgram && (
              <div className="mt-auto">
                <div className="p-4 bg-black/30 rounded-2xl border border-purple-500/20 mb-4">
                  <p className="text-purple-300 text-xs font-semibold mb-1">
                    SELECTED PROGRAM
                  </p>
                  <p className="text-white font-bold">
                    {selectedProgram.title}
                  </p>
                  <p className="text-purple-400 text-sm">
                    {selectedProgram.host}
                  </p>
                </div>

                <button
                  onClick={handleGoLive}
                  disabled={isStarting || selectedProgram.isLive}
                  className="w-full py-4 bg-linear-to-br from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl text-white font-black text-lg flex items-center justify-center gap-3 shadow-2xl shadow-red-500/30 transition-all duration-300 hover:scale-105"
                >
                  {isStarting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Going Live…
                    </>
                  ) : selectedProgram.isLive ? (
                    <>
                      <Signal className="w-6 h-6" /> Already Live
                    </>
                  ) : (
                    <>
                      <Radio className="w-6 h-6" /> Go Live
                    </>
                  )}
                </button>
              </div>
            )}
          </aside>
        )}

        {/* ── Main area — video when live, placeholder when not ───────────── */}
        <main className="flex-1 flex overflow-hidden">
          {isLive && videoClient && activeCall ? (
            <StreamVideo client={videoClient}>
              <StreamCall call={activeCall}>
                <div className="flex flex-1 overflow-hidden">
                  {/* Video + controls */}
                  <div className="flex-1 flex flex-col">
                    <LiveControls call={activeCall} onEnd={handleEndStream} />
                  </div>

                  {/* Chat sidebar */}
                  {chatOpen && (
                    <aside className="w-80 border-l border-purple-500/20 flex flex-col bg-slate-900/60">
                      <div className="px-4 py-3 border-b border-purple-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-purple-300 font-bold">
                          <MessageSquare className="w-5 h-5" />
                          Live Chat
                        </div>
                        <button
                          onClick={() => setChatOpen(false)}
                          className="text-purple-400 hover:text-white transition-colors"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Messages */}
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

                      {/* Message input */}
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

                  {/* Chat toggle when closed */}
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
            /* ─ Placeholder when not live ─ */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-sm">
                <div className="w-24 h-24 bg-purple-600/20 border border-purple-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Radio className="w-12 h-12 text-purple-400" />
                </div>
                <h2 className="text-2xl font-black text-white mb-3">
                  Ready to Broadcast?
                </h2>
                <p className="text-purple-400 text-sm">
                  {programs.length === 0
                    ? "Create a program first, then come back here to go live."
                    : "Select a program from the left panel, then click Go Live."}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminLiveStreamPage;
