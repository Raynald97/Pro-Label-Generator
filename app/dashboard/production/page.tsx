"use client";

import {
  useState, useEffect, useCallback, useRef, useMemo,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus, Trash2, ChevronDown, ChevronUp, Printer,
  RefreshCw, AlertCircle, CheckSquare, Square,
  Search, X, Copy, FileText, Layers, Zap, Database, AlertTriangle
} from "lucide-react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { useAuth } from "@/hooks/useAuth";
import { getMasterList }       from "@/lib/master-data";
import { getFormulaByKogId }   from "@/lib/master-data";
import { getTemplates }         from "@/lib/label-designer";
import { generateBatch, makeEmptyRow, buildProcessChecklist,
         formatThickness, formatEdgeProcess, formatMarkingCode }
  from "@/lib/production";
import type {
  Customer, KoG, Category, CutShape, Process, EdgeProcess,
  GlassType, Logo, Marking, LabelTemplate,
  LineItemRow, BatchHeader, GlassLayer, EdgeSide,
  ThicknessCalc, ProcessWithCheck, Project, PVB
} from "@/types";
import { cn } from "@/lib/utils";

// ════════════════════════════════════════════════════════════════════════════
// SMALL UI PRIMITIVES
// ════════════════════════════════════════════════════════════════════════════

