import {
  LayoutDashboard,
  Video,
  GalleryHorizontal,
  Home,
  Radio,
  GitGraph,
  User,
  Calendar,
  ListVideo,
} from "lucide-react";

import AdminNavbar from "@/components/AdminNavbar";
import AdminSidebar from "@/components/AdminSidebar";

export { AdminNavbar, AdminSidebar };

export const AdminSidebarMenu = [
  {
    id: 1,
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    id: 2,
    title: "Streaming",
    href: "/dashboard/streaming",
    icon: GalleryHorizontal,
  },
  {
    id: 3,
    title: "Programs",
    href: "/dashboard/programs",
    icon: Radio,
  },
  {
    id: 4,
    title: "Go Live",
    href: "/dashboard/go-live",
    icon: ListVideo,
  },
  {
    id: 5,
    title: "Engagement",
    href: "/dashboard/engagement",
    icon: Video,
  },
  {
    id: 6,
    title: "Analytics",
    href: "/dashboard/analytics",
    icon: GitGraph,
  },
  {
    id: 7,
    title: "Users",
    href: "/dashboard/users",
    icon: User,
  },
  {
    id: 8,
    title: "Meetings",
    href: "/dashboard/meetings",
    icon: Calendar,
  },
  {
    id: 9,
    title: "Home",
    href: "/",
    icon: Home,
  },
];
