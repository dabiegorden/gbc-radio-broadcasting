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
  Youtube,
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
    title: "Radio Streaming",
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
    id: 5,
    title: "Engagement",
    href: "/dashboard/engagement",
    icon: Video,
  },
  {
    id: 6,
    title: "Radio Analytics",
    href: "/dashboard/analytics",
    icon: GitGraph,
  },
  {
    id: 10,
    title: "Live YouTube Streaming",
    href: "/dashboard/youtube-analytics",
    icon: Youtube,
  },
  {
    id: 11,
    title: "YouTube Analytics",
    href: "/dashboard/youtube-analysis-insight",
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
