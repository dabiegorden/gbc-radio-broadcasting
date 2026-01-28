"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowLeft,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface Meeting {
  _id: string;
  title: string;
  description: string;
  meetingType: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  status: string;
  location: string;
  meetingLink: string | null;
  notes: string;
  adminNotes: string;
  createdAt: string;
  updatedAt: string;
}

const MyMeetingsPage = () => {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMyMeetings = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("You must be logged in to view your meetings.");
        router.push("/login");
        return;
      }

      const res = await fetch(`${API_URL}/api/meetings/my-meetings`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (res.ok) {
        setMeetings(data.meetings || []);
      } else {
        toast.error(data.message || "Failed to load meetings");
      }
    } catch (error) {
      console.error("Fetch meetings error:", error);
      toast.error("Failed to fetch meetings");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyMeetings();
  }, []);

  // Status badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return {
          bg: "bg-green-500/20 border-green-500/30 text-green-300",
          icon: <CheckCircle2 className="w-4 h-4" />,
        };
      case "pending":
        return {
          bg: "bg-yellow-500/20 border-yellow-500/30 text-yellow-300",
          icon: <AlertCircle className="w-4 h-4" />,
        };
      case "cancelled":
        return {
          bg: "bg-red-500/20 border-red-500/30 text-red-300",
          icon: <XCircle className="w-4 h-4" />,
        };
      case "completed":
        return {
          bg: "bg-blue-500/20 border-blue-500/30 text-blue-300",
          icon: <CheckCircle2 className="w-4 h-4" />,
        };
      default:
        return {
          bg: "bg-gray-500/20 border-gray-500/30 text-gray-300",
          icon: <AlertCircle className="w-4 h-4" />,
        };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-purple-300 text-lg font-semibold">
            Loading your meetings...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-900 p-6">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-purple-300 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-linear-to-r from-purple-400 via-pink-400 to-purple-400">
          My Meetings
        </h1>
        <p className="text-purple-300 text-lg">
          View and manage your scheduled meetings
        </p>
      </div>

      <div className="max-w-5xl mx-auto">
        <div className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-6 shadow-2xl">
          {meetings.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-purple-400/50 mx-auto mb-4" />
              <p className="text-purple-300 text-lg">No meetings found</p>
              <p className="text-purple-400/70">
                Once you schedule a meeting, it will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {meetings.map((meeting) => {
                const badge = getStatusBadge(meeting.status);

                return (
                  <div
                    key={meeting._id}
                    className="p-6 bg-black/20 rounded-2xl border border-purple-500/20 hover:border-purple-500/50 transition-all duration-300 group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {/* Title + Status */}
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-xl font-bold text-white">
                            {meeting.title}
                          </h3>
                          <div
                            className={`flex items-center gap-1 px-3 py-1 border rounded-full text-xs font-semibold ${badge.bg}`}
                          >
                            {badge.icon}
                            {meeting.status.toUpperCase()}
                          </div>
                        </div>

                        <p className="text-purple-300 mb-4 line-clamp-2">
                          {meeting.description}
                        </p>

                        {/* Meta Data */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                          <div className="flex items-center gap-2 text-purple-300">
                            <Calendar className="w-4 h-4 text-purple-400" />
                            <span className="text-sm">
                              {new Date(
                                meeting.scheduledDate,
                              ).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-purple-300">
                            <Clock className="w-4 h-4 text-purple-400" />
                            <span className="text-sm">
                              {meeting.scheduledTime} ({meeting.duration}min)
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-purple-300">
                            <MapPin className="w-4 h-4 text-purple-400" />
                            <span className="text-sm">{meeting.location}</span>
                          </div>
                        </div>

                        {/* Virtual Link */}
                        {meeting.meetingLink && (
                          <div className="flex items-center gap-2 text-sm text-blue-300">
                            <Video className="w-4 h-4" />
                            <a
                              href={meeting.meetingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-blue-200 underline"
                            >
                              Join Virtual Meeting
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyMeetingsPage;
