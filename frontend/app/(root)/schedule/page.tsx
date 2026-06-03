"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  MapPin,
  FileText,
  Send,
  ArrowLeft,
  Radio,
  Users,
  Briefcase,
  Mic,
  DollarSign,
  MoreHorizontal,
  Video,
  Check,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const ScheduleMeetingPage = () => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    meetingType: "consultation",
    scheduledDate: "",
    scheduledTime: "",
    duration: 30,
    location: "GBC Radio Station",
    meetingLink: "",
    notes: "",
  });

  const meetingTypes = [
    {
      value: "consultation",
      label: "Consultation",
      icon: <Users className="w-5 h-5" />,
      description: "General consultation about our services",
    },
    {
      value: "program-pitch",
      label: "Program Pitch",
      icon: <Mic className="w-5 h-5" />,
      description: "Pitch your radio program idea",
    },
    {
      value: "sponsorship",
      label: "Sponsorship",
      icon: <DollarSign className="w-5 h-5" />,
      description: "Discuss sponsorship opportunities",
    },
    {
      value: "interview",
      label: "Interview",
      icon: <Briefcase className="w-5 h-5" />,
      description: "Schedule an interview slot",
    },
    {
      value: "other",
      label: "Other",
      icon: <MoreHorizontal className="w-5 h-5" />,
      description: "Other meeting purposes",
    },
  ];

  const durations = [
    { value: 15, label: "15 minutes" },
    { value: 30, label: "30 minutes" },
    { value: 45, label: "45 minutes" },
    { value: 60, label: "1 hour" },
    { value: 90, label: "1.5 hours" },
    { value: 120, label: "2 hours" },
  ];

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.title ||
      !formData.description ||
      !formData.scheduledDate ||
      !formData.scheduledTime
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Check if date is in the future
    const selectedDate = new Date(formData.scheduledDate);
    if (selectedDate < new Date()) {
      toast.error("Meeting date must be in the future");
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/meetings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(
          "Meeting scheduled successfully! Check your email for confirmation.",
        );
        router.push("/my-meetings");
      } else {
        toast.error(data.message || "Failed to schedule meeting");
      }
    } catch (error) {
      console.error("Error scheduling meeting:", error);
      toast.error("Failed to schedule meeting");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-900 p-6">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-purple-300 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-linear-to-br from-purple-600 to-pink-600 rounded-2xl">
            <Calendar className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-linear-to-r from-purple-400 via-pink-400 to-purple-400">
              Schedule a Meeting
            </h1>
            <p className="text-purple-300 text-lg">
              Book a meeting with GBC Radio Station
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto">
        <form
          onSubmit={handleSubmit}
          className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8 shadow-2xl"
        >
          {/* Meeting Type Selection */}
          <div className="mb-8">
            <label className="block text-purple-300 text-sm font-semibold mb-4">
              Meeting Type *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {meetingTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      meetingType: type.value,
                    }))
                  }
                  className={`p-4 rounded-xl border-2 transition-all duration-300 text-left ${
                    formData.meetingType === type.value
                      ? "border-purple-500 bg-purple-600/20"
                      : "border-purple-500/30 bg-black/20 hover:border-purple-500/50"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={`p-2 rounded-lg ${formData.meetingType === type.value ? "bg-purple-600" : "bg-purple-600/20"}`}
                    >
                      {type.icon}
                    </div>
                    {formData.meetingType === type.value && (
                      <Check className="w-5 h-5 text-green-400 ml-auto" />
                    )}
                  </div>
                  <h3 className="text-white font-bold mb-1">{type.label}</h3>
                  <p className="text-purple-300 text-sm">{type.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Meeting Title */}
          <div className="mb-6">
            <label className="block text-purple-300 text-sm font-semibold mb-2">
              Meeting Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Program Pitch Discussion"
              className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
              required
            />
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-purple-300 text-sm font-semibold mb-2">
              Description *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe the purpose of your meeting..."
              rows={4}
              className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50 resize-none"
              required
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-purple-300 text-sm font-semibold mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Meeting Date *
              </label>
              <input
                type="date"
                name="scheduledDate"
                value={formData.scheduledDate}
                onChange={handleChange}
                min={new Date().toISOString().split("T")[0]}
                className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                required
              />
            </div>

            <div>
              <label className="block text-purple-300 text-sm font-semibold mb-2">
                <Clock className="w-4 h-4 inline mr-2" />
                Meeting Time *
              </label>
              <input
                type="time"
                name="scheduledTime"
                value={formData.scheduledTime}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                required
              />
            </div>
          </div>

          {/* Duration */}
          <div className="mb-6">
            <label className="block text-purple-300 text-sm font-semibold mb-2">
              Duration
            </label>
            <select
              name="duration"
              value={formData.duration}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
            >
              {durations.map((duration) => (
                <option key={duration.value} value={duration.value}>
                  {duration.label}
                </option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div className="mb-6">
            <label className="block text-purple-300 text-sm font-semibold mb-2">
              <MapPin className="w-4 h-4 inline mr-2" />
              Location
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="GBC Radio Station"
              className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
            />
          </div>

          {/* Virtual Meeting Link */}
          <div className="mb-6">
            <label className="block text-purple-300 text-sm font-semibold mb-2">
              <Video className="w-4 h-4 inline mr-2" />
              Virtual Meeting Link (Optional)
            </label>
            <input
              type="url"
              name="meetingLink"
              value={formData.meetingLink}
              onChange={handleChange}
              placeholder="https://meet.google.com/..."
              className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
            />
            <p className="text-purple-400/70 text-sm mt-2">
              Add a link if you prefer a virtual meeting
            </p>
          </div>

          {/* Additional Notes */}
          <div className="mb-8">
            <label className="block text-purple-300 text-sm font-semibold mb-2">
              <FileText className="w-4 h-4 inline mr-2" />
              Additional Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Any additional information you'd like us to know..."
              rows={3}
              className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50 resize-none"
            />
          </div>

          {/* Info Box */}
          <div className="mb-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <h4 className="text-blue-300 font-semibold mb-2 flex items-center gap-2">
              <Radio className="w-5 h-5" />
              What happens next?
            </h4>
            <ul className="text-blue-200 text-sm space-y-1">
              <li>• You'll receive a confirmation email immediately</li>
              <li>• Our admin team will review your request</li>
              <li>• You'll get a reminder email 1 hour before the meeting</li>
              <li>• You can manage your meetings from the dashboard</li>
            </ul>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 px-6 py-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-4 bg-linear-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-bold transition-all duration-300 hover:scale-105 shadow-lg shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Scheduling...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Schedule Meeting
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScheduleMeetingPage;
