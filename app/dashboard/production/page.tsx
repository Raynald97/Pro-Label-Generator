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

// --- SEARCHABLE DROPDOWN -----------------------------------------------------

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
  allProcesses, categories, kogs, cutShapes, glassTypes, edgeProcesses, pvbs,
  onUpdate, onDelete, onDuplicate,
}: {
  row:            LineItemRow & { cutShapeInitial?: string, interlayerInitial?: string };
  rowNumber:      number;
  totalRows:      number;
  allProcesses:   Process[];
  categories:     Category[];
  kogs:           KoG[];
  cutShapes:      CutShape[];
  glassTypes:     GlassType[];
  edgeProcesses:  EdgeProcess[];
  pvbs:           PVB[];
  onUpdate:       (patch: Partial<LineItemRow & { cutShapeInitial?: string, interlayerInitial?: string }>) => void;
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

  const kogOptions:         Option[] = kogs.map((k)  => ({ id: k.id, label: k.name,  sub: k.initial }));
  const categoryOptions:    Option[] = categories.map((c) => ({ id: c.id, label: c.name, sub: c.initial }));
  const cutShapeOptions:    Option[] = cutShapes.map((c)  => ({ id: c.id, label: c.name, sub: c.initial }));
  const glassTypeOptions:   Option[] = glassTypes.map((g) => ({ id: g.id, label: g.name, sub: g.initial }));
  const edgeProcessOptions: Option[] = edgeProcesses.map((e) => ({ id: e.id, label: e.name, sub: e.initial }));
  const pvbOptions:         Option[] = pvbs.map((p) => ({ id: p.initial, label: p.name, sub: p.initial }));

  return (
    <div className="card transition-all">
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
          <button onClick={onDuplicate} title="Duplicate row" className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:text-white hover:bg-slate-700 transition-colors">
            <Copy size={12} />
          </button>
          {totalRows > 1 && (
            <button onClick={onDelete} title="Remove row" className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 size={12} />
            </button>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:text-white hover:bg-slate-700 transition-colors">
            {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-6">
          <div className="space-y-5">
            <Field label="KoG" required>
              <div className="relative">
                <SearchableSelect value={row.kogId} onChange={handleKogChange} options={kogOptions} placeholder="Select KoG…" />
                {loadingFormula && <div className="absolute right-8 inset-y-0 flex items-center"><RefreshCw size={12} className="animate-spin text-brand-400" /></div>}
              </div>
            </Field>

            <div>
              <label className="form-label mb-2 flex items-center justify-between">Processes</label>
              <ProcessChecklist items={checklist} onChange={toggleProcess} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Cut Shape" required>
                <SearchableSelect value={row.cutShapeId} onChange={(id, opt) => onUpdate({ cutShapeId: id, cutShapeName: opt?.label ?? "", cutShapeInitial: opt?.sub ?? "" })} options={cutShapeOptions} placeholder="Shape…" />
              </Field>
              <Field label="Category">
                <SearchableSelect value={row.categoryId} onChange={(id, opt) => onUpdate({ categoryId: id, categoryInitial: opt?.sub ?? "" })} options={categoryOptions} placeholder="Optional" clearable />
              </Field>
            </div>

            <div>
              <label className="form-label">Dimensions <span className="text-red-400">*</span></label>
              <div className="grid grid-cols-2 gap-2">
                <NumInput value={row.dimensionW || ""} onChange={(v) => onUpdate({ dimensionW: v })} placeholder="Width" suffix="W" />
                <NumInput value={row.dimensionH || ""} onChange={(v) => onUpdate({ dimensionH: v })} placeholder="Height" suffix="H" />
              </div>
            </div>
          </div>

          <div className="space-y-5 lg:border-l border-slate-800/50 lg:pl-10">
            <div>
              <label className="form-label">Thickness <span className="text-red-400">*</span></label>
              <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                {(["l1", "l2", "l3"] as const).map((key) => (
                  <div key={key}>
                     <NumInput
                      value={row.thickness[key] ?? ""}
                      step={key === "l2" ? 0.01 : 1}
                      placeholder={key === "l1" ? "G1" : key === "l2" ? "PVB" : "G2"}
                      onChange={(v) => {
                        const val = v || null;
                        const newThickness = { ...row.thickness, [key]: val } as ThicknessCalc;
                        const patch: any = { thickness: newThickness };
                        const newLayers = [...row.glassLayers];
                        let layersChanged = false;

                        if (key === "l1" && newLayers[0]) {
                          newLayers[0] = { ...newLayers[0], thicknessMm: v || 0 };
                          layersChanged = true;
                        } else if (key === "l3") {
                          if (newLayers[1]) {
                            newLayers[1] = { ...newLayers[1], thicknessMm: v || 0 };
                            layersChanged = true;
                          } else if (v) {
                            newLayers.push({ glassTypeId: "", glassTypeInitial: "", glassTypeName: "", thicknessMm: v });
                            layersChanged = true;
                          }
                        }
                        if (layersChanged) patch.glassLayers = newLayers;
                        onUpdate(patch);
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
                      <SearchableSelect value={layer.glassTypeId} onChange={(id, opt) => updateLayer(idx, { glassTypeId: id, glassTypeInitial: opt?.sub ?? "", glassTypeName: opt?.label ?? "" })} options={glassTypeOptions} placeholder={`L${idx + 1} Type…`} />
                    </div>
                    <div className="w-24">
                      <NumInput value={layer.thicknessMm || ""} step={1} suffix="mm" onChange={(v) => updateLayer(idx, { thicknessMm: v })} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="form-label">Edge Process</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <SearchableSelect value={row.edgeProcessId} onChange={(id, opt) => onUpdate({ edgeProcessId: id, edgeProcessInitial: opt?.sub ?? "" })} options={edgeProcessOptions} placeholder="None" clearable />
                </div>
                <div className="flex gap-1">
                  {(["B", "T", "L", "R"] as EdgeSide[]).map((side) => (
                    <button key={side} type="button" disabled={!row.edgeProcessId} onClick={() => toggleSide(side)} className={cn("w-8 h-9 rounded-lg border text-[10px] font-bold transition-all", row.edgeSides.includes(side) ? "bg-brand-600/20 border-brand-500/50 text-brand-300" : "bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500 disabled:opacity-30")}>
                      {side}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// VALIDATION
// ════════════════════════════════════════════════════════════════════════════

interface ValidationErrors {
  header: Partial<Record<keyof BatchHeader | "projectId", string>>;
  rows:   Array<Partial<Record<string, string>>>;
  global: string | null;
}

function validate(header: Partial<BatchHeader>, rows: LineItemRow[]): ValidationErrors {
  const errors: ValidationErrors = { header: {}, rows: rows.map(() => ({})), global: null };

  if (!header.soNumber?.trim())       errors.header.soNumber       = "SO Number is required";
  if (!header.customerId)           errors.header.customerId     = "Customer is required";
  if (!header.city?.trim())         errors.header.city           = "City is required";
  if (!header.targetSchedule)       errors.header.targetSchedule = "Target schedule is required";
  if (!header.templateId)           errors.header.templateId     = "Label template is required";

  rows.forEach((row, i) => {
    if (!row.kogId)               errors.rows[i].kogId       = "KoG is required";
    if (!row.cutShapeId)          errors.rows[i].cutShapeId  = "Cut Shape is required";
    if (!row.thickness.l1)        errors.rows[i].thickness   = "L1 thickness is required";
    if (!row.dimensionW || !row.dimensionH) errors.rows[i].dimensions = "Dimensions are required";
    if (row.quantity < 1)         errors.rows[i].quantity    = "Quantity must be ≥ 1";
  });

  if (rows.length === 0) errors.global = "Add at least one line item.";

  return errors;
}

function hasErrors(e: ValidationErrors): boolean {
  return (
    Object.keys(e.header).length > 0 ||
    e.rows.some((r) => Object.keys(r).length > 0) ||
    e.global !== null
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

function getDefaultTargetSchedule() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function ProductionPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [customers,     setCustomers]     = useState<Customer[]>([]);
  const [projects,      setProjects]      = useState<Project[]>([]);
  const [categories,    setCategories]    = useState<Category[]>([]);
  const [kogs,          setKogs]          = useState<KoG[]>([]);
  const [cutShapes,     setCutShapes]     = useState<CutShape[]>([]);
  const [pvbs,          setPvbs]          = useState<PVB[]>([]);
  const [glassTypes,    setGlassTypes]    = useState<GlassType[]>([]);
  const [processes,     setProcesses]     = useState<Process[]>([]);
  const [edgeProcesses, setEdgeProcesses] = useState<EdgeProcess[]>([]);
  const [logos,         setLogos]         = useState<Logo[]>([]);
  const [markings,      setMarkings]      = useState<Marking[]>([]);
  const [templates,     setTemplates]     = useState<LabelTemplate[]>([]);
  const [masterLoading, setMasterLoading] = useState(true);

  const [header, setHeader] = useState<Partial<BatchHeader> & { 
    projectId?: string, 
    projectInitial?: string,
    alerts?: string,
    markingPosition?: string,
    markingOffset?: number 
  }>({
    soNumber:        "",
    revision:        1,
    targetSchedule:  getDefaultTargetSchedule(),
    customerId:      "",
    customerName:    "",
    customerInitial: "",
    projectId:       "",
    projectInitial:  "",
    city:            "",
    logoId:          "",
    logoUrl:         "",
    markingId:       "",
    markingName:     "",
    markingInitial:  "",
    markingImageUrl: "",
    templateId:      "",
    templateName:    "",
    alerts:          "",
    markingPosition: "BL",
    markingOffset:   20,
  });

  const [rows, setRows]         = useState<(LineItemRow & { cutShapeInitial?: string, interlayerInitial?: string })[]>([makeEmptyRow()]);
  const [errors, setErrors]     = useState<ValidationErrors | null>(null);
  const [generating, setGenerating] = useState(false);
  const [submitted, setSubmitted]   = useState(false);

  useEffect(() => {
    async function load() {
      setMasterLoading(true);
      try {
        const [c, proj, cat, k, cs, pvb, gt, p, ep, l, m, t] = await Promise.all([
          getMasterList<Customer>("customers"),
          getMasterList<Project>("projects"),
          getMasterList<Category>("categories"),
          getMasterList<KoG>("kogs"),
          getMasterList<CutShape>("cutShapes"),
          getMasterList<PVB>("pvbs"),
          getMasterList<GlassType>("glassTypes"),
          getMasterList<Process>("processes"),
          getMasterList<EdgeProcess>("edgeProcesses"),
          getMasterList<Logo>("logos"),
          getMasterList<Marking>("markings"),
          getTemplates(),
        ]);
        setCustomers(c);
        setProjects(proj);
        setCategories(cat);
        setKogs(k);
        setCutShapes(cs);
        setPvbs(pvb);
        setGlassTypes(gt);
        setProcesses(p);
        setEdgeProcesses(ep);
        setLogos(l);
        setMarkings(m);
        setTemplates(t);
      } catch {
        toast.error("Failed to load master data.");
      } finally {
        setMasterLoading(false);
      }
    }
    load();
  }, []);

  function patchHeader(patch: any) {
    setHeader((h) => ({ ...h, ...patch }));
  }

  function addRow() { setRows((r) => [...r, makeEmptyRow()]); }
  function deleteRow(rowId: string) { setRows((rows) => rows.filter((r) => r.rowId !== rowId)); }
  function updateRow(rowId: string, patch: Partial<LineItemRow>) {
    setRows((rows) => rows.map((r) => r.rowId === rowId ? { ...r, ...patch } : r));
  }
  function duplicateRow(rowId: string) {
    const orig = rows.find((r) => r.rowId === rowId);
    if (!orig) return;
    setRows((rows) => {
      const idx = rows.findIndex((r) => r.rowId === rowId);
      const next = [...rows];
      next.splice(idx + 1, 0, { ...orig, rowId: `row_${Date.now()}_dup` });
      return next;
    });
  }

  const totalLabels = useMemo(() => rows.reduce((s, r) => s + r.quantity, 0), [rows]);

  async function onGenerate() {
    setSubmitted(true);
    const errs = validate(header, rows);
    setErrors(errs);
    if (hasErrors(errs)) {
      toast.error("Please fix the highlighted errors.");
      document.querySelector("[data-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setGenerating(true);
    try {
      const batch = await generateBatch(header as BatchHeader, rows, processes, user!.uid);
      toast.success(`Batch generated! ${batch.totalLabels} labels for SO: ${batch.soNumber}`);
      router.push(`/dashboard/history?batch=${batch.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  const customerOptions:  Option[] = customers.map((c) => ({ id: c.id, label: c.name, sub: c.initial }));
  const logoOptions:      Option[] = logos.map((l)    => ({ id: l.id, label: l.name }));
  const markingOptions:   Option[] = markings.map((m) => ({ id: m.id, label: m.name, sub: m.initial }));
  const templateOptions:  Option[] = templates.map((t) => ({ id: t.id, label: t.name, sub: `${t.width}×${t.height}mm` }));

  return (
    <RouteGuard requiredPage="production">
      <div className="animate-fade-in max-w-5xl mx-auto pb-20">
        <div className="page-header">
          <div>
            <h1 className="page-title">Production</h1>
            <p className="page-subtitle">Create a batch of labels for a Sales Order</p>
          </div>
          {rows.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2">
              <FileText size={14} className="text-brand-400" />
              <span><span className="text-white font-semibold">{rows.length}</span> rows</span>
              <span className="text-slate-600">·</span>
              <span><span className="text-white font-semibold">{totalLabels}</span> labels</span>
            </div>
          )}
        </div>

        {masterLoading ? (
          <div className="flex items-center justify-center py-24 gap-3"><RefreshCw size={20} className="animate-spin text-brand-500" /></div>
        ) : (
          <div className="space-y-6">
            
            <div className="card p-6 bg-slate-900/50 border-slate-800 space-y-6 shadow-xl">
              <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800">
                <Database className="text-brand-500" size={18} />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">SO Header — Applies to All Labels</h2>
              </div>

              <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
                <div className="flex-1 flex flex-col gap-4">
                  <Field label="SO Number" required error={submitted ? errors?.header.soNumber : undefined}>
                    <div data-error={submitted && errors?.header.soNumber ? true : undefined} className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-medium pointer-events-none select-none">SO:</span>
                      <input value={header.soNumber} onChange={(e) => patchHeader({ soNumber: e.target.value })} placeholder="2400123" className={cn("input-base h-9 pl-9 font-mono", submitted && errors?.header.soNumber && "border-red-500")} />
                    </div>
                  </Field>

                  <Field label="Customer" required error={submitted ? errors?.header.customerId : undefined}>
                    <SearchableSelect value={header.customerId || ""} onChange={(id, opt) => patchHeader({ customerId: id, customerName: opt?.label, customerInitial: opt?.sub })} options={customerOptions} placeholder="Search customer…" />
                  </Field>

                  <Field label="City" required error={submitted ? errors?.header.city : undefined}>
                    <input value={header.city} onChange={(e) => patchHeader({ city: e.target.value })} placeholder="Jakarta" className={cn("input-base h-9", submitted && errors?.header.city && "border-red-500")} />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Schedule" required error={submitted ? errors?.header.targetSchedule : undefined}>
                      <input type="date" value={header.targetSchedule} onChange={(e) => patchHeader({ targetSchedule: e.target.value })} className={cn("input-base h-9 text-sm", submitted && errors?.header.targetSchedule && "border-red-500")} />
                    </Field>
                    <Field label="Revision">
                      <NumInput value={header.revision || 1} min={1} onChange={(v) => patchHeader({ revision: v })} />
                    </Field>
                  </div>
                </div>

                <div className="flex-1 flex flex-col gap-4">
                  <Field label="Label Template" required error={submitted ? errors?.header.templateId : undefined}>
                    <SearchableSelect value={header.templateId || ""} onChange={(id, opt) => patchHeader({ templateId: id, templateName: opt?.label })} options={templateOptions} placeholder="Select template…" />
                  </Field>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Marking Position">
                      <select value={header.markingPosition} onChange={(e) => patchHeader({ markingPosition: e.target.value })} className="input-base h-9 text-sm">
                        {["TL", "TR", "BL", "BR"].map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </Field>
                    <Field label="Offset (mm)">
                      <NumInput value={header.markingOffset || ""} onChange={(v) => patchHeader({ markingOffset: v })} suffix="mm" />
                    </Field>
                  </div>

                  <Field label="Marking Stamp">
                    <SearchableSelect value={header.markingId || ""} onChange={(id, opt) => {
                      const m = markings.find((mark) => mark.id === id);
                      patchHeader({ markingId: id, markingName: opt?.label, markingInitial: opt?.sub, markingImageUrl: m?.imageUrl });
                    }} options={markingOptions} placeholder="None" clearable />
                  </Field>

                  <Field label="Logo">
                    <SearchableSelect value={header.logoId || ""} onChange={(id) => {
                      const logo = logos.find((l) => l.id === id);
                      patchHeader({ logoId: id, logoUrl: logo?.imageUrl });
                    }} options={logoOptions} placeholder="None" clearable />
                  </Field>
                </div>

                <div className="flex-1">
                  <div className="space-y-2 h-full flex flex-col">
                    <label className="form-label flex items-center gap-1.5 text-amber-400">
                      <AlertTriangle size={12} /> Production Alerts / Notes
                    </label>
                    <textarea
                      value={header.alerts}
                      onChange={(e) => patchHeader({ alerts: e.target.value })}
                      placeholder="Special instructions for production team..."
                      className="input-base flex-1 min-h-[150px] lg:min-h-0 py-3 text-sm border-amber-500/20 focus:border-amber-500/50"
                    />
                  </div>
                </div>
              </div>
            </div>

            <SectionCard title="Line Items — Glass Specifications" icon={Layers}>
              <div className="space-y-4">
                {submitted && errors?.global && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    <AlertCircle size={14} /> {errors.global}
                  </div>
                )}
                {rows.map((row, idx) => (
                  <LineItemRowCard
                    key={row.rowId}
                    row={row}
                    rowNumber={idx + 1}
                    totalRows={rows.length}
                    allProcesses={processes}
                    categories={categories}
                    kogs={kogs}
                    cutShapes={cutShapes}
                    glassTypes={glassTypes}
                    edgeProcesses={edgeProcesses}
                    pvbs={pvbs}
                    onUpdate={(patch) => updateRow(row.rowId, patch)}
                    onDelete={() => deleteRow(row.rowId)}
                    onDuplicate={() => duplicateRow(row.rowId)}
                  />
                ))}
                <button type="button" onClick={addRow} className="w-full py-4 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 hover:border-brand-500/50 hover:text-brand-400 transition-all text-sm font-medium">
                  <Plus size={15} className="inline mr-1" /> Add Line Item
                </button>
              </div>
            </SectionCard>

            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800 sticky bottom-4 shadow-2xl z-20">
              <div>
                <p className="text-white font-medium text-sm">
                  {rows.length} line items · <span className="text-brand-400 font-bold">{totalLabels}</span> labels will be generated
                </p>
                {header.soNumber && <p className="text-slate-500 text-xs mt-0.5">SO: {header.soNumber}</p>}
              </div>
              <button onClick={onGenerate} disabled={generating} className="btn-primary px-8">
                {generating ? <RefreshCw className="animate-spin" /> : <Printer size={16} />}
                Generate Batch
              </button>
            </div>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}