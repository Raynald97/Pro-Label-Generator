"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Tag, Printer, History, PenTool, Database,
  GitBranch, Users, ChevronLeft, ChevronRight,
  LogOut, Menu, X, Circle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { AppPage } from "@/types";

interface NavItem {
  page: AppPage;
  label: string;
  Icon: React.ElementType;
  href: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { page: "production",       label: "Production",      Icon: Printer,    href: "/dashboard/production" },
  { page: "history",          label: "History",         Icon: History,    href: "/dashboard/history" },
  { page: "label-designer",   label: "Label Designer",  Icon: PenTool,    href: "/dashboard/label-designer" },
  { page: "master-data",      label: "Master Data",     Icon: Database,   href: "/dashboard/master-data" },
  { page: "formula-process",  label: "Formula Process", Icon: GitBranch,  href: "/dashboard/formula-process" },
  { page: "user-management",  label: "Users",           Icon: Users,      href: "/dashboard/user-management", adminOnly: true },
];

export function Sidebar() {
  const { user, canAccess, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly) return user?.role === "admin";
    return canAccess(item.page);
  });

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    router.replace("/auth/login");
  }

  function SidebarContent() {
    return (
      <div
        className={cn(
          "flex flex-col h-full bg-slate-900 border-r border-slate-800 transition-all duration-300",
          collapsed ? "w-[72px]" : "w-[260px]" // Lebar diperbesar agar tidak sumpek
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 h-20 border-b border-slate-800 shrink-0 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center shrink-0 shadow-lg shadow-brand-600/20">
            <Tag size={18} className="text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white font-bold text-base leading-none tracking-tight">LabelGen</p>
              <p className="text-slate-400 text-xs mt-1 tracking-wide">100×50mm System</p>
            </div>
          )}
        </div>

        {/* Navigasi (Jarak diperlonggar) */}
        <nav className="flex-1 py-5 px-3 space-y-1.5 overflow-y-auto">
          {visibleItems.map(({ page, label, Icon, href }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={page}
                href={href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-brand-600/10 text-brand-400 border border-brand-600/20 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                )}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate flex-1">{label}</span>}
                {!collapsed && isActive && (
                  <Circle size={6} className="fill-brand-400 text-brand-400 shrink-0" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer Profil */}
        <div className="shrink-0 border-t border-slate-800 p-4 space-y-3">
          {!collapsed && user && (
            <div className="flex items-center gap-3 px-2 py-1">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold uppercase">{user.displayName?.charAt(0) || "U"}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-medium truncate">{user.displayName}</p>
                <span className={cn(
                  "inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wider uppercase",
                  user.role === "admin"
                    ? "bg-brand-600/20 text-brand-400"
                    : "bg-slate-700/80 text-slate-400"
                )}>
                  {user.role}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              title="Sign out"
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-lg text-slate-400",
                "hover:text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium",
                "disabled:opacity-50 flex-1",
                collapsed && "justify-center"
              )}
            >
              <LogOut size={16} className="shrink-0" />
              {!collapsed && <span>{signingOut ? "Signing out…" : "Sign out"}</span>}
            </button>

            {/* Collapse toggle */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? "Expand" : "Collapse"}
              className="hidden md:flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:flex h-screen sticky top-0 shrink-0">
        <SidebarContent />
      </div>

      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-center text-white shadow-lg"
      >
        <Menu size={20} />
      </button>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity" onClick={() => setMobileOpen(false)} />
          <div className="relative flex h-full animate-slide-in" style={{ width: 260 }}>
            <SidebarContent />
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-[-48px] w-10 h-10 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center text-white shadow-xl"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}