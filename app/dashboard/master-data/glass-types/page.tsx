"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Layers, Palette,
  ChevronUp, ChevronDown, ChevronsUpDown, Ruler,
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
import type { GlassType, GlassTypeFormData } from "@/types";
import { cn } from "@/lib/utils";

// ─── VALIDATION SCHEMA ────────────────────────────────────────────────────────

const schema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Max 100 characters"),
  initial: z
    .string()
    .min(1, "Initial is required")
    .max(10, "Max 10 characters")
    .transform((v) => v.toUpperCase()),
  color: z
    .string()
    .max(50, "Max 50 characters")
    .optional()
    .or(z.literal("")),
  thickness: z
    .union([
      z.number({ invalid_type_error: "Must be a number" })
        .positive("Must be greater than 0")
        .max(200, "Max 200 mm"),
      z.nan(),
    ])
    .optional(),
});
type FormValues = z.infer<typeof schema>;

// ─── SORT TYPES ───────────────────────────────────────────────────────────────

type SortKey = "name" | "initial" | "color" | "createdAt";
type SortDir = "asc" | "desc";

// ─── GLASS COLOR SWATCHES ─────────────────────────────────────────────────────
// Pre-defined common glass tint names for quick selection
const COLOR_PRESETS = ["Clear", "Bronze", "Grey", "Green", "Blue", "Dark Grey", "Extra Clear"];

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function GlassTypesPage() {
  const [glassTypes, setGlassTypes]   = useState<GlassType[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [modalOpen, setModalOpen]       = useState(false);
  const [editTarget, setEditTarget]     = useState<GlassType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GlassType | null>(null);
  const [saving, setSaving]             = useState(false);
  const [deleting, setDeleting]         = useState(false);

  const [search, setSearch] = useState("");
  const [sort, setSort]     = useState<{ key: SortKey; dir: SortDir }>({ key: "name", dir: "asc" });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const watchedColor = watch("color");

  // ── Load ───────────────────────────────────────────────────────────────────
  async function load() {
    setLoadingData(true);
    try {
      setGlassTypes(await getMasterList<GlassType>("glassTypes"));
    } catch {
      toast.error("Failed to load glass types.");
    } finally {
      setLoadingData(false);
    }
  }
  useEffect(() => { load(); }, []);

  // ── Open add ──────────────────────────────────────────────────────────────
  function openAdd() {
    setEditTarget(null);
    reset({ name: "", initial: "", color: "", thickness: undefined });
    setModalOpen(true);
  }

  // ── Open edit ─────────────────────────────────────────────────────────────
  function openEdit(g: GlassType) {
    setEditTarget(g);
    reset({
      name:      g.name,
      initial:   g.initial,
      color:     g.color     ?? "",
      thickness: g.thickness ?? undefined,
    });
    setModalOpen(true);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      const thicknessVal = typeof values.thickness === "number" && !isNaN(values.thickness)
        ? values.thickness
        : undefined;

      const payload: GlassTypeFormData = {
        name:      values.name.trim(),
        initial:   values.initial.trim().toUpperCase(),
        color:     values.color?.trim()  || undefined,
        thickness: thicknessVal,
      };

      if (editTarget) {
        await updateMasterItem<GlassType>("glassTypes", editTarget.id, payload);
        toast.success(`"${payload.name}" updated.`);
      } else {
        await createMasterItem<GlassType>("glassTypes", payload);
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

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function onDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMasterItem("glassTypes", deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error("Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Sort toggle ────────────────────────────────────────────────────────────
  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  // ── Filtered + sorted ─────────────────────────────────────────────────────
  const displayed = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = q
      ? glassTypes.filter(
          (g) =>
            g.name.toLowerCase().includes(q) ||
            g.initial.toLowerCase().includes(q) ||
            (g.color ?? "").toLowerCase().includes(q)
        )
      : glassTypes;

    return [...filtered].sort((a, b) => {
      const av = (a[sort.key] ?? "") as string;
      const bv = (b[sort.key] ?? "") as string;
      return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [glassTypes, search, sort]);

  // ─── SORT ICON ────────────────────────────────────────────────────────────
  function SortIcon({ col }: { col: SortKey }) {
    if (sort.key !== col) return <ChevronsUpDown size={12} className="text-slate-600" />;
    return sort.dir === "asc"
      ? <ChevronUp   size={12} className="text-brand-400" />
      : <ChevronDown size={12} className="text-brand-400" />;
  }

  // ─── TABLE COLUMN DEFS ────────────────────────────────────────────────────
  const cols: { key: SortKey | null; label: string; w: string }[] = [
    { key: "name",      label: "Name",      w: ""     },
    { key: "initial",   label: "Initial",   w: "w-28" },
    { key: "color",     label: "Color",     w: "w-36" },
    { key: null,        label: "Thickness", w: "w-32" },
    { key: "createdAt", label: "Created",   w: "w-36" },
    { key: null,        label: "",          w: "w-20" },
  ];

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <RouteGuard requiredPage="master-data">
      <div className="animate-fade-in">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Glass Types</h1>
            <p className="page-subtitle">
              {loadingData ? "Loading…" : `${glassTypes.length} record${glassTypes.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button onClick={openAdd} className="btn-primary">
            <Plus size={15} /> Add Glass Type
          </button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name, initial, or color…"
            className="max-w-sm"
          />
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {loadingData ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <span className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-400 text-sm">Loading glass types…</span>
            </div>
          ) : displayed.length === 0 ? (
            <EmptyState
              Icon={Layers}
              title={search ? "No results found" : "No glass types yet"}
              description={
                search
                  ? "Try a different search term."
                  : "Add your first glass type to get started."
              }
              action={
                !search ? (
                  <button onClick={openAdd} className="btn-primary">
                    <Plus size={14} /> Add Glass Type
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    {cols.map(({ key, label, w }) => (
                      <th key={label || "_actions"} className={w}>
                        {key ? (
                          <button
                            onClick={() => toggleSort(key)}
                            className="flex items-center gap-1.5 hover:text-white transition-colors"
                          >
                            {label} <SortIcon col={key} />
                          </button>
                        ) : label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((g) => (
                    <tr key={g.id}>
                      {/* Name */}
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-cyan-600/10 border border-cyan-600/20 flex items-center justify-center shrink-0">
                            <span className="text-cyan-400 text-xs font-bold">
                              {g.initial.slice(0, 2)}
                            </span>
                          </div>
                          <p className="text-white font-medium text-sm">{g.name}</p>
                        </div>
                      </td>

                      {/* Initial */}
                      <td>
                        <span className="badge bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                          {g.initial}
                        </span>
                      </td>

                      {/* Color */}
                      <td>
                        {g.color ? (
                          <span className="flex items-center gap-1.5 text-slate-300 text-sm">
                            <Palette size={12} className="text-slate-500 shrink-0" />
                            {g.color}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>

                      {/* Thickness */}
                      <td>
                        {g.thickness != null ? (
                          <span className="flex items-center gap-1.5 text-slate-300 text-sm">
                            <Ruler size={12} className="text-slate-500 shrink-0" />
                            <span className="font-mono">{g.thickness}</span>
                            <span className="text-slate-500 text-xs">mm</span>
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>

                      {/* Created */}
                      <td className="text-slate-500 text-xs">
                        {new Date(g.createdAt).toLocaleDateString("id-ID", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => openEdit(g)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(g)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Result count when searching */}
        {search && !loadingData && (
          <p className="text-slate-500 text-xs mt-3">
            {displayed.length} of {glassTypes.length} results
          </p>
        )}
      </div>

      {/* ── ADD / EDIT MODAL ──────────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? "Edit Glass Type" : "Add Glass Type"}
        description={
          editTarget
            ? `Editing: ${editTarget.name}`
            : "Fill in the glass type details below."
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>

          {/* Row 1: Name + Initial */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="form-label">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                {...register("name")}
                placeholder="Dark Green Tempered"
                className={cn("input-base", errors.name && "border-red-500")}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="form-label">
                Initial <span className="text-red-400">*</span>
              </label>
              <input
                {...register("initial")}
                placeholder="DG"
                maxLength={10}
                className={cn("input-base uppercase", errors.initial && "border-red-500")}
                style={{ textTransform: "uppercase" }}
              />
              {errors.initial && (
                <p className="mt-1 text-xs text-red-400">{errors.initial.message}</p>
              )}
            </div>
          </div>

          {/* Row 2: Color + Thickness */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Color</label>
              <div className="relative">
                <Palette size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  {...register("color")}
                  placeholder="Dark Green"
                  className="input-base pl-9"
                />
              </div>
              {/* Quick preset buttons */}
              <div className="flex flex-wrap gap-1 mt-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setValue("color", preset, { shouldValidate: true })}
                    className={cn(
                      "px-2 py-0.5 rounded text-[11px] font-medium border transition-colors",
                      watchedColor === preset
                        ? "bg-cyan-600/20 border-cyan-500/40 text-cyan-300"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600"
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="form-label">Thickness (mm)</label>
              <div className="relative">
                <Ruler size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  {...register("thickness", { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="6"
                  className={cn(
                    "input-base pl-9 pr-12 font-mono",
                    errors.thickness && "border-red-500"
                  )}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none">
                  mm
                </span>
              </div>
              {errors.thickness && (
                <p className="mt-1 text-xs text-red-400">{errors.thickness.message as string}</p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                Standard: 4, 5, 6, 8, 10, 12, 15, 19 mm
              </p>
            </div>
          </div>

          {/* Read-only ID when editing */}
          {editTarget && (
            <div className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <p className="text-slate-500 text-xs">
                <span className="text-slate-600">ID: </span>
                <span className="font-mono">{editTarget.id}</span>
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving && (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {editTarget ? "Save Changes" : "Add Glass Type"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── DELETE CONFIRM ────────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onDelete}
        loading={deleting}
        title="Delete Glass Type"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? Labels referencing this type may be affected.`}
        confirmLabel="Delete Glass Type"
      />
    </RouteGuard>
  );
}
