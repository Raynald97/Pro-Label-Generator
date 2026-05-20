"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, GitBranch, Search,
  CheckSquare, Square, ChevronUp, ChevronDown,
  ChevronsUpDown, AlertCircle, X, Check,
} from "lucide-react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { getMasterList } from "@/lib/master-data";
import {
  getFormulaProcesses,
  createFormulaProcess,
  updateFormulaProcess,
  deleteFormulaProcess,
} from "@/lib/master-data";
import type { FormulaProcess, KoG, Process } from "@/types";
import { cn } from "@/lib/utils";

// ─── SORT TYPES ───────────────────────────────────────────────────────────────

type SortKey = "kogName" | "kogInitial" | "updatedAt";
type SortDir = "asc" | "desc";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function FormulaProcessPage() {

  // ── Master data ────────────────────────────────────────────────────────────
  const [formulas,  setFormulas]  = useState<FormulaProcess[]>([]);
  const [kogs,      setKogs]      = useState<KoG[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading,   setLoading]   = useState(true);

  // ── Modal / confirm state ──────────────────────────────────────────────────
  const [modalOpen,     setModalOpen]     = useState(false);
  const [editTarget,    setEditTarget]    = useState<FormulaProcess | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<FormulaProcess | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  // ── Form state (controlled — no react-hook-form needed for this UI) ────────
  const [selectedKogId,    setSelectedKogId]    = useState<string>("");
  const [selectedProcessIds, setSelectedProcessIds] = useState<Set<string>>(new Set());
  const [kogSearch,        setKogSearch]        = useState("");
  const [processSearch,    setProcessSearch]    = useState("");
  const [formError,        setFormError]        = useState<string | null>(null);

  // ── Table search & sort ────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [sort,   setSort]   = useState<{ key: SortKey; dir: SortDir }>({ key: "kogName", dir: "asc" });

  // ── Load all data in parallel ──────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, k, p] = await Promise.all([
        getFormulaProcesses(),
        getMasterList<KoG>("kogs"),
        getMasterList<Process>("processes"),
      ]);
      setFormulas(f);
      setKogs(k);
      setProcesses(p);
    } catch {
      toast.error("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── KoGs that already have a formula (used to block re-selection) ──────────
  const usedKogIds = useMemo(
    () => new Set(formulas.map((f) => f.kogId)),
    [formulas]
  );

  // ── KoG options for the modal dropdown ────────────────────────────────────
  // When editing, the current KoG is always available; all others that are
  // already mapped are greyed out and non-selectable.
  const kogOptions = useMemo(() => {
    const q = kogSearch.toLowerCase();
    return kogs.filter(
      (k) => !q || k.name.toLowerCase().includes(q) || k.initial.toLowerCase().includes(q)
    );
  }, [kogs, kogSearch]);

  // ── Process options for the checklist ─────────────────────────────────────
  const processOptions = useMemo(() => {
    const q = processSearch.toLowerCase();
    return processes.filter(
      (p) => !q || p.name.toLowerCase().includes(q) || p.initial.toLowerCase().includes(q)
    );
  }, [processes, processSearch]);

  // ── Open add modal ─────────────────────────────────────────────────────────
  function openAdd() {
    setEditTarget(null);
    setSelectedKogId("");
    setSelectedProcessIds(new Set());
    setKogSearch("");
    setProcessSearch("");
    setFormError(null);
    setModalOpen(true);
  }

  // ── Open edit modal ────────────────────────────────────────────────────────
  function openEdit(f: FormulaProcess) {
    setEditTarget(f);
    setSelectedKogId(f.kogId);
    setSelectedProcessIds(new Set(f.processIds));
    setKogSearch("");
    setProcessSearch("");
    setFormError(null);
    setModalOpen(true);
  }

  // ── Process checklist toggle ───────────────────────────────────────────────
  function toggleProcess(pid: string) {
    setSelectedProcessIds((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  }

  function selectAll() {
    setSelectedProcessIds(new Set(processOptions.map((p) => p.id)));
  }

  function clearAll() {
    setSelectedProcessIds(new Set());
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function onSave() {
    setFormError(null);

    if (!selectedKogId) {
      setFormError("Please select a KoG.");
      return;
    }
    if (selectedProcessIds.size === 0) {
      setFormError("Please select at least one process.");
      return;
    }

    // Guard: duplicate KoG (can't happen on edit but check on create)
    if (!editTarget && usedKogIds.has(selectedKogId)) {
      setFormError("This KoG already has a formula. Edit the existing one instead.");
      return;
    }

    setSaving(true);
    try {
      const formData = {
        kogId:      selectedKogId,
        processIds: Array.from(selectedProcessIds),
      };

      if (editTarget) {
        await updateFormulaProcess(editTarget.id, formData, kogs, processes);
        toast.success("Formula updated.");
      } else {
        await createFormulaProcess(formData, kogs, processes);
        toast.success("Formula created.");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function onDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteFormulaProcess(deleteTarget.id);
      toast.success(`Formula for "${deleteTarget.kogName}" deleted.`);
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

  // ── Filtered + sorted table data ───────────────────────────────────────────
  const displayed = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = q
      ? formulas.filter(
          (f) =>
            f.kogName.toLowerCase().includes(q) ||
            f.kogInitial.toLowerCase().includes(q) ||
            f.processSnapshots.some((p) => p.name.toLowerCase().includes(q))
        )
      : formulas;

    return [...filtered].sort((a, b) => {
      const av = (a[sort.key] ?? "") as string;
      const bv = (b[sort.key] ?? "") as string;
      return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [formulas, search, sort]);

  // ─── DERIVED: selected KoG object ─────────────────────────────────────────
  const selectedKog = kogs.find((k) => k.id === selectedKogId) ?? null;

  // ─── SORT ICON ────────────────────────────────────────────────────────────
  function SortIcon({ col }: { col: SortKey }) {
    if (sort.key !== col) return <ChevronsUpDown size={12} className="text-slate-600" />;
    return sort.dir === "asc"
      ? <ChevronUp   size={12} className="text-brand-400" />
      : <ChevronDown size={12} className="text-brand-400" />;
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <RouteGuard requiredPage="formula-process">
      <div className="animate-fade-in">

        {/* ── PAGE HEADER ───────────────────────────────────────────────────── */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Formula Process</h1>
            <p className="page-subtitle">
              {loading
                ? "Loading…"
                : `${formulas.length} mapping${formulas.length !== 1 ? "s" : ""} · ${kogs.length - formulas.length} KoG${kogs.length - formulas.length !== 1 ? "s" : ""} unmapped`}
            </p>
          </div>
          <button
            onClick={openAdd}
            disabled={kogs.length === 0 || processes.length === 0 || usedKogIds.size === kogs.length}
            className="btn-primary"
            title={
              usedKogIds.size === kogs.length
                ? "All KoGs already have a formula"
                : undefined
            }
          >
            <Plus size={15} /> Add Formula
          </button>
        </div>

        {/* ── PREREQ WARNING ────────────────────────────────────────────────── */}
        {!loading && (kogs.length === 0 || processes.length === 0) && (
          <div className="flex items-start gap-3 px-4 py-3 mb-5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>
              {kogs.length === 0 && processes.length === 0
                ? "Add KoG and Process records in Master Data before creating formulas."
                : kogs.length === 0
                ? "Add at least one KoG in Master Data before creating formulas."
                : "Add at least one Process in Master Data before creating formulas."}
            </span>
          </div>
        )}

        {/* ── SEARCH ────────────────────────────────────────────────────────── */}
        <div className="mb-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by KoG name or process…"
            className="max-w-sm"
          />
        </div>

        {/* ── TABLE ─────────────────────────────────────────────────────────── */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <span className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-400 text-sm">Loading formulas…</span>
            </div>
          ) : displayed.length === 0 ? (
            <EmptyState
              Icon={GitBranch}
              title={search ? "No results found" : "No formulas yet"}
              description={
                search
                  ? "Try a different search term."
                  : "Create your first formula to auto-check processes when a KoG is selected in Production."
              }
              action={
                !search && kogs.length > 0 && processes.length > 0 ? (
                  <button onClick={openAdd} className="btn-primary">
                    <Plus size={14} /> Add Formula
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    {/* KoG */}
                    <th>
                      <button
                        onClick={() => toggleSort("kogName")}
                        className="flex items-center gap-1.5 hover:text-white transition-colors"
                      >
                        KoG <SortIcon col="kogName" />
                      </button>
                    </th>
                    {/* Processes */}
                    <th>Mapped Processes</th>
                    {/* Count */}
                    <th className="w-24 text-center">Count</th>
                    {/* Updated */}
                    <th className="w-36">
                      <button
                        onClick={() => toggleSort("updatedAt")}
                        className="flex items-center gap-1.5 hover:text-white transition-colors"
                      >
                        Updated <SortIcon col="updatedAt" />
                      </button>
                    </th>
                    {/* Actions */}
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((f) => (
                    <tr key={f.id}>
                      {/* KoG cell */}
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-violet-600/10 border border-violet-600/20 flex items-center justify-center shrink-0">
                            <span className="text-violet-400 text-xs font-bold">
                              {f.kogInitial.slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm">{f.kogName}</p>
                            <p className="text-slate-500 text-xs font-mono">{f.kogInitial}</p>
                          </div>
                        </div>
                      </td>

                      {/* Processes — badge pills */}
                      <td>
                        <div className="flex flex-wrap gap-1.5">
                          {f.processSnapshots.map((ps) => (
                            <span
                              key={ps.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                              title={ps.name}
                            >
                              <Check size={10} />
                              {ps.name}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Count */}
                      <td className="text-center">
                        <span className="badge badge-slate tabular-nums">
                          {f.processIds.length}
                        </span>
                      </td>

                      {/* Updated */}
                      <td className="text-slate-500 text-xs">{fmtDate(f.updatedAt)}</td>

                      {/* Actions */}
                      <td>
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => openEdit(f)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(f)}
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
        {search && !loading && (
          <p className="text-slate-500 text-xs mt-3">
            {displayed.length} of {formulas.length} results
          </p>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ADD / EDIT MODAL
          Two-column layout: KoG selector (left) | Process checklist (right)
          ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? "Edit Formula" : "Add Formula"}
        description={
          editTarget
            ? `Editing mapping for: ${editTarget.kogName}`
            : "Select a KoG, then check which processes should be auto-applied."
        }
        size="lg"
      >
        <div className="space-y-5">

          {/* ── FORM ERROR BANNER ─────────────────────────────────────────────── */}
          {formError && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* ── TWO COLUMN BODY ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* ┌─────────────────────────────────────────────────────────────┐
                │  LEFT — KoG SELECTOR                                        │
                └─────────────────────────────────────────────────────────────┘ */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="form-label">
                  Kind of Glass (KoG) <span className="text-red-400">*</span>
                </label>

                {/* Search within the KoG list */}
                <div className="relative mb-2">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    value={kogSearch}
                    onChange={(e) => setKogSearch(e.target.value)}
                    placeholder="Filter KoG…"
                    className="input-base pl-9 h-9 text-sm"
                  />
                  {kogSearch && (
                    <button
                      onClick={() => setKogSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* KoG list */}
                <div className="border border-slate-700 rounded-lg overflow-hidden">
                  <div className="max-h-[260px] overflow-y-auto divide-y divide-slate-800">
                    {kogOptions.length === 0 ? (
                      <p className="py-6 text-center text-slate-500 text-sm">No KoG found.</p>
                    ) : (
                      kogOptions.map((k) => {
                        const isMapped    = usedKogIds.has(k.id) && k.id !== editTarget?.kogId;
                        const isSelected  = selectedKogId === k.id;

                        return (
                          <button
                            key={k.id}
                            type="button"
                            disabled={isMapped}
                            onClick={() => {
                              if (!isMapped) setSelectedKogId(k.id);
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                              isSelected
                                ? "bg-violet-600/20 text-white"
                                : isMapped
                                ? "opacity-40 cursor-not-allowed bg-transparent"
                                : "hover:bg-slate-800 text-slate-300"
                            )}
                          >
                            {/* Selection indicator */}
                            <div className={cn(
                              "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                              isSelected
                                ? "border-violet-400 bg-violet-400"
                                : "border-slate-600"
                            )}>
                              {isSelected && <Check size={10} className="text-white" />}
                            </div>

                            {/* Avatar + name */}
                            <div className="w-7 h-7 rounded-md bg-violet-600/10 border border-violet-600/20 flex items-center justify-center shrink-0">
                              <span className="text-violet-400 text-[10px] font-bold">
                                {k.initial.slice(0, 2)}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{k.name}</p>
                              <p className="text-xs text-slate-500 font-mono">{k.initial}</p>
                            </div>

                            {/* "mapped" badge */}
                            {isMapped && (
                              <span className="text-[10px] text-slate-500 border border-slate-700 rounded px-1.5 py-0.5 shrink-0">
                                mapped
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Selected KoG summary */}
                {selectedKog && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                    <Check size={12} className="text-violet-400" />
                    Selected:
                    <span className="text-white font-medium">{selectedKog.name}</span>
                    <span className="font-mono text-violet-400">{selectedKog.initial}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ┌─────────────────────────────────────────────────────────────┐
                │  RIGHT — PROCESS CHECKLIST                                   │
                └─────────────────────────────────────────────────────────────┘ */}
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="form-label mb-0">
                    Processes <span className="text-red-400">*</span>
                    <span className="ml-2 text-slate-500 normal-case font-normal tracking-normal">
                      ({selectedProcessIds.size} selected)
                    </span>
                  </label>
                  {/* Bulk actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAll}
                      className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      All
                    </button>
                    <span className="text-slate-700">·</span>
                    <button
                      type="button"
                      onClick={clearAll}
                      className="text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Search within processes */}
                <div className="relative mb-2">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    value={processSearch}
                    onChange={(e) => setProcessSearch(e.target.value)}
                    placeholder="Filter processes…"
                    className="input-base pl-9 h-9 text-sm"
                  />
                  {processSearch && (
                    <button
                      onClick={() => setProcessSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Process checklist */}
                <div className="border border-slate-700 rounded-lg overflow-hidden">
                  <div className="max-h-[260px] overflow-y-auto divide-y divide-slate-800">
                    {processOptions.length === 0 ? (
                      <p className="py-6 text-center text-slate-500 text-sm">No processes found.</p>
                    ) : (
                      processOptions.map((p) => {
                        const isChecked = selectedProcessIds.has(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleProcess(p.id)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                              isChecked
                                ? "bg-emerald-600/10 text-white"
                                : "hover:bg-slate-800 text-slate-300"
                            )}
                          >
                            {/* Checkbox icon */}
                            {isChecked
                              ? <CheckSquare size={16} className="text-emerald-400 shrink-0" />
                              : <Square      size={16} className="text-slate-600 shrink-0" />}

                            {/* Avatar */}
                            <div className={cn(
                              "w-7 h-7 rounded-md border flex items-center justify-center shrink-0",
                              isChecked
                                ? "bg-emerald-600/10 border-emerald-600/20"
                                : "bg-slate-800 border-slate-700"
                            )}>
                              <span className={cn(
                                "text-[10px] font-bold",
                                isChecked ? "text-emerald-400" : "text-slate-500"
                              )}>
                                {p.initial.slice(0, 2)}
                              </span>
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{p.name}</p>
                              <p className="text-xs text-slate-500 font-mono">{p.initial}</p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── SUMMARY PREVIEW ───────────────────────────────────────────────── */}
          {selectedKog && selectedProcessIds.size > 0 && (
            <div className="rounded-lg border border-slate-700/60 bg-slate-800/30 p-3">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                Formula Preview
              </p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="badge bg-violet-500/10 border border-violet-500/20 text-violet-300 font-medium">
                  {selectedKog.name}
                </span>
                <span className="text-slate-600">→</span>
                {Array.from(selectedProcessIds).map((pid) => {
                  const proc = processes.find((p) => p.id === pid);
                  return proc ? (
                    <span
                      key={pid}
                      className="badge bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                    >
                      {proc.name}
                    </span>
                  ) : null;
                })}
              </div>
              <p className="text-slate-600 text-xs mt-2">
                In Production, selecting <strong className="text-slate-400">{selectedKog.name}</strong> as KoG
                will automatically check{" "}
                <strong className="text-slate-400">{selectedProcessIds.size} process{selectedProcessIds.size !== 1 ? "es" : ""}</strong>.
                The operator can still override manually.
              </p>
            </div>
          )}

          {/* ── ACTIONS ───────────────────────────────────────────────────────── */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !selectedKogId || selectedProcessIds.size === 0}
              className="btn-primary"
            >
              {saving && (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {editTarget ? "Save Changes" : "Create Formula"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── DELETE CONFIRM ────────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onDelete}
        loading={deleting}
        title="Delete Formula"
        message={`Delete the formula for "${deleteTarget?.kogName}"? Production will no longer auto-check processes when this KoG is selected.`}
        confirmLabel="Delete Formula"
      />
    </RouteGuard>
  );
}
