"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  Search,
  Filter,
  Edit2,
  Trash2,
  X,
  Save,
  RefreshCw,
  ChevronDown,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MoreVertical,
  MapPin,
  Video,
  FileText,
  User,
  Mail,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface Meeting {
  _id: string;
  user: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
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
  assignedAdmin: any;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  title: string;
  description: string;
  meetingType: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  status: string;
  location: string;
  meetingLink: string;
  adminNotes: string;
  assignedAdmin: string;
}

const AdminScheduleMeetingsPage = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filteredMeetings, setFilteredMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [sortBy, setSortBy] = useState("scheduledDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    meetingType: "consultation",
    scheduledDate: "",
    scheduledTime: "",
    duration: 30,
    status: "pending",
    location: "GBC Radio Station",
    meetingLink: "",
    adminNotes: "",
    assignedAdmin: "",
  });

  const STATUS_OPTIONS = ["pending", "confirmed", "cancelled", "completed"];
  const MEETING_TYPES = [
    "consultation",
    "program-pitch",
    "sponsorship",
    "interview",
    "other",
  ];

  // Fetch meetings and stats
  const fetchMeetings = async () => {
    try {
      const token = localStorage.getItem("token");
      const [meetingsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/meetings`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/meetings/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (meetingsRes.ok) {
        const data = await meetingsRes.json();
        setMeetings(data.meetings || []);
        setFilteredMeetings(data.meetings || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Error fetching meetings:", error);
      toast.error("Failed to fetch meetings");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  // Apply filters, search, and sorting
  useEffect(() => {
    let result = [...meetings];

    // Search
    if (searchQuery) {
      result = result.filter(
        (meeting) =>
          meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          meeting.description
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          meeting.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
          `${meeting.user.firstName} ${meeting.user.lastName}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase()),
      );
    }

    // Filter by status
    if (filterStatus) {
      result = result.filter((meeting) => meeting.status === filterStatus);
    }

    // Filter by type
    if (filterType) {
      result = result.filter((meeting) => meeting.meetingType === filterType);
    }

    // Sort
    result.sort((a, b) => {
      let aValue: any = a[sortBy as keyof Meeting];
      let bValue: any = b[sortBy as keyof Meeting];

      if (sortBy.includes("Date") || sortBy.includes("At")) {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredMeetings(result);
  }, [meetings, searchQuery, filterStatus, filterType, sortBy, sortOrder]);

  // Handle form change
  const handleFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Open edit modal
  const openEditModal = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setFormData({
      title: meeting.title,
      description: meeting.description,
      meetingType: meeting.meetingType,
      scheduledDate: new Date(meeting.scheduledDate)
        .toISOString()
        .split("T")[0],
      scheduledTime: meeting.scheduledTime,
      duration: meeting.duration,
      status: meeting.status,
      location: meeting.location,
      meetingLink: meeting.meetingLink || "",
      adminNotes: meeting.adminNotes || "",
      assignedAdmin: meeting.assignedAdmin?._id || "",
    });
    setShowEditModal(true);
  };

  // Update meeting
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedMeeting) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/api/meetings/${selectedMeeting._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        },
      );

      if (response.ok) {
        toast.success("Meeting updated successfully");
        setShowEditModal(false);
        setSelectedMeeting(null);
        fetchMeetings();
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to update meeting");
      }
    } catch (error) {
      console.error("Error updating meeting:", error);
      toast.error("Failed to update meeting");
    }
  };

  // Delete meeting
  const handleDelete = async (meetingId: string) => {
    if (!confirm("Are you sure you want to delete this meeting?")) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/meetings/${meetingId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success("Meeting deleted successfully");
        fetchMeetings();
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to delete meeting");
      }
    } catch (error) {
      console.error("Error deleting meeting:", error);
      toast.error("Failed to delete meeting");
    }
  };

  // Cancel meeting
  const handleCancel = async (meetingId: string) => {
    if (!confirm("Are you sure you want to cancel this meeting?")) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/api/meetings/${meetingId}/cancel`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.ok) {
        toast.success("Meeting cancelled successfully");
        fetchMeetings();
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to cancel meeting");
      }
    } catch (error) {
      console.error("Error cancelling meeting:", error);
      toast.error("Failed to cancel meeting");
    }
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-500/20 border-green-500/30 text-green-300";
      case "pending":
        return "bg-yellow-500/20 border-yellow-500/30 text-yellow-300";
      case "completed":
        return "bg-blue-500/20 border-blue-500/30 text-blue-300";
      case "cancelled":
        return "bg-red-500/20 border-red-500/30 text-red-300";
      default:
        return "bg-gray-500/20 border-gray-500/30 text-gray-300";
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "confirmed":
        return <CheckCircle2 className="w-4 h-4" />;
      case "pending":
        return <AlertCircle className="w-4 h-4" />;
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
            Loading meetings...
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
              Meeting Management
            </h1>
            <p className="text-purple-300 text-lg">
              Manage and schedule client meetings
            </p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-6 shadow-2xl">
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-purple-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search meetings by title, description, user, or location..."
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
              onClick={fetchMeetings}
              className="px-6 py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 font-semibold flex items-center gap-2 transition-all duration-300"
            >
              <RefreshCw className="w-5 h-5" />
              Refresh
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-purple-500/20">
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
                  Type
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-4 py-2 bg-black/30 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                >
                  <option value="">All Types</option>
                  {MEETING_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type
                        .split("-")
                        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(" ")}
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
                    <option value="scheduledDate">Date</option>
                    <option value="createdAt">Created</option>
                    <option value="title">Title</option>
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

      {/* Stats */}
      {stats && (
        <div className="max-w-7xl mx-auto mb-8 grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <Calendar className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-purple-300 text-sm font-semibold">Total</p>
                <p className="text-3xl font-black text-white">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-linear-to-br from-yellow-900/40 to-orange-900/40 backdrop-blur-xl border border-yellow-500/30 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-yellow-500/20 rounded-xl">
                <AlertCircle className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-yellow-300 text-sm font-semibold">Pending</p>
                <p className="text-3xl font-black text-white">
                  {stats.pending}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-linear-to-br from-green-900/40 to-emerald-900/40 backdrop-blur-xl border border-green-500/30 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-green-500/20 rounded-xl">
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-green-300 text-sm font-semibold">
                  Confirmed
                </p>
                <p className="text-3xl font-black text-white">
                  {stats.confirmed}
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
                <p className="text-blue-300 text-sm font-semibold">Upcoming</p>
                <p className="text-3xl font-black text-white">
                  {stats.upcoming}
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
                <p className="text-pink-300 text-sm font-semibold">Completed</p>
                <p className="text-3xl font-black text-white">
                  {stats.completed}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Meetings List */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8 shadow-2xl">
          {filteredMeetings.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-purple-400/50 mx-auto mb-4" />
              <p className="text-purple-300 text-lg">No meetings found</p>
              <p className="text-purple-400/70">
                {searchQuery || filterStatus || filterType
                  ? "Try adjusting your filters"
                  : "Meetings will appear here when users schedule them"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredMeetings.map((meeting) => (
                <div
                  key={meeting._id}
                  className="p-6 bg-black/20 rounded-2xl border border-purple-500/20 hover:border-purple-500/50 transition-all duration-300 group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-xl font-bold text-white">
                          {meeting.title}
                        </h3>
                        <div
                          className={`flex items-center gap-1 px-3 py-1 border rounded-full text-xs font-semibold ${getStatusColor(meeting.status)}`}
                        >
                          {getStatusIcon(meeting.status)}
                          {meeting.status.toUpperCase()}
                        </div>
                        <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-xs font-semibold">
                          {meeting.meetingType
                            .split("-")
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(" ")}
                        </span>
                      </div>

                      <p className="text-purple-300 mb-4 line-clamp-2">
                        {meeting.description}
                      </p>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="flex items-center gap-2 text-purple-300">
                          <User className="w-4 h-4 text-purple-400" />
                          <span className="text-sm">
                            {meeting.user.firstName} {meeting.user.lastName}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-purple-300">
                          <Mail className="w-4 h-4 text-purple-400" />
                          <span className="text-sm">{meeting.user.email}</span>
                        </div>

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
                      </div>

                      <div className="flex items-center gap-2 text-purple-300 text-sm">
                        <MapPin className="w-4 h-4 text-purple-400" />
                        <span>{meeting.location}</span>
                        {meeting.meetingLink && (
                          <>
                            <span className="text-purple-500">•</span>
                            <Video className="w-4 h-4 text-blue-400" />
                            <a
                              href={meeting.meetingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 underline"
                            >
                              Virtual Link
                            </a>
                          </>
                        )}
                      </div>

                      {meeting.adminNotes && (
                        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                          <p className="text-blue-300 text-sm">
                            <strong>Admin Notes:</strong> {meeting.adminNotes}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => openEditModal(meeting)}
                        className="p-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-xl transition-all duration-300 hover:scale-110"
                        title="Edit Meeting"
                      >
                        <Edit2 className="w-5 h-5 text-blue-400" />
                      </button>

                      {meeting.status !== "cancelled" && (
                        <button
                          onClick={() => handleCancel(meeting._id)}
                          className="p-3 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/30 rounded-xl transition-all duration-300 hover:scale-110"
                          title="Cancel Meeting"
                        >
                          <XCircle className="w-5 h-5 text-orange-400" />
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(meeting._id)}
                        className="p-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-xl transition-all duration-300 hover:scale-110"
                        title="Delete Meeting"
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

      {/* Edit Modal */}
      {showEditModal && selectedMeeting && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-linear-to-br from-purple-900/95 to-pink-900/95 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-black text-white">Edit Meeting</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedMeeting(null);
                }}
                className="p-2 hover:bg-purple-600/20 rounded-xl transition-all"
              >
                <X className="w-6 h-6 text-purple-300" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-6">
              <div>
                <label className="block text-purple-300 text-sm font-semibold mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleFormChange}
                  required
                  className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
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
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-purple-300 text-sm font-semibold mb-2">
                    Type
                  </label>
                  <select
                    name="meetingType"
                    value={formData.meetingType}
                    onChange={handleFormChange}
                    className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  >
                    {MEETING_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type
                          .split("-")
                          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                          .join(" ")}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-purple-300 text-sm font-semibold mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleFormChange}
                    className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-purple-300 text-sm font-semibold mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    name="scheduledDate"
                    value={formData.scheduledDate}
                    onChange={handleFormChange}
                    required
                    className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  />
                </div>

                <div>
                  <label className="block text-purple-300 text-sm font-semibold mb-2">
                    Time *
                  </label>
                  <input
                    type="time"
                    name="scheduledTime"
                    value={formData.scheduledTime}
                    onChange={handleFormChange}
                    required
                    className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-purple-300 text-sm font-semibold mb-2">
                  Location
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleFormChange}
                  className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div>
                <label className="block text-purple-300 text-sm font-semibold mb-2">
                  Meeting Link
                </label>
                <input
                  type="url"
                  name="meetingLink"
                  value={formData.meetingLink}
                  onChange={handleFormChange}
                  className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div>
                <label className="block text-purple-300 text-sm font-semibold mb-2">
                  Admin Notes
                </label>
                <textarea
                  name="adminNotes"
                  value={formData.adminNotes}
                  onChange={handleFormChange}
                  rows={3}
                  className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
                  placeholder="Internal notes (not visible to user)"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedMeeting(null);
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
                  Update Meeting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminScheduleMeetingsPage;
