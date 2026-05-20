"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, BellRing,
  ChevronUp, ChevronDown, ChevronsUpDown,
} from "lucide-react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  getMasterList,
  createMasterItem,
  updateMasterItem,
  deleteMasterItem,
} from "@/lib/master-data";
import type { Alert, AlertFormData } from "@/types";
import { cn } from "@/lib/utils";

// ─── GOOGLE SYMBOLS PRESETS ───────────────────────────────────────────────────
// Daftar ikon umum untuk peringatan (bisa ditambah sesuai kebutuhan)
const SYMBOL_PRESETS = [
  "warning", "error", "info", "gpp_maybe", "dangerous", 
  "science", "local_fire_department", "water_drop", "front_hand", "visibility_off"
];

// ─── VALIDATION SCHEMA ────────────────────────────────────────────────────────
const schema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Max 100 characters"),
  initial: z.string().min(1, "Initial is required").max(10, "Max 10 characters").transform((v) => v.toUpperCase()),
  icon: z.string().min(1, "Icon symbol is required").max(50), // Tambahan field icon
});
type FormValues = z.infer<typeof schema>;

type SortKey = "name" | "initial" | "icon" | "createdAt";
type SortDir = "asc" | "desc";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Alert | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Alert | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "name", dir: "asc" });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });
  
  // Pantau perubahan input icon untuk preview real-time
  const watchedIcon = watch("icon");

  async function load() {
    setLoadingData(true);
    try {
      setAlerts(await getMasterList<Alert>("alerts"));
    } catch {
      toast.error("Failed to load alerts.");
    } finally {
      setLoadingData(false);
    }
  }
  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditTarget(null);
    reset({ name: "", initial: "", icon: "warning" }); // Default icon: warning
    setModalOpen(true);
  }

  function openEdit(a: Alert) {
    setEditTarget(a);
    // Mengamankan nilai icon jika data lama belum punya field icon
    reset({ name: a.name, initial: a.initial, icon: a.icon || "warning" });
    setModalOpen(true);
  }

  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      // Pastikan payload di-cast ke tipe yang benar jika schema tipe belum di-update
      const payload: any = {
        name: values.name.trim(),
        initial: values.initial.trim().toUpperCase(),
        icon: values.icon.trim().toLowerCase(),
      };
      if (editTarget) {
        await updateMasterItem<Alert>("alerts", editTarget.id, payload);
        toast.success(`"${payload.name}" updated.`);
      } else {
        await createMasterItem<Alert>("alerts", payload);
        toast.success(`"${payload.name}" added.`);
      }
      setModalOpen(false);
      await load();
    } catch {
      toast.error("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMasterItem("alerts", deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error("Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  function toggleSort(key: SortKey) {
    setSort((prev) => prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  }

  const displayed = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = q ? alerts.filter((a) => a.name.toLowerCase().includes(q) || a.initial.toLowerCase().includes(q)) : alerts;
    return [...filtered].sort((a, b) => {
      const av = ((a as any)[sort.key] ?? "") as string;
      const bv = ((b as any)[sort.key] ?? "") as string;
      return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [alerts, search, sort]);

  function SortIcon({ col }: { col: SortKey }) {
    if (sort.key !== col) return <ChevronsUpDown size={12} className="text-slate-600" />;
    return sort.dir === "asc" ? <ChevronUp size={12} className="text-yellow-400" /> : <ChevronDown size={12} className="text-yellow-400" />;
  }

  const cols: { key: SortKey | null; label: string; w: string }[] = [
    { key: "icon", label: "Symbol", w: "w-20" },
    { key: "name", label: "Name", w: "" },
    { key: "initial", label: "Initial", w: "w-32" },
    { key: "createdAt", label: "Created", w: "w-32" },
    { key: null, label: "", w: "w-20" },
  ];

  return (
    <RouteGuard requiredPage="master-data">
      <div className="animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Alerts & Warnings</h1>
            <p className="page-subtitle">{loadingData ? "Loading…" : `${alerts.length} record${alerts.length !== 1 ? "s" : ""}`}</p>
          </div>
          <button onClick={openAdd} className="btn-primary"><Plus size={15} /> Add Alert</button>
        </div>

        <div className="mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or initial…" className="max-w-sm" />
        </div>

        <div className="card overflow-hidden">
          {loadingData ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <span className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-400 text-sm">Loading alerts…</span>
            </div>
          ) : displayed.length === 0 ? (
            <EmptyState Icon={BellRing} title={search ? "No results found" : "No alerts yet"} description={search ? "Try a different search term." : "Add your first alert warning."} action={!search ? (<button onClick={openAdd} className="btn-primary"><Plus size={14} /> Add Alert</button>) : undefined} />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    {cols.map(({ key, label, w }) => (
                      <th key={label || "_actions"} className={w}>
                        {key ? (<button onClick={() => toggleSort(key)} className="flex items-center gap-1.5 hover:text-white transition-colors">{label} <SortIcon col={key} /></button>) : label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((a) => (
                    <tr key={a.id}>
                      {/* Render Google Symbol */}
                      <td>
                        <div className="w-10 h-10 rounded-lg bg-yellow-600/10 border border-yellow-600/20 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-yellow-400 text-[20px]">
                            {a.icon || "warning"}
                          </span>
                        </div>
                      </td>
                      <td><p className="text-white font-medium text-sm">{a.name}</p></td>
                      <td><span className="badge bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-mono">{a.initial}</span></td>
                      <td className="text-slate-500 text-xs">{new Date(a.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td>
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEdit(a)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors" title="Edit"><Pencil size={14} /></button>
                          <button onClick={() => setDeleteTarget(a)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? "Edit Alert" : "Add Alert"} description={editTarget ? `Editing: ${editTarget.name}` : "Define a new warning or alert."} size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          
          {/* Row: Name & Initial */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="form-label">Name <span className="text-red-400">*</span></label>
              <input {...register("name")} placeholder="Fragile" className={cn("input-base", errors.name && "border-red-500")} />
              {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
            </div>
            <div>
              <label className="form-label">Initial <span className="text-red-400">*</span></label>
              <input {...register("initial")} placeholder="FRG" maxLength={10} className={cn("input-base uppercase", errors.initial && "border-red-500")} style={{ textTransform: "uppercase" }} />
              {errors.initial && <p className="mt-1 text-xs text-red-400">{errors.initial.message}</p>}
            </div>
          </div>

          {/* Icon Selection */}
          <div className="pt-2 border-t border-slate-800/50">
            <label className="form-label mb-2">Google Symbol Icon <span className="text-red-400">*</span></label>
            <div className="flex gap-3">
              {/* Preview Box */}
              <div className="w-12 h-12 shrink-0 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                 <span className="material-symbols-outlined text-yellow-400 text-2xl">
                   {watchedIcon || "help"}
                 </span>
              </div>
              
              <div className="flex-1">
                <input {...register("icon")} placeholder="warning" className={cn("input-base mb-2", errors.icon && "border-red-500")} />
                
                {/* Preset Buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {SYMBOL_PRESETS.map((iconName) => (
                    <button
                      key={iconName}
                      type="button"
                      title={iconName}
                      onClick={() => setValue("icon", iconName, { shouldValidate: true })}
                      className={cn(
                        "w-8 h-8 rounded border flex items-center justify-center transition-colors",
                        watchedIcon === iconName
                          ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-400"
                          : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500"
                      )}
                    >
                      <span className="material-symbols-outlined text-[18px]">{iconName}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {errors.icon && <p className="mt-1 text-xs text-red-400">{errors.icon.message}</p>}
            <p className="mt-2 text-[11px] text-slate-500">
              Select a preset or type a valid <a href="https://fonts.google.com/icons" target="_blank" className="text-brand-400 hover:underline">Google Material Symbol</a> name.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />} {editTarget ? "Save Changes" : "Add Alert"}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={onDelete} loading={deleting} title="Delete Alert" message={`Are you sure you want to delete "${deleteTarget?.name}"?`} confirmLabel="Delete Alert" />
    </RouteGuard>
  );
}