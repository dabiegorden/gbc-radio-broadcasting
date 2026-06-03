"use client";

import { LogOut, Mail, Menu, Shield, User } from "lucide-react";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useSidebar } from "./ui/sidebar";
import { Button } from "./ui/button";

// Remove any quotes or semicolons from the environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface UserInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

const AdminNavbar = () => {
  const { toggleSidebar } = useSidebar();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          toast.error("Not authenticated");
          router.push("/");
          return;
        }

        const response = await fetch(`${API_URL}/auth/me`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();

          // Extract user data from the response structure
          const userData = {
            id: data.data._id,
            firstName: data.data.firstName,
            lastName: data.data.lastName,
            email: data.data.email,
            role: data.data.role,
          };

          setUser(userData);
          // Update localStorage with latest user data
          localStorage.setItem("user", JSON.stringify(userData));
        } else {
          toast.error("Session expired");
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          router.push("/");
        }
      } catch (error: any) {
        console.error("Error fetching user info:", error);
        toast.error("Error fetching user info");
        // Clear storage and redirect on error
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        router.push("/");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getFullName = () => {
    if (!user) return "User";
    return `${user.firstName} ${user.lastName}`;
  };

  // Handle logout function
  const handleLogout = () => {
    try {
      // Clear storage and redirect
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      toast.success("Logged out successfully");
      router.push("/");
    } catch (error) {
      console.error("Error logging out", error);
      toast.error("Error logging out!");
      // Still clear and redirect on error
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      router.push("/");
    }
  };

  return (
    <nav className="p-4 flex items-center justify-between sticky top-0 bg-[#2D1B4E]  shadow-sm shrink-0 z-50">
      {/* LEFT SIDE */}
      <div className="flex items-center gap-3 min-w-0">
        <Button
          onClick={toggleSidebar}
          variant="outline"
          size="icon"
          className="cursor-pointer border-white/20 bg-white/10 hover:bg-white/20 hover:border-white/40 text-white transition-all duration-200 rounded-lg shrink-0"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="hidden sm:block truncate">
          <h2 className="text-lg font-semibold text-slate-100">Dashboard</h2>
          {user && (
            <p className="text-xs text-slate-300">
              Welcome back, {user.firstName}!
            </p>
          )}
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="flex items-center gap-4 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger className="focus:outline-none group">
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 hover:border-white/40 transition-all duration-200 cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-linear-to-br from-emerald-400 to-teal-500 text-white font-semibold flex items-center justify-center text-sm shadow-lg">
                {user ? (
                  getInitials(user.firstName, user.lastName)
                ) : (
                  <User className="w-5 h-5" />
                )}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-white truncate max-w-37.5">
                  {isLoading ? "Loading..." : getFullName()}
                </p>
                {user && (
                  <p className="text-xs text-slate-300 capitalize">
                    {user.role}
                  </p>
                )}
              </div>
            </div>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            sideOffset={10}
            align="end"
            className="w-64 border-emerald-200 shadow-xl"
          >
            <DropdownMenuLabel className="text-[#2D1B4E] font-semibold">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-linear-to-br from-emerald-400 to-teal-500 text-white font-semibold flex items-center justify-center shadow-md">
                  {user ? (
                    getInitials(user.firstName, user.lastName)
                  ) : (
                    <User className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <p className="font-semibold">{getFullName()}</p>
                  {user && (
                    <p className="text-xs text-gray-500 font-normal capitalize">
                      {user.role}
                    </p>
                  )}
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator className="bg-emerald-100" />

            <DropdownMenuItem className="hover:bg-emerald-50 hover:text-[#2D1B4E] cursor-pointer transition-colors duration-150 rounded-md my-1">
              <Mail className="h-4 w-4 mr-2 text-[#2D1B4E]" />
              <div className="flex flex-col">
                <span className="text-xs text-gray-500">Email</span>
                <span className="text-sm font-medium">
                  {user?.email || "-"}
                </span>
              </div>
            </DropdownMenuItem>

            <DropdownMenuItem className="hover:bg-emerald-50 hover:text-[#2D1B4E] cursor-pointer transition-colors duration-150 rounded-md my-1">
              <Shield className="h-4 w-4 mr-2 text-[#2D1B4E]" />
              <div className="flex flex-col">
                <span className="text-xs text-gray-500">Role</span>
                <span className="text-sm font-medium capitalize">
                  {user?.role || "-"}
                </span>
              </div>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-emerald-100" />

            <DropdownMenuItem
              className="hover:bg-red-50 hover:text-red-600 cursor-pointer transition-colors duration-150 rounded-md my-1"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="text-red-600 font-medium">Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
};

export default AdminNavbar;
