"use client";

import Link from "next/link";
import Image from "next/image";

import { AdminSidebarMenu } from "@/constants";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "./ui/sidebar";

// Remove any quotes or semicolons from the environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface UserInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

const AdminSidebar = () => {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();
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

        const response = await fetch(`${API_URL}/api/auth/me`, {
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
      } catch (error) {
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

  const getInitials = (firstName: string) => {
    return `${firstName.charAt(0)}`.toUpperCase();
  };

  const getFullName = () => {
    if (!user) return "N/A";
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

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [pathname, isMobile, setOpenMobile]);

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar className="border-r border-purple-200/50 bg-white shadow-sm overflow-hidden">
      <SidebarHeader className="py-4 md:py-6 px-3 md:px-4 bg-linear-to-br from-purple-900 to-pink-900 shadow-md">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="hover:bg-white/10 text-white font-semibold text-sm md:text-base transition-all duration-200 h-12 md:h-auto"
            >
              <Link
                href="/dashboard"
                className="flex items-center gap-2 md:gap-3"
                onClick={handleLinkClick}
              >
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-purple-700 text-white flex items-center justify-center shadow-lg shrink-0">
                  {getInitials(user?.firstName || "")}
                </div>
                <div className="flex flex-col">
                  <span className="text-white font-bold tracking-tight">
                    {isLoading ? "Loading..." : getFullName()}
                  </span>
                  {user && (
                    <span className="text-slate-200 text-xs capitalize">
                      {user.role}
                    </span>
                  )}
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator className="bg-linear-to-r from-purple-200 via-pink-300 to-purple-200" />

      <SidebarContent className="py-3 md:py-4 bg-linear-to-b from-purple-50/50 via-white to-pink-50/30">
        <SidebarGroup>
          <SidebarGroupLabel className="text-purple-900 font-bold text-[10px] md:text-xs uppercase tracking-wider px-3 md:px-4 mb-2 opacity-90">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5 md:space-y-1 px-2">
              {AdminSidebarMenu.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      asChild
                      className={`
                        hover:bg-purple-100 hover:text-purple-900
                        rounded-lg transition-all duration-200 group
                        ${
                          isActive
                            ? "bg-purple-100 text-purple-900 shadow-sm"
                            : "text-gray-700"
                        }
                        h-10 md:h-auto
                      `}
                    >
                      <Link
                        href={item.href}
                        className="flex items-center gap-2 md:gap-3 px-2 md:px-3 py-2 md:py-2.5"
                        onClick={handleLinkClick}
                      >
                        <div
                          className={`
                          ${isActive ? "text-purple-900" : "text-purple-900"} 
                          group-hover:text-purple-600 
                          group-hover:scale-110 
                          transition-transform
                          shrink-0
                        `}
                        >
                          <item.icon className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                        <span
                          className={`
                          font-medium 
                          ${
                            isActive
                              ? "text-purple-800 font-semibold"
                              : "text-gray-700"
                          } 
                          group-hover:text-purple-800
                          text-sm md:text-[0.9rem]
                          truncate
                        `}
                        >
                          {item.title}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

export default AdminSidebar;
