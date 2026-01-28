"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Users as UsersIcon,
  UserCheck,
  UserX,
  X,
  Save,
  Loader2,
  Mail,
  Shield,
  Calendar,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  profileImage?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

interface UserStats {
  total: number;
  active: number;
  inactive: number;
  admins: number;
  users: number;
  recentUsers: number;
}

const AdminUsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "users",
    profileImage: "",
  });

  // Initialize WebSocket
  useEffect(() => {
    socketRef.current = io(API_URL);

    socketRef.current.on("connect", () => {
      console.log("WebSocket connected");
    });

    socketRef.current.on("user-created", () => {
      fetchUsers();
      fetchStats();
    });

    socketRef.current.on("user-updated", () => {
      fetchUsers();
      fetchStats();
    });

    socketRef.current.on("user-deleted", () => {
      fetchUsers();
      fetchStats();
    });

    socketRef.current.on("user-status-changed", () => {
      fetchUsers();
      fetchStats();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Fetch users
  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      let url = `${API_URL}/api/users?limit=100&sortBy=${sortBy}&order=${sortOrder}`;

      if (searchTerm) url += `&search=${searchTerm}`;
      if (selectedRole) url += `&role=${selectedRole}`;
      if (selectedStatus) url += `&isActive=${selectedStatus}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch users");
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/users/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchUsers(), fetchStats()]);
      setIsLoading(false);
    };

    loadData();
  }, [searchTerm, selectedRole, selectedStatus, sortBy, sortOrder]);

  // Handle form input change
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Open modal for creating new user
  const handleCreateNew = () => {
    setIsEditMode(false);
    setCurrentUser(null);
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      role: "users",
      profileImage: "",
    });
    setIsModalOpen(true);
  };

  // Open modal for editing user
  const handleEdit = (user: User) => {
    setIsEditMode(true);
    setCurrentUser(user);
    setFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: "",
      role: user.role,
      profileImage: user.profileImage || "",
    });
    setIsModalOpen(true);
  };

  // Submit form (create or update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem("token");
      const payload: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        role: formData.role,
        profileImage: formData.profileImage || "",
      };

      // Only include password for new users or if it's being changed
      if (!isEditMode || formData.password) {
        payload.password = formData.password;
      }

      const url = isEditMode
        ? `${API_URL}/api/users/${currentUser?._id}`
        : `${API_URL}/api/users`;

      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        setIsModalOpen(false);
        fetchUsers();
        fetchStats();
      } else {
        toast.error(data.message || "Operation failed");
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("Failed to save user");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete user
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/users/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        toast.success("User deleted successfully");
        fetchUsers();
        fetchStats();
      } else {
        toast.error(data.message || "Failed to delete user");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    }
  };

  // Toggle active status
  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/users/${id}/toggle-active`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        fetchUsers();
        fetchStats();
      } else {
        toast.error(data.message || "Failed to toggle status");
      }
    } catch (error) {
      console.error("Error toggling status:", error);
      toast.error("Failed to toggle status");
    }
  };

  // Refresh data
  const handleRefresh = async () => {
    toast.info("Refreshing data...");
    await Promise.all([fetchUsers(), fetchStats()]);
    toast.success("Data refreshed");
  };

  // Get user initials
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-purple-300 text-lg font-semibold">
            Loading users...
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
              User Management
            </h1>
            <p className="text-purple-300 text-lg">
              Manage and monitor all users in the system
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleRefresh}
              className="px-4 py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-purple-300 font-semibold flex items-center gap-2 transition-all duration-300"
            >
              <RefreshCw className="w-5 h-5" />
              Refresh
            </button>

            <button
              onClick={handleCreateNew}
              className="px-6 py-3 bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-semibold flex items-center gap-2 transition-all duration-300 hover:scale-105 shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Create User
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-purple-300 text-sm font-semibold">
                  Total Users
                </span>
                <UsersIcon className="w-5 h-5 text-purple-400" />
              </div>
              <p className="text-4xl font-black text-white">{stats.total}</p>
            </div>

            <div className="bg-linear-to-br from-green-900/40 to-emerald-900/40 backdrop-blur-xl border border-green-500/30 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-green-300 text-sm font-semibold">
                  Active
                </span>
                <UserCheck className="w-5 h-5 text-green-400" />
              </div>
              <p className="text-4xl font-black text-white">{stats.active}</p>
            </div>

            <div className="bg-linear-to-br from-red-900/40 to-orange-900/40 backdrop-blur-xl border border-red-500/30 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-red-300 text-sm font-semibold">
                  Inactive
                </span>
                <UserX className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-4xl font-black text-white">{stats.inactive}</p>
            </div>

            <div className="bg-linear-to-br from-blue-900/40 to-cyan-900/40 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-300 text-sm font-semibold">
                  Admins
                </span>
                <Shield className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-4xl font-black text-white">{stats.admins}</p>
            </div>

            <div className="bg-linear-to-br from-pink-900/40 to-rose-900/40 backdrop-blur-xl border border-pink-500/30 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-pink-300 text-sm font-semibold">
                  Regular Users
                </span>
                <UsersIcon className="w-5 h-5 text-pink-400" />
              </div>
              <p className="text-4xl font-black text-white">{stats.users}</p>
            </div>

            <div className="bg-linear-to-br from-yellow-900/40 to-amber-900/40 backdrop-blur-xl border border-yellow-500/30 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-yellow-300 text-sm font-semibold">
                  New (7d)
                </span>
                <Calendar className="w-5 h-5 text-yellow-400" />
              </div>
              <p className="text-4xl font-black text-white">
                {stats.recentUsers}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-linear-to-br from-slate-900/40 to-purple-900/40 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            {/* Role Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50 appearance-none cursor-pointer"
              >
                <option value="">All Roles</option>
                <option value="admin">Admin</option>
                <option value="users">Users</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50 appearance-none cursor-pointer"
              >
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          {/* Sort Options */}
          <div className="flex gap-4 mt-4">
            <div className="flex-1">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-4 py-2 bg-slate-900/50 border border-purple-500/30 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500/50 appearance-none cursor-pointer"
              >
                <option value="createdAt">Sort by: Created Date</option>
                <option value="firstName">Sort by: First Name</option>
                <option value="lastName">Sort by: Last Name</option>
                <option value="email">Sort by: Email</option>
                <option value="role">Sort by: Role</option>
              </select>
            </div>
            <div>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="px-4 py-2 bg-slate-900/50 border border-purple-500/30 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500/50 appearance-none cursor-pointer"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Users Grid */}
      <div className="max-w-7xl mx-auto">
        {users.length === 0 ? (
          <div className="bg-linear-to-br from-slate-900/40 to-purple-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-12 text-center">
            <UsersIcon className="w-16 h-16 text-purple-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">
              No Users Found
            </h3>
            <p className="text-purple-300 mb-6">
              {searchTerm || selectedRole || selectedStatus
                ? "Try adjusting your filters"
                : "Get started by creating your first user"}
            </p>
            {!searchTerm && !selectedRole && !selectedStatus && (
              <button
                onClick={handleCreateNew}
                className="px-6 py-3 bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-semibold flex items-center gap-2 mx-auto transition-all duration-300 hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                Create First User
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map((user) => (
              <div
                key={user._id}
                className="bg-linear-to-br from-slate-900/40 to-purple-900/40 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-6 hover:border-purple-500/50 transition-all duration-300 group"
              >
                {/* User Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                      {getInitials(user.firstName, user.lastName)}
                    </div>
                    <div>
                      <h3 className="text-white font-bold">
                        {user.firstName} {user.lastName}
                      </h3>
                      <p className="text-purple-300 text-sm">{user.email}</p>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger className="p-2 hover:bg-purple-500/20 rounded-lg transition-colors">
                      <MoreVertical className="w-5 h-5 text-purple-300" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="bg-slate-900 border-purple-500/30"
                    >
                      <DropdownMenuItem
                        onClick={() => handleEdit(user)}
                        className="text-purple-300 hover:text-purple-200 hover:bg-purple-500/20 cursor-pointer"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          handleToggleActive(user._id, user.isActive)
                        }
                        className="text-blue-300 hover:text-blue-200 hover:bg-blue-500/20 cursor-pointer"
                      >
                        {user.isActive ? (
                          <>
                            <UserX className="w-4 h-4 mr-2" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-4 h-4 mr-2" />
                            Activate
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          handleDelete(
                            user._id,
                            `${user.firstName} ${user.lastName}`,
                          )
                        }
                        className="text-red-300 hover:text-red-200 hover:bg-red-500/20 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* User Details */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-400" />
                    <span className="text-purple-300 text-sm capitalize">
                      {user.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-purple-400" />
                    <span className="text-purple-300 text-sm">
                      Joined {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center justify-between pt-4 border-t border-purple-500/20">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      user.isActive
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : "bg-red-500/20 text-red-400 border border-red-500/30"
                    }`}
                  >
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                  {user.lastLogin && (
                    <span className="text-purple-400 text-xs">
                      Last login:{" "}
                      {new Date(user.lastLogin).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-linear-to-br from-slate-900 to-purple-900 border border-purple-500/30 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-linear-to-r from-purple-600 to-pink-600 p-6 flex items-center justify-between rounded-t-3xl">
              <h2 className="text-2xl font-black text-white">
                {isEditMode ? "Edit User" : "Create New User"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-purple-300 font-semibold mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 bg-slate-900/50 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
                    placeholder="John"
                  />
                </div>

                <div>
                  <label className="block text-purple-300 font-semibold mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 bg-slate-900/50 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
                    placeholder="Doe"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-purple-300 font-semibold mb-2">
                  Email *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
                    placeholder="john.doe@example.com"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-purple-300 font-semibold mb-2">
                  Password {!isEditMode && "*"}
                  {isEditMode && (
                    <span className="text-sm font-normal ml-2">
                      (leave blank to keep current)
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required={!isEditMode}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-300"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-purple-300 font-semibold mb-2">
                  Role *
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    required
                    className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500/50 appearance-none cursor-pointer"
                  >
                    <option value="users">Regular User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              {/* Profile Image URL (Optional) */}
              <div>
                <label className="block text-purple-300 font-semibold mb-2">
                  Profile Image URL (Optional)
                </label>
                <input
                  type="url"
                  name="profileImage"
                  value={formData.profileImage}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-purple-500/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500/50"
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>

              {/* Submit Button */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      {isEditMode ? "Update User" : "Create User"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPage;
