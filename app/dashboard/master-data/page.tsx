"use client";

import Link from "next/link";
import {
  Users, FolderOpen, Layers, Scissors, Blend,
  Tag, Cpu, GitBranch, Frame, BellRing, Image, Stamp,
} from "lucide-react";
import { RouteGuard } from "@/components/layout/RouteGuard";

const MODULES = [
  {
    href: "/dashboard/master-data/customers",
    Icon: Users,
    label: "Customers",
    desc: "Customer names, initials, address, city",
    color: "brand",
  },
  {
    href: "/dashboard/master-data/projects",
    Icon: FolderOpen,
    label: "Projects",
    desc: "Project names and short codes",
    color: "indigo",
  },
  {
    href: "/dashboard/master-data/glass-types",
    Icon: Layers,
    label: "Glass Types",
    desc: "Type, color, and thickness per glass variant",
    color: "cyan",
  },
  {
    href: "/dashboard/master-data/kogs",
    Icon: Tag,
    label: "KoG",
    desc: "Kind of Glass — Tempered, Laminated, etc.",
    color: "violet",
  },
  {
    href: "/dashboard/master-data/cut-shapes",
    Icon: Scissors,
    label: "Cut Shapes",
    desc: "Rectangle, L-Shape, custom cuts",
    color: "emerald",
  },
  {
    href: "/dashboard/master-data/pvbs",
    Icon: Blend,
    label: "PVB",
    desc: "PVB interlayer types and codes",
    color: "amber",
  },
  {
    href: "/dashboard/master-data/categories",
    Icon: Tag,
    label: "Categories",
    desc: "Label categories for classification",
    color: "rose",
  },
  {
    href: "/dashboard/master-data/processes",
    Icon: Cpu,
    label: "Processes",
    desc: "Production processes: Cutting, Tempering, etc.",
    color: "orange",
  },
  {
    href: "/dashboard/master-data/edge-processes",
    Icon: Frame,
    label: "Edge Processes",
    desc: "Flat Polish, Beveled, Seamed, etc.",
    color: "teal",
  },
  {
    href: "/dashboard/master-data/alerts",
    Icon: BellRing,
    label: "Alerts",
    desc: "Warning symbols with Material Icons",
    color: "yellow",
  },
  {
    href: "/dashboard/master-data/logos",
    Icon: Image,
    label: "Logos",
    desc: "Brand logos for label printing",
    color: "sky",
  },
  {
    href: "/dashboard/master-data/markings",
    Icon: Stamp,
    label: "Markings",
    desc: "SNI, CE marks and compliance stamps",
    color: "purple",
  },
];

const COLOR_MAP: Record<string, string> = {
  brand:   "bg-brand-600/10   border-brand-600/20   text-brand-400",
  indigo:  "bg-indigo-600/10  border-indigo-600/20  text-indigo-400",
  cyan:    "bg-cyan-600/10    border-cyan-600/20    text-cyan-400",
  violet:  "bg-violet-600/10  border-violet-600/20  text-violet-400",
  emerald: "bg-emerald-600/10 border-emerald-600/20 text-emerald-400",
  amber:   "bg-amber-600/10   border-amber-600/20   text-amber-400",
  rose:    "bg-rose-600/10    border-rose-600/20    text-rose-400",
  orange:  "bg-orange-600/10  border-orange-600/20  text-orange-400",
  teal:    "bg-teal-600/10    border-teal-600/20    text-teal-400",
  yellow:  "bg-yellow-600/10  border-yellow-600/20  text-yellow-400",
  sky:     "bg-sky-600/10     border-sky-600/20     text-sky-400",
  purple:  "bg-purple-600/10  border-purple-600/20  text-purple-400",
};

export default function MasterDataPage() {
  return (
    <RouteGuard requiredPage="master-data">
      <div className="animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Master Data</h1>
            <p className="page-subtitle">Manage reference data used across all label templates</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {MODULES.map(({ href, Icon, label, desc, color }) => (
            <Link
              key={href}
              href={href}
              className="card p-4 group hover:border-slate-700 hover:bg-slate-800/40 transition-all duration-200"
            >
              <div className={`w-9 h-9 rounded-lg border flex items-center justify-center mb-3 ${COLOR_MAP[color]}`}>
                <Icon size={16} />
              </div>
              <p className="text-white font-medium text-sm group-hover:text-brand-300 transition-colors">
                {label}
              </p>
              <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </RouteGuard>
  );
}