function SectionCard({ title, icon: Icon, children, className }: {
  title: string; icon: React.ElementType; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("card", className)}>
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-slate-800 bg-slate-800/30 rounded-t-xl">
        <Icon size={15} className="text-brand-400 shrink-0" />
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="form-label">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

// --- SEARCHABLE DROPDOWN (ANTI-BOCOR) ----------------------------------------

interface Option { id: string; label: string; sub?: string; }

function SearchableSelect({ value, onChange, options, placeholder, disabled, clearable }: {
  value:       string;
  onChange:    (id: string, option: Option | null) => void;
  options:     Option[];
  placeholder: string;
  disabled?:   boolean;
  clearable?:  boolean;
}) {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState("");
  const ref                 = useRef<HTMLDivElement>(null);
  const selected            = options.find((o) => o.id === value);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q ? options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.sub ?? "").toLowerCase().includes(q)
    ) : options;
  }, [options, query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', zIndex: open ? 99999 : 10 }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(!open); setQuery(""); }}
        className={cn(
          "input-base flex items-center justify-between gap-2 h-9 text-sm w-full",
          disabled && "opacity-50 cursor-not-allowed",
          !selected && "text-slate-500"
        )}
        style={{ backgroundColor: '#0f172a' }} 
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <div className="flex items-center gap-1 shrink-0">
          {clearable && selected && (
            <span
              onClick={(e) => { e.stopPropagation(); onChange("", null); }}
              className="text-slate-500 hover:text-white cursor-pointer px-1"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown size={14} className={cn("text-slate-500 transition-transform duration-200", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            backgroundColor: '#1e293b', border: '1px solid #475569',
            borderRadius: '0.5rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)', 
            zIndex: 99999, maxHeight: '260px', display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}
        >
          <div style={{ padding: '8px', borderBottom: '1px solid #334155', backgroundColor: '#1e293b' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  width: '100%', height: '32px', paddingLeft: '32px', paddingRight: '12px',
                  borderRadius: '6px', backgroundColor: '#0f172a', border: '1px solid #475569',
                  color: 'white', fontSize: '12px', outline: 'none'
                }}
                placeholder="Search options..."
              />
            </div>
          </div>

          <div style={{ overflowY: 'auto', backgroundColor: '#1e293b', paddingBottom: '4px' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                No results found
              </div>
            ) : filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => { onChange(o.id, o); setOpen(false); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 12px', textAlign: 'left', fontSize: '12px',
                  backgroundColor: o.id === value ? 'rgba(37, 99, 235, 0.2)' : 'transparent',
                  color: o.id === value ? '#93c5fd' : '#cbd5e1', border: 'none', cursor: 'pointer',
                  transition: 'background-color 0.1s'
                }}
              >
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.label}</span>
                {o.sub && (
                  <span style={{ fontSize: '10px', color: '#94a3b8', backgroundColor: 'rgba(15, 23, 42, 0.6)', padding: '2px 6px', borderRadius: '4px', border: '1px solid #334155' }}>
                    {o.sub}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- NUMBER INPUT -------------------------------------------------------------

function NumInput({ value, onChange, min = 0, step = 1, suffix, className, placeholder }: {
  value: number | ""; onChange: (v: number) => void;
  min?: number; step?: number; suffix?: string; className?: string; placeholder?: string;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        value={value}
        min={min}
        step={step}
        placeholder={placeholder}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={cn("input-base h-9 text-sm font-mono", suffix && "pr-8", className)}
      />
      {suffix && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PROCESS CHECKLIST COMPONENT
// ════════════════════════════════════════════════════════════════════════════

function ProcessChecklist({ items, onChange }: {
  items:     ProcessWithCheck[];
  onChange: (id: string, checked: boolean) => void;
}) {
  if (items.length === 0) {
    return <p className="text-slate-600 text-xs italic">No processes defined in Master Data.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id, !p.checked)}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all",
            p.checked
              ? p.autoChecked
                ? "bg-brand-600/20 border-brand-500/40 text-brand-300"
                : "bg-emerald-600/20 border-emerald-500/40 text-emerald-300"
              : "bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300"
          )}
        >
          {p.checked
            ? <CheckSquare size={13} className={p.autoChecked ? "text-brand-400" : "text-emerald-400"} />
            : <Square size={13} />}
          {p.name}
          {p.autoChecked && p.checked && (
              <span title="Auto-filled by formula" className="flex items-center">
                <Zap size={11} className="text-brand-400" />
              </span>
            )}
        </button>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LINE ITEM ROW COMPONENT
// ════════════════════════════════════════════════════════════════════════════

function LineItemRowCard({
  row, rowNumber, totalRows,
  allProcesses, categories, kogs, cutShapes, glassTypes, edgeProcesses, pvbs, masterAlerts,
  onUpdate, onDelete, onDuplicate,
}: {
  row:            LineItemRow & { cutShapeInitial?: string, interlayerInitial?: string, alertId?: string, alerts?: string };
  rowNumber:      number;
  totalRows:      number;
  allProcesses:   Process[];
  categories:     Category[];
  kogs:           KoG[];
  cutShapes:      CutShape[];
  glassTypes:     GlassType[];
  edgeProcesses:  EdgeProcess[];
  pvbs:           PVB[];
  masterAlerts:   any[];
  onUpdate:       (patch: any) => void;
  onDelete:       () => void;
  onDuplicate:    () => void;
}) {
  const [loadingFormula, setLoadingFormula] = useState(false);
  const [collapsed, setCollapsed]           = useState(false);

  const checklist: ProcessWithCheck[] = useMemo(() =>
    buildProcessChecklist(allProcesses, [], row.checkedProcessIds),
    [allProcesses, row.checkedProcessIds]
  );

  async function handleKogChange(id: string, opt: Option | null) {
    const kogInitial = opt?.sub ?? "";
    const kogName    = opt?.label ?? "";
    onUpdate({ kogId: id, kogInitial, kogName });
    if (!id) { onUpdate({ checkedProcessIds: [] }); return; }

    setLoadingFormula(true);
    try {
      const formula = await getFormulaByKogId(id);
      if (formula) {
        onUpdate({ checkedProcessIds: formula.processIds });
        toast.info(`Auto-checked ${formula.processIds.length} processes for ${opt?.label}`);
      } else {
        onUpdate({ checkedProcessIds: [] });
      }
    } catch {
      toast.error("Failed to fetch formula.");
    } finally {
      setLoadingFormula(false);
    }
  }

  function toggleProcess(pid: string, checked: boolean) {
    const ids = new Set(row.checkedProcessIds);
    if (checked) ids.add(pid); else ids.delete(pid);
    onUpdate({ checkedProcessIds: Array.from(ids) });
  }

  function toggleSide(side: EdgeSide) {
    const sides = new Set(row.edgeSides);
    if (sides.has(side)) sides.delete(side); else sides.add(side);
    onUpdate({ edgeSides: Array.from(sides) as EdgeSide[] });
  }

  function updateLayer(idx: number, patch: Partial<GlassLayer>) {
    const layers = row.glassLayers.map((l, i) => i === idx ? { ...l, ...patch } : l);
    onUpdate({ glassLayers: layers });
  }
  function addLayer() {
    if (row.glassLayers.length >= 3) return;
    onUpdate({ glassLayers: [...row.glassLayers, { glassTypeId: "", glassTypeInitial: "", glassTypeName: "", thicknessMm: 0 }] });
  }
  function removeLayer(idx: number) {
    if (row.glassLayers.length <= 1) return;
    onUpdate({ glassLayers: row.glassLayers.filter((_, i) => i !== idx) });
  }

  const preview = useMemo(() => {
    const parts: string[] = [];
    if (row.kogInitial)   parts.push(row.kogInitial);
    if (row.dimensionW && row.dimensionH) parts.push(`${row.dimensionW}×${row.dimensionH}`);
    if (row.thickness.l1) parts.push(formatThickness(row.thickness));
    return parts.join(" · ") || "Empty row";
  }, [row]);

  const pvbOptions: Option[] = pvbs.map((p) => ({ id: p.initial, label: p.name, sub: p.initial }));

  return (
    <div className="card transition-all">
      {/* -- Row header -------------------------------------------------------- */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800 bg-slate-800/40">
        <div className="w-6 h-6 rounded-full bg-brand-600/20 border border-brand-600/30 flex items-center justify-center shrink-0">
          <span className="text-brand-400 text-[11px] font-bold">{rowNumber}</span>
        </div>
        <p className="text-slate-300 text-xs flex-1 truncate">{preview}</p>

        <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1">
          <span className="text-slate-500 text-[11px]">Qty</span>
          <input
            type="number"
            min={1}
            max={999}
            value={row.quantity}
            onChange={(e) => onUpdate({ quantity: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-12 bg-transparent text-white text-xs font-mono text-center focus:outline-none"
          />
          <span className="text-slate-600 text-[11px]">pcs</span>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={onDuplicate} title="Duplicate row"
            className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:text-white hover:bg-slate-700 transition-colors">
            <Copy size={12} />
          </button>
          {totalRows > 1 && (
            <button onClick={onDelete} title="Remove row"
              className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 size={12} />
            </button>
          )}
          <button onClick={() => setCollapsed(!collapsed)}
            className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:text-white hover:bg-slate-700 transition-colors">
            {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
        </div>
      </div>

      {/* -- Row body (2 Columns Grid) ----------------------------------------- */}
      {!collapsed && (
        <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-6">
          
          <div className="space-y-5">
            
            <Field label="KoG" required>
              <div className="relative">
                <SearchableSelect value={row.kogId} onChange={handleKogChange} options={kogs.map(k=>({id:k.id, label:k.name, sub:k.initial}))} placeholder="Select KoG…" />
                {loadingFormula && <div className="absolute right-8 inset-y-0 flex items-center"><RefreshCw size={12} className="animate-spin text-brand-400" /></div>}
              </div>
            </Field>

            <div>
              <label className="form-label mb-2 flex items-center justify-between">Processes</label>
              <ProcessChecklist items={checklist} onChange={toggleProcess} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Cut Shape" required>
                <SearchableSelect value={row.cutShapeId} onChange={(id, opt) => onUpdate({ cutShapeId: id, cutShapeName: opt?.label ?? "", cutShapeInitial: opt?.sub ?? "" })} options={cutShapes.map(c=>({id:c.id, label:c.name, sub:c.initial}))} placeholder="Shape…" />
              </Field>
              <Field label="Category">
                <SearchableSelect value={row.categoryId} onChange={(id, opt) => onUpdate({ categoryId: id, categoryInitial: opt?.sub ?? "" })} options={categories.map(c=>({id:c.id, label:c.name, sub:c.initial}))} placeholder="Optional" clearable />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Dimensions" required>
                <div className="flex gap-2">
                  <NumInput value={row.dimensionW || ""} onChange={(v) => onUpdate({ dimensionW: v })} placeholder="Width" suffix="W" />
                  <NumInput value={row.dimensionH || ""} onChange={(v) => onUpdate({ dimensionH: v })} placeholder="Height" suffix="H" />
                </div>
              </Field>
              <Field label="Production Alert">
                <SearchableSelect 
                  value={row.alertId || ""} 
                  options={masterAlerts.map(a => ({ id: a.id, label: a.name, sub: a.description }))} 
                  onChange={(id, opt) => onUpdate({ alertId: id, alerts: opt?.sub || "" })}
                  placeholder="None"
                  clearable
                />
              </Field>
            </div>
            {row.alerts && (
              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 flex gap-2 animate-fade-in">
                 <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Google_Alerts_icon.svg/512px-Google_Alerts_icon.svg.png" className="w-4 h-4 mt-0.5" />
                 <p className="text-[10px] text-amber-200/80 leading-relaxed italic">"{row.alerts}"</p>
              </div>
            )}

          </div>

          <div className="space-y-5 border-t lg:border-t-0 lg:border-l border-slate-800/50 pt-5 lg:pt-0 lg:pl-10">
            
            <div>
              <label className="form-label">Thickness & Interlayer <span className="text-red-400">*</span></label>
              <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                {(["l1", "l2", "l3"] as const).map((key) => (
                  <div key={key}>
                     <NumInput
                      value={row.thickness[key] ?? ""}
                      step={key === "l2" ? 0.01 : 1}
                      placeholder={key === "l1" ? "G1" : key === "l2" ? "PVB" : "G2"}
                      onChange={(v) => {
                        const newThickness = { ...row.thickness, [key]: v || null } as ThicknessCalc;
                        onUpdate({ thickness: newThickness });
                      }}
                    />
                  </div>
                ))}
              </div>
              <SearchableSelect value={row.interlayerInitial || ""} onChange={(initial) => onUpdate({ interlayerInitial: initial })} options={pvbOptions} placeholder="Select Interlayer" clearable />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="form-label mb-0">Glass Layers</label>
                {row.glassLayers.length < 3 && (
                  <button type="button" onClick={addLayer} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors">
                    <Plus size={11} /> Add layer
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {row.glassLayers.map((layer, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-600 w-5 shrink-0 font-medium">L{idx + 1}</span>
                    <div className="flex-1">
                      <SearchableSelect value={layer.glassTypeId} onChange={(id, opt) => updateLayer(idx, { glassTypeId: id, glassTypeInitial: opt?.sub ?? "", glassTypeName: opt?.label ?? "" })} options={glassTypes.map(g=>({id:g.id, label:g.name, sub:g.initial}))} placeholder={`L${idx + 1} Type…`} />
                    </div>
                    <div className="w-24">
                      <NumInput value={layer.thicknessMm || ""} step={1} suffix="mm" onChange={(v) => updateLayer(idx, { thicknessMm: v })} />
                    </div>
                    {row.glassLayers.length > 1 && (
                      <button onClick={() => removeLayer(idx)} className="text-slate-600 hover:text-red-400 transition-colors shrink-0 p-1"><X size={14} /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5 pt-1">
              <Field label="Edge Process">
                <SearchableSelect value={row.edgeProcessId} onChange={(id, opt) => onUpdate({ edgeProcessId: id, edgeProcessInitial: opt?.sub ?? "" })} options={edgeProcesses.map(e=>({id:e.id, label:e.name, sub:e.initial}))} placeholder="None" clearable />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Marking">
                   <select value={row.markingPosition} onChange={(e) => onUpdate({ markingPosition: e.target.value })} className="input-base h-9 text-xs">
                    {["TL", "TR", "BL", "BR"].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Offset">
                  <NumInput value={row.markingOffset} step={1} onChange={(v) => onUpdate({ markingOffset: v })} />
                </Field>
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// VALIDATION & MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

interface ValidationErrors {
  header: Partial<Record<keyof BatchHeader | "projectId", string>>;
  rows:   Array<Partial<Record<string, string>>>;
  global: string | null;
}

function validate(header: Partial<BatchHeader>, rows: LineItemRow[]): ValidationErrors {
  const errors: ValidationErrors = { header: {}, rows: rows.map(() => ({})), global: null };
  if (!header.soNumber?.trim()) errors.header.soNumber = "SO Number required";
  if (!header.customerId) errors.header.customerId = "Customer required";
  if (!header.templateId) errors.header.templateId = "Template required";
  rows.forEach((row, i) => {
    if (!row.kogId) errors.rows[i].kogId = "KoG required";
    if (!row.cutShapeId) errors.rows[i].cutShapeId = "Shape required";
  });
  if (rows.length === 0) errors.global = "Add at least one row.";
  return errors;
}

function hasErrors(e: ValidationErrors): boolean {
  return Object.keys(e.header).length > 0 || e.rows.some((r) => Object.keys(r).length > 0) || e.global !== null;
}

function getDefaultTargetSchedule() {
  const d = new Date(); d.setDate(d.getDate() + 2);
  return d.toISOString().split('T')[0];
}

export default function ProductionPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [master, setMaster] = useState({
    customers: [] as Customer[], projects: [] as Project[], categories: [] as Category[],
    kogs: [] as KoG[], cutShapes: [] as CutShape[], pvbs: [] as PVB[],
    glassTypes: [] as GlassType[], processes: [] as Process[], edgeProcesses: [] as EdgeProcess[],
    logos: [] as Logo[], markings: [] as Marking[], templates: [] as LabelTemplate[], alerts: [] as any[],
  });
  const [masterLoading, setMasterLoading] = useState(true);

  const [header, setHeader] = useState<any>({
    soNumber: "", revision: 1, targetSchedule: getDefaultTargetSchedule(),
    customerId: "", customerName: "", customerInitial: "", projectId: "", projectInitial: "",
    city: "", logoId: "", logoUrl: "", markingId: "", markingName: "", markingInitial: "",
    markingImageUrl: "", templateId: "", templateName: "",
  });

  const [rows, setRows]         = useState<any[]>([makeEmptyRow()]);
  const [errors, setErrors]     = useState<ValidationErrors | null>(null);
  const [generating, setGenerating] = useState(false);
  const [submitted, setSubmitted]   = useState(false);

  useEffect(() => {
    async function load() {
      setMasterLoading(true);
      try {
        const [c, proj, cat, k, cs, pvb, gt, p, ep, l, m, t, al] = await Promise.all([
          getMasterList<Customer>("customers"), getMasterList<Project>("projects"),
          getMasterList<Category>("categories"), getMasterList<KoG>("kogs"),
          getMasterList<CutShape>("cutShapes"), getMasterList<PVB>("pvbs"),
          getMasterList<GlassType>("glassTypes"), getMasterList<Process>("processes"),
          getMasterList<EdgeProcess>("edgeProcesses"), getMasterList<Logo>("logos"),
          getMasterList<Marking>("markings"), getTemplates(), getMasterList<any>("alerts"),
        ]);
        setMaster({
          customers: c, projects: proj, categories: cat, kogs: k, cutShapes: cs,
          pvbs: pvb, glassTypes: gt, processes: p, edgeProcesses: ep, logos: l,
          markings: m, templates: t, alerts: al
        });
      } catch { toast.error("Failed loading master data."); }
      finally { setMasterLoading(false); }
    }
    load();
  }, []);

  function patchHeader(patch: any) { setHeader((h: any) => ({ ...h, ...patch })); }

  const totalLabels = useMemo(() => rows.reduce((s, r) => s + r.quantity, 0), [rows]);

  async function onGenerate() {
    setSubmitted(true);
    const errs = validate(header, rows);
    setErrors(errs);
    if (hasErrors(errs)) { toast.error("Please fix errors."); return; }
    setGenerating(true);
    try {
      const batch = await generateBatch(header as BatchHeader, rows, master.processes, user!.uid);
      toast.success(`Batch generated!`);
      router.push(`/dashboard/history?batch=${batch.id}`);
    } catch { toast.error("Failed."); }
    finally { setGenerating(false); }
  }

  return (
    <RouteGuard requiredPage="production">
      <div className="animate-fade-in max-w-5xl mx-auto pb-20">
        <div className="page-header">
          <div>
            <h1 className="page-title">Production</h1>
            <p className="page-subtitle">Batch Label Generation</p>
          </div>
          <div className="text-sm bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2">
            <span className="text-brand-400 font-bold">{totalLabels}</span> <span className="text-slate-400">Total Labels</span>
          </div>
        </div>

        {masterLoading ? (
          <div className="flex items-center justify-center py-24"><RefreshCw className="animate-spin text-brand-500" /></div>
        ) : (
          <div className="space-y-6">
            
            <SectionCard title="SO Header — Applies to All Labels" icon={Database}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-6">
                <div className="space-y-4">
                  <Field label="SO Number" required error={submitted ? errors?.header.soNumber : undefined}>
                    <input value={header.soNumber} onChange={e=>patchHeader({soNumber: e.target.value})} placeholder="SO: 2400123" className="input-base h-9 font-mono" />
                  </Field>
                  <Field label="Customer" required error={submitted ? errors?.header.customerId : undefined}>
                    <SearchableSelect value={header.customerId} options={master.customers.map(c=>({id:c.id, label:c.name, sub:c.initial}))} onChange={(id, opt)=>patchHeader({customerId:id, customerName:opt?.label, customerInitial:opt?.sub})} placeholder="Customer…" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Schedule" required>
                      <input type="date" value={header.targetSchedule} onChange={e=>patchHeader({targetSchedule: e.target.value})} className="input-base h-9 text-sm" />
                    </Field>
                    <Field label="Revision"><NumInput value={header.revision} onChange={v=>patchHeader({revision: v})} /></Field>
                  </div>
                  <Field label="City"><input value={header.city} onChange={e=>patchHeader({city: e.target.value})} placeholder="Jakarta" className="input-base h-9 text-sm" /></Field>
                </div>

                <div className="space-y-4">
                  <Field label="Label Template" required error={submitted ? errors?.header.templateId : undefined}>
                    <SearchableSelect value={header.templateId} options={master.templates.map(t=>({id:t.id, label:t.name}))} onChange={(id, opt)=>patchHeader({templateId:id, templateName:opt?.label})} placeholder="Select template…" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                     <Field label="Marking Stamp">
                      <SearchableSelect value={header.markingId} options={master.markings.map(m=>({id:m.id, label:m.name, sub:m.initial}))} onChange={(id, opt)=> {
                        const m = master.markings.find(x => x.id === id);
                        patchHeader({markingId:id, markingName:opt?.label, markingInitial:opt?.sub, markingImageUrl: m?.imageUrl});
                      }} placeholder="None" clearable />
                    </Field>
                    <Field label="Logo">
                      <SearchableSelect value={header.logoId} options={master.logos.map(l=>({id:l.id, label:l.name}))} onChange={(id, opt)=> {
                         const l = master.logos.find(x => x.id === id);
                         patchHeader({logoId:id, logoUrl: l?.imageUrl});
                      }} placeholder="None" clearable />
                    </Field>
                  </div>
                  <Field label="Project">
                    <SearchableSelect value={header.projectId} options={master.projects.map(p=>({id:p.id, label:p.name, sub:p.initial}))} onChange={(id, opt)=>patchHeader({projectId:id, projectInitial:opt?.sub})} placeholder="Optional" clearable />
                  </Field>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Line Items — Glass Specifications" icon={Layers}>
              <div className="space-y-4">
                {rows.map((row, idx) => (
                  <LineItemRowCard key={row.rowId} row={row} rowNumber={idx+1} totalRows={rows.length} allProcesses={master.processes} categories={master.categories} kogs={master.kogs} cutShapes={master.cutShapes} glassTypes={master.glassTypes} edgeProcesses={master.edgeProcesses} pvbs={master.pvbs} masterAlerts={master.alerts}
                    onUpdate={patch => setRows(rows.map(r => r.rowId === row.rowId ? {...r, ...patch} : r))}
                    onDelete={() => setRows(rows.filter(r => r.rowId !== row.rowId))}
                    onDuplicate={() => {
                      const next = [...rows]; const idx = rows.findIndex(r => r.rowId === row.rowId);
                      next.splice(idx+1, 0, {...row, rowId: `row_${Date.now()}_dup`});
                      setRows(next);
                    }}
                  />
                ))}
                <button type="button" onClick={() => setRows([...rows, makeEmptyRow()])} className="w-full py-4 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 hover:text-brand-400 transition-all text-sm font-bold flex items-center justify-center gap-2 group">
                  <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" /> Add Line Item
                </button>
              </div>
            </SectionCard>

            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800 sticky bottom-4 shadow-2xl z-20">
              <div className="text-white font-medium text-sm">
                Total: <span className="text-brand-400 font-bold">{totalLabels}</span> Labels in <span className="text-brand-400 font-bold">{rows.length}</span> Rows
              </div>
              <button onClick={onGenerate} disabled={generating} className="btn-primary px-8 h-10 flex items-center gap-2">
                {generating ? <RefreshCw className="animate-spin" /> : <Printer size={16} />} 
                {generating ? "Generating..." : "Generate Batch"}
              </button>
            </div>

          </div>
        )}
      </div>
    </RouteGuard>
  );
}