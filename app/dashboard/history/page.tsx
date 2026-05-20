"use client";

import {
  useState, useEffect, useCallback, useMemo, Suspense,
} from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  History, Printer, RefreshCw, ChevronDown,
  Search, X, FileText, Calendar, Hash,
  CheckCircle2, AlertTriangle, ChevronUp, ChevronsUpDown, Check,
  Trash2, ChevronLeft, ChevronRight
} from "lucide-react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PrintSheet } from "@/components/print/PrintSheet";
import { LabelCanvas } from "@/components/print/LabelCanvas";
import { useAuth } from "@/hooks/useAuth";
import { getLabelBatches, getBatchLabels, reprintExactLabels } from "@/lib/production";
import { getTemplate } from "@/lib/label-designer";
import { mm } from "@/lib/label-renderer";
import type {
  LabelBatch, LabelRecord, LabelTemplate, Process, LineItemRow,
} from "@/types";
import { cn } from "@/lib/utils";

// FIREBASE IMPORTS UNTUK FITUR DELETE ALL
import { db } from "@/lib/firebase";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";

// ════════════════════════════════════════════════════════════════════════════
// HELPERS & BADGE
// ════════════════════════════════════════════════════════════════════════════

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function StatusBadge({ status }: { status: LabelBatch["status"] }) {
  return status === "generated" ? (
    <span className="badge bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 gap-1">
      <CheckCircle2 size={10} /> Generated
    </span>
  ) : (
    <span className="badge bg-amber-500/10 border border-amber-500/20 text-amber-400 gap-1">
      <AlertTriangle size={10} /> Draft
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LABEL THUMBNAIL STRIP
// ════════════════════════════════════════════════════════════════════════════

function LabelThumbnail({
  label, template, batch, onClick, isSelected, isChecked, onToggleCheck
}: {
  label:      LabelRecord;
  template:   LabelTemplate;
  batch:      LabelBatch;
  onClick:    () => void;
  isSelected: boolean;
  isChecked:  boolean;
  onToggleCheck: () => void;
}) {
  const thumbW  = 160;
  const scale   = thumbW / mm(template.width);

  return (
    <div 
      onClick={onClick}
      className={cn(
        "flex flex-row items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer w-full",
        isSelected ? "border-brand-500 bg-brand-500/10" : "border-slate-700 bg-slate-800 hover:bg-slate-700"
      )}
    >
      <div
        onClick={(e) => { e.stopPropagation(); onToggleCheck(); }}
        className={cn(
          "shrink-0 flex-none w-[40px] h-[40px] rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer",
          isChecked 
            ? "bg-brand-500 border-brand-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]" 
            : "bg-slate-900 border-slate-400 hover:border-brand-400"
        )}
      >
        {isChecked && <Check size={24} strokeWidth={3.5} />}
      </div>

      <div className="flex flex-col gap-2 flex-1 min-w-0 items-center">
        <span className="text-[12px] text-slate-300 font-mono font-medium bg-slate-950 px-2 py-1 rounded-md border border-slate-700 w-full text-center">
          {label.labelIndex} / {label.totalLabels}
        </span>
        <div className="w-full flex justify-center bg-white rounded p-1.5 shadow-sm overflow-hidden pointer-events-none">
          <LabelCanvas
            label={label}
            template={template}
            scale={scale}
            batchInfo={{ soNumber: batch.soNumber, customerName: batch.customerName, customerInitial: batch.customerInitial }}
          />
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LABEL DETAIL PANEL
// ════════════════════════════════════════════════════════════════════════════

function LabelDetailPanel({ label, template, batch }: { label: LabelRecord; template: LabelTemplate; batch: LabelBatch; }) {
  const maxW   = 380;
  const scale  = Math.min(1, maxW / mm(template.width));

  return (
    <div className="flex flex-col gap-6 items-center w-full">
      <div style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.5)", borderRadius: 4, overflow: "hidden", backgroundColor: "white" }}>
        <LabelCanvas label={label} template={template} scale={scale} batchInfo={{ soNumber: batch.soNumber, customerName: batch.customerName, customerInitial: batch.customerInitial }} />
      </div>
      
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-xs w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-inner">
        {[
          ["Index",      `${label.labelIndex} of ${label.totalLabels}`],
          ["Revision",   `R${label.revision}`],
          ["Customer",   label.customerInitial],
          ["City",       label.city],
          ["KoG",        label.kogInitial],
          ["Category",   label.categoryInitial ?? "—"],
          ["Cut Shape",  label.cutShapeName],
          ["Thickness",  label.thicknessFormatted],
          ["Dimensions", `${label.dimensionW}×${label.dimensionH}`],
          ["Edge",       label.edgeFormatted ?? "—"],
          ["Marking",    label.markingCode   ?? "—"],
          ["Processes",  label.processNames.join(", ") || "—"],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col border-b border-slate-800/50 pb-1.5 gap-1">
            <span className="text-slate-500 uppercase text-[10px] tracking-wider font-semibold">{k}</span>
            <span className="text-slate-200 font-medium break-words leading-tight">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// BATCH DETAIL DRAWER 
// ════════════════════════════════════════════════════════════════════════════

interface DrawerProps {
  batch:          LabelBatch;
  onClose:        () => void;
  onPrint:        (labels: LabelRecord[], template: LabelTemplate) => void;
  onReprint:      (batch: LabelBatch, selectedIds: Set<string>) => void;
  reprintLoading: boolean;
}

function BatchDrawer({ batch, onClose, onPrint, onReprint, reprintLoading }: DrawerProps) {
  const [labels,        setLabels]        = useState<LabelRecord[]>([]);
  const [template,      setTemplate]      = useState<LabelTemplate | null>(null);
  const [loadingLabels, setLoadingLabels] = useState(true);
  const [selectedLabel, setSelectedLabel] = useState<LabelRecord | null>(null);
  const [labelSearch,   setLabelSearch]   = useState("");
  const [checkedIds,    setCheckedIds]    = useState<Set<string>>(new Set());

  useEffect(() => {
    setLabels([]); setTemplate(null); setSelectedLabel(null); setCheckedIds(new Set()); setLoadingLabels(true);
    async function load() {
      try {
        const [lbls, tmpl] = await Promise.all([getBatchLabels(batch.id), getTemplate(batch.templateId)]);
        setLabels(lbls); setTemplate(tmpl);
        if (lbls.length > 0) setSelectedLabel(lbls[0]);
      } catch { toast.error("Failed to load batch details."); } finally { setLoadingLabels(false); }
    }
    load();
  }, [batch.id, batch.templateId]);

  const filteredLabels = useMemo(() => {
    const q = labelSearch.toLowerCase();
    if (!q) return labels;
    return labels.filter(l => String(l.labelIndex).includes(q) || l.kogInitial.toLowerCase().includes(q) || `${l.dimensionW}x${l.dimensionH}`.includes(q) || l.thicknessFormatted.includes(q));
  }, [labels, labelSearch]);

  const targetLabels = checkedIds.size > 0 ? labels.filter(l => checkedIds.has(l.id)) : labels;

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="flex items-start justify-between p-5 border-b border-slate-800 shrink-0 bg-slate-900/80">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <h2 className="text-white font-bold text-lg font-mono">SO: {batch.soNumber}</h2>
            <span className="badge badge-slate font-mono">R{batch.revision}</span>
            <StatusBadge status={batch.status} />
          </div>
          <p className="text-slate-400 text-sm">{batch.customerName} · {batch.city} · {fmtDate(batch.createdAt)}</p>
        </div>
        <button onClick={onClose} className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"><X size={20} /></button>
      </div>

      <div className="flex gap-3 px-5 py-4 border-b border-slate-800 shrink-0 bg-slate-950">
        <button disabled={!template || loadingLabels || labels.length === 0} onClick={() => template && onPrint(targetLabels, template)} className="btn-primary flex-1 py-2.5 shadow-lg shadow-brand-500/20">
          <Printer size={16} /> Print {checkedIds.size > 0 ? `Selected (${checkedIds.size})` : `All (${batch.totalLabels})`}
        </button>
        <button onClick={() => onReprint(batch, checkedIds)} disabled={reprintLoading} className="btn-secondary flex-1 py-2.5">
          {reprintLoading ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />} Revise {checkedIds.size > 0 ? `Selected` : `All`}
        </button>
      </div>

      {loadingLabels ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400"><RefreshCw size={24} className="animate-spin text-brand-500" /><span>Loading labels…</span></div>
      ) : !template ? (
        <div className="flex-1 flex items-center justify-center p-6"><p className="text-slate-500 text-center">Template "{batch.templateName}" was not found.</p></div>
      ) : (
        <div className="flex-1 flex overflow-hidden w-full">
          <div className="w-[300px] shrink-0 border-r border-slate-800 flex flex-col bg-slate-900/50">
            <div className="flex flex-col gap-4 p-4 border-b border-slate-800 shrink-0 bg-slate-900/80">
              <input 
                type="text"
                value={labelSearch}
                onChange={(e) => setLabelSearch(e.target.value)}
                placeholder="Search labels..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
              />
              <div className="flex flex-row w-full justify-between items-center bg-slate-950 px-3 py-2.5 rounded-lg border border-slate-800 shadow-sm">
                 <span className="text-xs text-slate-400 font-medium">{checkedIds.size} selected</span>
                 <div className="flex items-center gap-4">
                   <button onClick={() => setCheckedIds(new Set(labels.map(l => l.id)))} className="text-[12px] font-bold text-brand-400 hover:text-brand-300 transition-colors">All</button>
                   <button onClick={() => setCheckedIds(new Set())} className="text-[12px] font-bold text-slate-500 hover:text-slate-300 transition-colors">Clear</button>
                 </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {filteredLabels.map((lbl) => (
                <LabelThumbnail
                  key={lbl.id} label={lbl} template={template} batch={batch}
                  isSelected={selectedLabel?.id === lbl.id} onClick={() => setSelectedLabel(lbl)}
                  isChecked={checkedIds.has(lbl.id)} onToggleCheck={() => setCheckedIds(prev => { const n = new Set(prev); n.has(lbl.id) ? n.delete(lbl.id) : n.add(lbl.id); return n; })}
                />
              ))}
              {filteredLabels.length === 0 && <p className="text-slate-600 text-[11px] text-center py-8">No results</p>}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-slate-950/30 flex items-start justify-center w-full">
            {selectedLabel ? <LabelDetailPanel label={selectedLabel} template={template} batch={batch} /> : <p className="text-slate-600 mt-20">Select a label</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SORT TYPES & MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

type SortKey = "createdAt" | "soNumber" | "customerName" | "totalLabels" | "revision";
type SortDir = "asc" | "desc";

function SortIcon({ col, sort }: { col: SortKey; sort: { key: SortKey; dir: SortDir } }) {
  if (sort.key !== col) return <ChevronsUpDown size={12} className="text-slate-600" />;
  return sort.dir === "asc" ? <ChevronUp size={12} className="text-brand-400" /> : <ChevronDown size={12} className="text-brand-400" />;
}

function HistoryPageInner() {
  const searchParams       = useSearchParams();
  const highlightBatchId   = searchParams.get("batch");
  const { user }           = useAuth();

  const [batches,         setBatches]         = useState<LabelBatch[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [search,          setSearch]          = useState("");
  const [sort,            setSort]            = useState<{ key: SortKey; dir: SortDir }>({ key: "createdAt", dir: "desc" });

  const [selectedBatch,   setSelectedBatch]   = useState<LabelBatch | null>(null);
  const [drawerOpen,      setDrawerOpen]      = useState(false);
  const [printData,       setPrintData]       = useState<{ labels: LabelRecord[]; template: LabelTemplate; batch: LabelBatch } | null>(null);
  const [reprintLoading,  setReprintLoading]  = useState(false);

  // PAGINATION STATE
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize]       = useState(20);

  // RESET STATE
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetCode, setResetCode]           = useState("");
  const [isResetting, setIsResetting]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const b = await getLabelBatches();
      setBatches(b);
      if (highlightBatchId) {
        const target = b.find((x) => x.id === highlightBatchId);
        if (target) { setSelectedBatch(target); setDrawerOpen(true); }
      }
    } catch { toast.error("Failed to load history."); } finally { setLoading(false); }
  }, [highlightBatchId]);

  useEffect(() => { load(); }, [load]);

  // Reset page to 1 when search query changes
  useEffect(() => { setCurrentPage(1); }, [search, pageSize]);

  const displayed = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = q ? batches.filter(b => b.soNumber.toLowerCase().includes(q) || b.customerName.toLowerCase().includes(q) || b.customerInitial.toLowerCase().includes(q) || b.city.toLowerCase().includes(q) || b.templateName.toLowerCase().includes(q)) : batches;
    return [...filtered].sort((a, b) => {
      let av: string | number = a[sort.key] ?? "";
      let bv: string | number = b[sort.key] ?? "";
      if (typeof av === "number" && typeof bv === "number") return sort.dir === "asc" ? av - bv : bv - av;
      return sort.dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [batches, search, sort]);

  // PAGINATION LOGIC
  const totalPages = Math.ceil(displayed.length / pageSize) || 1;
  const paginatedBatches = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayed.slice(start, start + pageSize);
  }, [displayed, currentPage, pageSize]);

  function toggleSort(key: SortKey) { setSort(prev => prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }); }
  function openDrawer(batch: LabelBatch) { setSelectedBatch(batch); setDrawerOpen(true); }
  function handlePrint(labels: LabelRecord[], template: LabelTemplate) { if (selectedBatch) setPrintData({ labels, template, batch: selectedBatch }); }

  async function handleReprint(batch: LabelBatch, selectedIds: Set<string> = new Set()) {
    setReprintLoading(true);
    try {
      const allLabels = await getBatchLabels(batch.id);
      const targets = selectedIds.size > 0 ? allLabels.filter(l => selectedIds.has(l.id)) : allLabels;
      const newBatch = await reprintExactLabels(batch, targets, user!.uid);
      toast.success(`Revised as R${newBatch.revision} — ${targets.length} labels created.`);
      await load();
      setSelectedBatch(newBatch);
      setDrawerOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reprint failed.");
    } finally {
      setReprintLoading(false);
    }
  }

  // FUNGSI UNTUK MENGHAPUS SEMUA BATCH DAN LABEL DI DATABASE
  async function handleResetData() {
    if (resetCode !== "12345678") {
      toast.error("Kode konfirmasi salah!");
      return;
    }
    setIsResetting(true);
    try {
      // Ambil semua dokumen labelBatch
      const batchesSnap = await getDocs(collection(db, "labelBatches"));
      
      // Hapus satu persatu beserta isinya
      for (const batchDoc of batchesSnap.docs) {
        // Ambil dan hapus isi subcollection 'labels' (Stiker di dalamnya)
        const labelsSnap = await getDocs(collection(db, "labelBatches", batchDoc.id, "labels"));
        const deleteOps = labelsSnap.docs.map(l => deleteDoc(l.ref));
        await Promise.all(deleteOps);
        
        // Setelah isinya kosong, hapus folder Batch utamanya
        await deleteDoc(batchDoc.ref);
      }

      toast.success("Semua histori berhasil dihapus permanen!");
      setResetModalOpen(false);
      setResetCode("");
      setDrawerOpen(false);
      load();
    } catch (error) {
      toast.error("Gagal menghapus data.");
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <RouteGuard requiredPage="history">
      {printData && <PrintSheet labels={printData.labels} template={printData.template} batch={printData.batch} onClose={() => setPrintData(null)} />}

      <div className="flex h-full gap-0 animate-fade-in" style={{ minHeight: 0 }}>
        {/* -- LEFT: BATCH TABLE ------------------------------------------- */}
        <div className={cn("flex flex-col flex-1 min-w-0 transition-all duration-300", drawerOpen && "hidden xl:flex")}>
          <div className="page-header shrink-0 flex items-start justify-between">
            <div>
              <h1 className="page-title">History</h1>
              <p className="page-subtitle">{loading ? "Loading…" : `${batches.length} batches generated`}</p>
            </div>
            
            <div className="flex items-center gap-2">
              <button onClick={load} disabled={loading} className="btn-secondary text-xs py-2">
                <RefreshCw size={13} className={cn(loading && "animate-spin")} /> Refresh
              </button>
              {/* TOMBOL RESET DATA */}
              <button onClick={() => setResetModalOpen(true)} className="btn-secondary text-xs py-2 text-red-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-300 transition-colors">
                <Trash2 size={13} /> Clear Data
              </button>
            </div>
          </div>

          <div className="mb-4 shrink-0">
            <input 
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SO number, customer, city…"
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>

          <div className="card overflow-hidden flex-1 min-h-0 flex flex-col">
            
            {/* -- PAGINATION CONTROLS (MOVED TO TOP RIGHT) -------------------------- */}
            <div className="flex px-5 py-3 border-b border-slate-800 bg-slate-900/80 shrink-0">
              
              {/* ml-auto MENDORONG KOTAK INI KE KANAN MENTOK */}
              <div className="flex items-center gap-6 ml-auto">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 font-medium">Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-xs text-white outline-none focus:border-brand-500 transition-colors"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                <div className="flex items-center gap-4 border-l border-slate-700 pl-6">
                  <span className="text-xs text-slate-500">
                    Page <span className="font-medium text-slate-300">{currentPage}</span> of <span className="font-medium text-slate-300">{totalPages}</span> 
                    <span className="mx-1.5 hidden sm:inline-block">·</span> 
                    <span className="hidden sm:inline-block">{displayed.length} items total</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button 
                      disabled={currentPage === 1} 
                      onClick={() => setCurrentPage(p => p - 1)} 
                      className="p-1.5 rounded-md text-slate-400 border border-transparent hover:bg-slate-800 hover:border-slate-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent transition-all"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button 
                      disabled={currentPage === totalPages || totalPages === 0} 
                      onClick={() => setCurrentPage(p => p + 1)} 
                      className="p-1.5 rounded-md text-slate-400 border border-transparent hover:bg-slate-800 hover:border-slate-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent transition-all"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-auto flex-1">
              <table className="data-table">
                <thead className="sticky top-0 bg-slate-900 z-10">
                  <tr>
                    {([
                      { key: "soNumber" as SortKey, label: "SO Number", w: "" }, { key: "customerName" as SortKey, label: "Customer", w: "w-40" },
                      { key: null, label: "City", w: "w-28" }, { key: "totalLabels" as SortKey, label: "Labels", w: "w-20 text-center" },
                      { key: "revision" as SortKey, label: "Rev", w: "w-16 text-center" }, { key: null, label: "Template", w: "w-36" },
                      { key: "createdAt" as SortKey, label: "Date", w: "w-32" }, { key: null, label: "", w: "w-24" },
                    ] as { key: SortKey | null; label: string; w: string }[]).map(({ key, label, w }) => (
                      <th key={label || "_actions"} className={w}>{key ? <button onClick={() => toggleSort(key)} className="flex items-center gap-1.5 hover:text-white transition-colors">{label} <SortIcon col={key} sort={sort} /></button> : label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedBatches.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-10 text-slate-500">Tidak ada riwayat.</td></tr>
                  ) : (
                    paginatedBatches.map((batch) => {
                      const isSelected = selectedBatch?.id === batch.id && drawerOpen;
                      return (
                        <tr key={batch.id} onClick={() => openDrawer(batch)} className={cn("cursor-pointer transition-colors hover:bg-slate-800/40", isSelected && "bg-brand-600/10 border-l-2 border-l-brand-500")}>
                          <td><div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-lg bg-brand-600/10 border border-brand-600/20 flex items-center justify-center shrink-0"><FileText size={13} className="text-brand-400" /></div><div><p className="text-white font-mono font-medium text-sm">SO: {batch.soNumber}</p><StatusBadge status={batch.status} /></div></div></td>
                          <td><p className="text-white text-sm truncate max-w-[140px]">{batch.customerName}</p><p className="text-slate-500 text-xs font-mono">{batch.customerInitial}</p></td>
                          <td className="text-slate-300 text-sm">{batch.city}</td>
                          <td className="text-center"><span className="badge badge-slate tabular-nums font-mono">{batch.totalLabels}</span></td>
                          <td className="text-center"><span className="badge bg-violet-500/10 border border-violet-500/20 text-violet-400 font-mono tabular-nums">R{batch.revision}</span></td>
                          <td className="text-slate-400 text-xs truncate max-w-[130px]">{batch.templateName}</td>
                          <td className="text-slate-500 text-xs">{fmtDate(batch.createdAt)}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button onClick={() => openDrawer(batch)} title="Open Printer Options" className="p-2 flex items-center justify-center rounded-lg text-slate-500 hover:text-brand-400 hover:bg-brand-600/20 transition-colors"><Printer size={16} /></button>
                              <button onClick={() => handleReprint(batch)} disabled={reprintLoading} title={`Reprint All as R${batch.revision + 1}`} className="p-2 flex items-center justify-center rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-600/20 transition-colors"><RefreshCw size={16} className={cn(reprintLoading && selectedBatch?.id === batch.id && "animate-spin")} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* -- RIGHT: BATCH DETAIL DRAWER ----------------------------------- */}
        {drawerOpen && selectedBatch && (
          <div className="w-full xl:w-[700px] shrink-0 border-l border-slate-800 bg-slate-900 shadow-2xl flex flex-col z-20 transition-all duration-300">
            <BatchDrawer batch={selectedBatch} onClose={() => setDrawerOpen(false)} onPrint={handlePrint} onReprint={handleReprint} reprintLoading={reprintLoading} />
          </div>
        )}
      </div>

      {/* -- MODAL KONFIRMASI RESET DATA ------------------------------------ */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 p-6">
            <h2 className="text-lg font-bold text-red-500 flex items-center gap-2 mb-2">
              <AlertTriangle size={20} /> Danger Zone
            </h2>
            <p className="text-slate-400 text-sm mb-5 leading-relaxed">
              Tindakan ini akan <b>MENGHAPUS SEMUA</b> riwayat produksi dan stiker secara permanen. Masukkan kode <code className="bg-slate-950 px-1.5 py-0.5 rounded text-white font-mono">RAHASIA</code> untuk melanjutkan.
            </p>
            
            <input
              type="text"
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value)}
              placeholder="Masukkan kode rahasia..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-center font-mono tracking-widest text-white mb-6 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
              autoFocus
            />
            
            <div className="flex gap-3">
              <button 
                onClick={() => { setResetModalOpen(false); setResetCode(""); }} 
                className="btn-secondary flex-1 py-2.5"
              >
                Batal
              </button>
              <button 
                onClick={handleResetData} 
                disabled={isResetting || resetCode !== "12345678"} 
                className="btn-primary bg-red-600 hover:bg-red-700 border-red-600 flex-1 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isResetting ? <RefreshCw size={16} className="animate-spin inline-block" /> : "Hapus Semua"}
              </button>
            </div>
          </div>
        </div>
      )}
    </RouteGuard>
  );
}

export default function HistoryPage() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-64 gap-3"><RefreshCw size={20} className="animate-spin text-brand-500" /><span className="text-slate-400 text-sm">Loading…</span></div>}><HistoryPageInner /></Suspense>;
}