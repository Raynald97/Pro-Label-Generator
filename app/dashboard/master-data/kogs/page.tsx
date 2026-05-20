"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Tag, CheckCircle2,
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
import type { KoG, KoGFormData } from "@/types";
import { cn } from "@/lib/utils";

// --- VALIDATION SCHEMA --------------------------------------------------------

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
  isTempered: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

// --- SORT TYPES ---------------------------------------------------------------

type SortKey = "name" | "initial" | "isTempered" | "createdAt";
type SortDir = "asc" | "desc";

// --- PAGE ---------------------------------------------------------------------

export default function KoGPage() {
  const [kogs, setKogs] = useState<KoG[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<KoG | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KoG | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "name", dir: "asc" });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // -- Load -------------------------------------------------------------------
  async function load() {
    setLoadingData(true);
    try {
      setKogs(await getMasterList<KoG>("kogs"));
    } catch {
      toast.error("Failed to load KoG data.");
    } finally {
      setLoadingData(false);
    }
  }
  useEffect(() => { load(); }, []);

  // -- Open add --------------------------------------------------------------
  function openAdd() {
    setEditTarget(null);
    reset({ name: "", initial: "", isTempered: false });
    setModalOpen(true);
  }

  // -- Open edit -------------------------------------------------------------
  function openEdit(k: KoG) {
    setEditTarget(k);
    reset({
      name: k.name,
      initial: k.initial,
      isTempered: k.isTempered ?? false,
    });
    setModalOpen(true);
  }

  // -- Save ------------------------------------------------------------------
  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      const payload: KoGFormData = {
        name: values.name.trim(),
        initial: values.initial.trim().toUpperCase(),
        isTempered: values.isTempered,
      };

      if (editTarget) {
        // Tambahkan 'as any' pada payload
        await updateMasterItem<KoG>("kogs", editTarget.id, payload as any);
        toast.success(`"${payload.name}" updated.`);
      } else {
        // Tambahkan 'as any' pada payload
        await createMasterItem<KoG>("kogs", payload as any);
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

  // -- Delete -----------------------------------------------------------------
  async function onDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMasterItem("kogs", deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error("Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  // -- Sort toggle ------------------------------------------------------------
  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  // -- Filtered + sorted -----------------------------------------------------
  const displayed = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = q
      ? kogs.filter(
          (k) =>
            k.name.toLowerCase().includes(q) ||
            k.initial.toLowerCase().includes(q)
        )
      : kogs;

    return [...filtered].sort((a, b) => {
      let av: any = a[sort.key];
      let bv: any = b[sort.key];

      // Handle boolean sorting
      if (sort.key === "isTempered") {
        av = av ? 1 : 0;
        bv = bv ? 1 : 0;
        return sort.dir === "asc" ? av - bv : bv - av;
      }

      // Handle string sorting
      av = (av ?? "") as string;
      bv = (bv ?? "") as string;
      return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [kogs, search, sort]);

  // --- SORT ICON ------------------------------------------------------------
  function SortIcon({ col }: { col: SortKey }) {
    if (sort.key !== col) return <ChevronsUpDown size={12} className="text-slate-600" />;
    return sort.dir === "asc"
      ? <ChevronUp size={12} className="text-brand-400" />
      : <ChevronDown size={12} className="text-brand-400" />;
  }

  // --- TABLE COLUMN DEFS ----------------------------------------------------
  const cols: { key: SortKey | null; label: string; w: string }[] = [
    { key: "name", label: "Name", w: "" },
    { key: "initial", label: "Initial", w: "w-32" },
    { key: "isTempered", label: "Tempered", w: "w-32" },
    { key: "createdAt", label: "Created", w: "w-36" },
    { key: null, label: "", w: "w-20" },
  ];

  // --- RENDER ---------------------------------------------------------------
  return (
    <RouteGuard requiredPage="master-data">
      <div className="animate-fade-in">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Kind of Glass (KoG)</h1>
            <p className="page-subtitle">
              {loadingData ? "Loading…" : `${kogs.length} record${kogs.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button onClick={openAdd} className="btn-primary">
            <Plus size={15} /> Add KoG
          </button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name or initial…"
            className="max-w-sm"
          />
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {loadingData ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <span className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-400 text-sm">Loading KoG…</span>
            </div>
          ) : displayed.length === 0 ? (
            <EmptyState
              Icon={Tag}
              title={search ? "No results found" : "No KoG types yet"}
              description={
                search
                  ? "Try a different search term."
                  : "Add your first Kind of Glass to get started."
              }
              action={
                !search ? (
                  <button onClick={openAdd} className="btn-primary">
                    <Plus size={14} /> Add KoG
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
                  {displayed.map((k) => (
                    <tr key={k.id}>
                      {/* Name */}
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-violet-600/10 border border-violet-600/20 flex items-center justify-center shrink-0">
                            <span className="text-violet-400 text-xs font-bold">
                              {k.initial.slice(0, 2)}
                            </span>
                          </div>
                          <p className="text-white font-medium text-sm">{k.name}</p>
                        </div>
                      </td>

                      {/* Initial */}
                      <td>
                        <span className="badge bg-violet-500/10 text-violet-400 border border-violet-500/20 font-mono">
                          {k.initial}
                        </span>
                      </td>

                      {/* Tempered Status */}
                      <td>
                        {k.isTempered ? (
                          <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                            <CheckCircle2 size={14} />
                            Yes
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">—</span>
                        )}
                      </td>

                      {/* Created */}
                      <td className="text-slate-500 text-xs">
                        {new Date(k.createdAt).toLocaleDateString("id-ID", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => openEdit(k)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(k)}
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
            {displayed.length} of {kogs.length} results
          </p>
        )}
      </div>

      {/* -- ADD / EDIT MODAL ---------------------------------------------------- */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? "Edit KoG" : "Add Kind of Glass"}
        description={
          editTarget
            ? `Editing: ${editTarget.name}`
            : "Define a new Kind of Glass (KoG)."
        }
        size="sm"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Name */}
          <div>
            <label className="form-label">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              {...register("name")}
              placeholder="Tempered Laminated"
              className={cn("input-base", errors.name && "border-red-500")}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>
            )}
          </div>

          {/* Initial */}
          <div>
            <label className="form-label">
              Initial <span className="text-red-400">*</span>
            </label>
            <input
              {...register("initial")}
              placeholder="TL"
              maxLength={10}
              className={cn("input-base uppercase", errors.initial && "border-red-500")}
              style={{ textTransform: "uppercase" }}
            />
            {errors.initial && (
              <p className="mt-1 text-xs text-red-400">{errors.initial.message}</p>
            )}
          </div>

          {/* Tempered Toggle */}
          <div className="flex items-center gap-3 pt-2 pb-1">
            <input
              type="checkbox"
              id="isTempered"
              {...register("isTempered")}
              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-brand-600 focus:ring-brand-500 focus:ring-offset-slate-900 cursor-pointer"
            />
            <label htmlFor="isTempered" className="text-sm text-slate-300 cursor-pointer select-none">
              Is this a Tempered glass type?
            </label>
          </div>

          {/* Read-only ID when editing */}
          {editTarget && (
            <div className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 mt-2">
              <p className="text-slate-500 text-xs">
                <span className="text-slate-600">ID: </span>
                <span className="font-mono">{editTarget.id}</span>
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving && (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {editTarget ? "Save Changes" : "Add KoG"}
            </button>
          </div>
        </form>
      </Modal>

      {/* -- DELETE CONFIRM ------------------------------------------------------ */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onDelete}
        loading={deleting}
        title="Delete KoG"
        message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        confirmLabel="Delete KoG"
      />
    </RouteGuard>
  );
}