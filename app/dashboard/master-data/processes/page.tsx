"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Cpu,
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
import type { Process, ProcessFormData } from "@/types";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Max 100 characters"),
  initial: z.string().min(1, "Initial is required").max(10, "Max 10 characters").transform((v) => v.toUpperCase()),
});
type FormValues = z.infer<typeof schema>;

type SortKey = "name" | "initial" | "createdAt";
type SortDir = "asc" | "desc";

export default function ProcessesPage() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Process | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Process | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "name", dir: "asc" });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function load() {
    setLoadingData(true);
    try {
      setProcesses(await getMasterList<Process>("processes"));
    } catch {
      toast.error("Failed to load processes.");
    } finally {
      setLoadingData(false);
    }
  }
  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditTarget(null);
    reset({ name: "", initial: "" });
    setModalOpen(true);
  }

  function openEdit(p: Process) {
    setEditTarget(p);
    reset({ name: p.name, initial: p.initial });
    setModalOpen(true);
  }

  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      const payload: ProcessFormData = {
        name: values.name.trim(),
        initial: values.initial.trim().toUpperCase(),
      };
      if (editTarget) {
        await updateMasterItem<Process>("processes", editTarget.id, payload);
        toast.success(`"${payload.name}" updated.`);
      } else {
        await createMasterItem<Process>("processes", payload);
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
      await deleteMasterItem("processes", deleteTarget.id);
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
    const filtered = q ? processes.filter((p) => p.name.toLowerCase().includes(q) || p.initial.toLowerCase().includes(q)) : processes;
    return [...filtered].sort((a, b) => {
      const av = (a[sort.key] ?? "") as string;
      const bv = (b[sort.key] ?? "") as string;
      return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [processes, search, sort]);

  function SortIcon({ col }: { col: SortKey }) {
    if (sort.key !== col) return <ChevronsUpDown size={12} className="text-slate-600" />;
    return sort.dir === "asc" ? <ChevronUp size={12} className="text-orange-400" /> : <ChevronDown size={12} className="text-orange-400" />;
  }

  const cols: { key: SortKey | null; label: string; w: string }[] = [
    { key: "name", label: "Name", w: "" },
    { key: "initial", label: "Initial", w: "w-36" },
    { key: "createdAt", label: "Created", w: "w-36" },
    { key: null, label: "", w: "w-20" },
  ];

  return (
    <RouteGuard requiredPage="master-data">
      <div className="animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Processes</h1>
            <p className="page-subtitle">{loadingData ? "Loading…" : `${processes.length} record${processes.length !== 1 ? "s" : ""}`}</p>
          </div>
          <button onClick={openAdd} className="btn-primary"><Plus size={15} /> Add Process</button>
        </div>

        <div className="mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or initial…" className="max-w-sm" />
        </div>

        <div className="card overflow-hidden">
          {loadingData ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <span className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-400 text-sm">Loading processes…</span>
            </div>
          ) : displayed.length === 0 ? (
            <EmptyState Icon={Cpu} title={search ? "No results found" : "No processes yet"} description={search ? "Try a different search term." : "Add your first production process."} action={!search ? (<button onClick={openAdd} className="btn-primary"><Plus size={14} /> Add Process</button>) : undefined} />
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
                  {displayed.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-orange-600/10 border border-orange-600/20 flex items-center justify-center shrink-0">
                            <span className="text-orange-400 text-xs font-bold">{p.initial.slice(0, 2)}</span>
                          </div>
                          <p className="text-white font-medium text-sm">{p.name}</p>
                        </div>
                      </td>
                      <td><span className="badge bg-orange-500/10 text-orange-400 border border-orange-500/20 font-mono">{p.initial}</span></td>
                      <td className="text-slate-500 text-xs">{new Date(p.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td>
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEdit(p)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors" title="Edit"><Pencil size={14} /></button>
                          <button onClick={() => setDeleteTarget(p)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete"><Trash2 size={14} /></button>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? "Edit Process" : "Add Process"} description={editTarget ? `Editing: ${editTarget.name}` : "Define a new production process."} size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label className="form-label">Name <span className="text-red-400">*</span></label>
            <input {...register("name")} placeholder="Tempering" className={cn("input-base", errors.name && "border-red-500")} />
            {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
          </div>
          <div>
            <label className="form-label">Initial <span className="text-red-400">*</span></label>
            <input {...register("initial")} placeholder="TMP" maxLength={10} className={cn("input-base uppercase", errors.initial && "border-red-500")} style={{ textTransform: "uppercase" }} />
            {errors.initial && <p className="mt-1 text-xs text-red-400">{errors.initial.message}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />} {editTarget ? "Save Changes" : "Add Process"}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={onDelete} loading={deleting} title="Delete Process" message={`Are you sure you want to delete "${deleteTarget?.name}"?`} confirmLabel="Delete Process" />
    </RouteGuard>
  );
}