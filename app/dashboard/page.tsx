"use client";

import Link from "next/link";
import {
  Printer, History, PenTool, Database,
  GitBranch, Users, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { APP_PAGES } from "@/types";

const PAGE_META: Record<string, { href: string; Icon: React.ElementType }> = {
  "production":      { href: "/dashboard/production",      Icon: Printer    },
  "history":         { href: "/dashboard/history",         Icon: History    },
  "label-designer":  { href: "/dashboard/label-designer",  Icon: PenTool    },
  "master-data":     { href: "/dashboard/master-data",     Icon: Database   },
  "formula-process": { href: "/dashboard/formula-process", Icon: GitBranch  },
  "user-management": { href: "/dashboard/user-management", Icon: Users      },
};

export default function DashboardPage() {
  const { user, canAccess } = useAuth();

  const accessible = APP_PAGES.filter((p) => {
    if (p.adminOnly) return user?.role === "admin";
    return canAccess(p.page);
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="animate-fade-in">
      {/* Welcome */}
      <div className="mb-8">
        <p className="text-slate-500 text-sm">{greeting},</p>
        <h1 className="text-2xl font-bold text-white tracking-tight mt-0.5">
          {user?.displayName || "User"} 👋
        </h1>
        <p className="text-slate-400 text-sm mt-2">
          Welcome to LabelGen. Select a module to get started.
        </p>
      </div>

      {/* Module cards */}
      {accessible.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accessible.map((p) => {
            const meta = PAGE_META[p.page];
            if (!meta) return null;
            const { href, Icon } = meta;
            return (
              <Link
                key={p.page}
                href={href}
                className="card p-5 group hover:border-brand-600/40 hover:bg-slate-800/40 transition-all duration-200"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-brand-600/10 border border-brand-600/20 flex items-center justify-center shrink-0 group-hover:bg-brand-600/20 transition-colors">
                    <Icon size={18} className="text-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm group-hover:text-brand-300 transition-colors">
                      {p.label}
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{p.description}</p>
                  </div>
                  <ArrowRight
                    size={15}
                    className="text-slate-700 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-3">
            <Users size={22} className="text-slate-600" />
          </div>
          <p className="text-slate-400 text-sm font-medium">No modules assigned</p>
          <p className="text-slate-600 text-xs mt-1">Contact your administrator to request access.</p>
        </div>
      )}
    </div>
  );
}
