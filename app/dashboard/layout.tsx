"use client";

import { RouteGuard } from "@/components/layout/RouteGuard";
import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-slate-950">
          <div className="p-6 md:p-8 pt-14 md:pt-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </RouteGuard>
  );
}
