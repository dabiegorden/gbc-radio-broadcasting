import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminNavbar, AdminSidebar } from "@/constants";
import { cookies } from "next/headers";
import React from "react";

const AdminLayout = async ({ children }: { children: React.ReactNode }) => {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <div className="flex min-h-screen w-full">
        {/* LEFT: Sidebar */}
        <div className="shrink-0">
          <AdminSidebar />
        </div>

        {/* RIGHT: Navbar + Content */}
        <main className="flex-1 w-full overflow-hidden">
          <AdminNavbar />
          <div className="px-4">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
