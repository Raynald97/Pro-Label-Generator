"use client";

import {
  useState, useEffect, useRef, useCallback,
  useMemo, use,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, Save, Undo2, Redo2, ZoomIn, ZoomOut,
  Grid3x3, Eye, EyeOff, Trash2, Lock, Unlock,
  Type, Image as ImageIcon, Minus, ChevronDown,
  Copy, AlignLeft, AlignCenter, AlignRight,
  Settings, Loader2, MoveHorizontal, MoveVertical,
} from "lucide-react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  getTemplate,
  saveTemplateElements,
  updateTemplateMetadata,
  MM_TO_PX,
  GRID_MM,
  MIN_ELEMENT_MM,
  DEFAULT_ZOOM,
  VARIABLE_DEFINITIONS,
  makeTextElement,
  makeImageElement,
  makeLineElement,
  snapToGrid,
  mmToPx,
  pxToMm,
  clampElement,
  elementLabel,
  previewContent,
  historyPush,
  historyUndo,
  historyRedo,
  type HistoryStack,
} from "@/lib/label-designer";
import type {
  LabelTemplate,
  CanvasElement,
  TextElement,
  ImageElement,
  LineElement,
  VariableToken,
} from "@/types";
import { cn } from "@/lib/utils";

// --- FONT OPTIONS -------------------------------------------------------------
const FONTS = ["Arial", "Arial Narrow", "Helvetica", "Times New Roman", "Courier New", "Georgia", "Verdana", "Tahoma"];
const FONT_SIZES = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24];

// --- CATEGORY COLOURS ---------------------------------------------------------
const CAT_COLORS: Record<string, string> = {
  order:      "text-brand-400  bg-brand-500/10  border-brand-500/20",
  glass:      "text-cyan-400   bg-cyan-500/10   border-cyan-500/20",
  production: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  image:      "text-violet-400 bg-violet-500/10 border-violet-500/20",
  static:     "text-slate-400  bg-slate-700/50  border-slate-600/30",
};

// --- SMALL UI HELPERS ---------------------------------------------------------

function PanelSection({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-800 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
      >
        {title}
        <ChevronDown size={12} className={cn("transition-transform", !open && "-rotate-90")} />
      </button>
      {open && <div className="pb-3 px-3 space-y-2">{children}</div>}
    </div>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500 text-[11px] w-14 shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function SmallInput({
  value, onChange, type = "text", step, min, max, className, suffix,
}: {
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  step?: string;
  min?: string;
  max?: string;
  className?: string;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full h-7 px-2 rounded bg-slate-800 border border-slate-700 text-white text-xs",
          "focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-transparent",
          suffix && "pr-6",
          className
        )}
      />
      {suffix && (
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 text-[10px] pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ════════════════════════════════════════════════════════════════════════════

export default function LabelDesignerEditor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  // -- Template data ----------------------------------------------------------
  const [template, setTemplate]     = useState<LabelTemplate | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(true);

  // -- History stack (undo/redo) ----------------------------------------------
  const [history, setHistory] = useState<HistoryStack>({
    past:    [],
    present: [],
    future:  [],
  });
  const elements = history.present;

  // -- UI state ---------------------------------------------------------------
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [zoom, setZoom]                 = useState(DEFAULT_ZOOM);
  const [showGrid, setShowGrid]         = useState(true);
  const [saving, setSaving]             = useState(false);
  const [isDirty, setIsDirty]           = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [renameOpen, setRenameOpen]     = useState(false);
  const [renameName, setRenameName]     = useState("");

  // -- Drag state (all in a ref — no re-render during drag) ------------------
  const dragRef = useRef<{
    active:    boolean;
    elementId: string;
    startX:    number;   // px
    startY:    number;
    origX:     number;   // mm
    origY:     number;
    type:      "move" | "resize-br";
  } | null>(null);

  // -- Canvas ref ------------------------------------------------------------
  const canvasRef = useRef<HTMLDivElement>(null);

  // -- Load template ----------------------------------------------------------
  useEffect(() => {
    async function load() {
      try {
        const t = await getTemplate(id);
        if (!t) { toast.error("Template not found."); router.replace("/dashboard/label-designer"); return; }
        setTemplate(t);
        setZoom(Math.min(DEFAULT_ZOOM, 400 / t.width));  // fit to ~400px initial width
        setShowGrid(t.showGrid);
        setHistory({ past: [], present: t.elements, future: [] });
      } catch {
        toast.error("Failed to load template.");
      } finally {
        setLoadingTemplate(false);
      }
    }
    load();
  }, [id, router]);

  // -- Derived: selected element ----------------------------------------------
  const selectedEl = useMemo(
    () => elements.find((e) => e.id === selectedId) ?? null,
    [elements, selectedId]
  );

  // -- Push a new state onto the history stack --------------------------------
  const pushHistory = useCallback((next: CanvasElement[]) => {
    setHistory((h) => historyPush(h, next));
    setIsDirty(true);
  }, []);

  // -- Undo / Redo ------------------------------------------------------------
  const undo = useCallback(() => {
    setHistory((h) => {
      const next = historyUndo(h);
      if (next !== h) setIsDirty(true);
      return next;
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => {
      const next = historyRedo(h);
      if (next !== h) setIsDirty(true);
      return next;
    });
  }, []);

  // -- Keyboard shortcuts -----------------------------------------------------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if (meta && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      if (meta && e.key === "s") { e.preventDefault(); onSave(); }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && document.activeElement === document.body) {
        deleteSelected();
      }
      if (e.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, undo, redo]);

  // -- Save -------------------------------------------------------------------
  async function onSave() {
    if (!template) return;
    setSaving(true);
    try {
      await saveTemplateElements(template.id, elements);
      setIsDirty(false);
      toast.success("Template saved.");
    } catch {
      toast.error("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  // -- Delete selected --------------------------------------------------------
  function deleteSelected() {
    if (!selectedId) return;
    pushHistory(elements.filter((e) => e.id !== selectedId));
    setSelectedId(null);
  }

  // -- Duplicate selected -----------------------------------------------------
  function duplicateSelected() {
    if (!selectedEl) return;
    const copy: CanvasElement = {
      ...selectedEl,
      id: `el_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      x:  snapToGrid(selectedEl.x + 3),
      y:  snapToGrid(selectedEl.y + 3),
    } as CanvasElement;
    pushHistory([...elements, copy]);
    setSelectedId(copy.id);
  }

  // -- Update a single element's fields --------------------------------------
  function updateElement(id: string, patch: Partial<CanvasElement>) {
    pushHistory(
      elements.map((e) => (e.id === id ? { ...e, ...patch } as CanvasElement : e))
    );
  }

  // -- Bring to front / send to back -----------------------------------------
  function bringToFront(id: string) {
    const el  = elements.find((e) => e.id === id);
    if (!el) return;
    pushHistory([...elements.filter((e) => e.id !== id), el]);
  }
  function sendToBack(id: string) {
    const el  = elements.find((e) => e.id === id);
    if (!el) return;
    pushHistory([el, ...elements.filter((e) => e.id !== id)]);
  }

  // -- Drop handler: variable token dragged onto canvas ----------------------
  function onCanvasDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!template || !canvasRef.current) return;

    const token = e.dataTransfer.getData("variable-token") as VariableToken | "";
    const kind  = e.dataTransfer.getData("element-kind") as "text" | "image" | "line-h" | "line-v" | "";
    if (!token && !kind) return;

    const rect  = canvasRef.current.getBoundingClientRect();
    const xMm   = snapToGrid(pxToMm(e.clientX - rect.left, zoom));
    const yMm   = snapToGrid(pxToMm(e.clientY - rect.top,  zoom));

    let newEl: CanvasElement;

    if (kind === "line-h") {
      newEl = makeLineElement(xMm, yMm, template.width, "horizontal");
    } else if (kind === "line-v") {
      newEl = makeLineElement(xMm, yMm, template.width, "vertical");
    } else if (token === "__static__") {
      // FIX: Menangani Static Text yang dilempar ke canvas
      newEl = makeTextElement(null, "Your Custom Text", xMm, yMm, template.width);
    } else {
      const varDef = VARIABLE_DEFINITIONS.find((v) => v.token === token);
      if (!varDef) return;
      if (varDef.isImage) {
        newEl = makeImageElement(token as VariableToken, xMm, yMm);
      } else {
        newEl = makeTextElement(token as VariableToken, varDef.label, xMm, yMm, template.width);
      }
    }

    pushHistory([...elements, newEl]);
    setSelectedId(newEl.id);
  }

  // -- Mouse-down on an element: start drag ----------------------------------
  function onElementMouseDown(
    e: React.MouseEvent,
    el: CanvasElement,
    type: "move" | "resize-br"
  ) {
    if (el.locked) return;
    e.stopPropagation();
    setSelectedId(el.id);

    dragRef.current = {
      active:    true,
      elementId: el.id,
      startX:    e.clientX,
      startY:    e.clientY,
      origX:     el.x,
      origY:     el.y,
      type,
    };

    function onMouseMove(mv: MouseEvent) {
      // 1. Tangkap (capture) nilainya sekarang sebelum React memproses state secara async
      const currentDrag = dragRef.current; 
      
      if (!currentDrag || !template) return;
      
      const dx = pxToMm(mv.clientX - currentDrag.startX, zoom);
      const dy = pxToMm(mv.clientY - currentDrag.startY, zoom);

      setHistory((h) => ({
        ...h,
        present: h.present.map((item) => {
          // 2. Gunakan variabel lokal 'currentDrag', jangan 'dragRef.current'
          if (item.id !== currentDrag.elementId) return item;
          
          if (currentDrag.type === "move") {
            const clamped = clampElement(
              { ...item, x: currentDrag.origX + dx, y: currentDrag.origY + dy },
              template.width,
              template.height
            );
            return { ...item, ...clamped } as CanvasElement;
          } else {
            // resize-br
            const newW = Math.max(MIN_ELEMENT_MM, snapToGrid(item.width  + dx));
            const newH = Math.max(MIN_ELEMENT_MM, snapToGrid(item.height + dy));
            currentDrag.startX = mv.clientX;
            currentDrag.startY = mv.clientY;
            return { ...item, width: newW, height: newH } as CanvasElement;
          }
        }),
      }));
    }

    function onMouseUp() {
      if (dragRef.current?.active) {
        setIsDirty(true);
        // Commit drag to history properly
        setHistory((h) => ({
          past:    [...h.past, h.past[h.past.length - 1] ?? []].slice(-50),
          present: h.present,
          future:  [],
        }));
      }
      dragRef.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);
  }

  // -- Zoom -------------------------------------------------------------------
  function setZoomClamped(z: number) {
    setZoom(Math.min(4, Math.max(0.3, Math.round(z * 10) / 10)));
  }

  // --- RENDER -----------------------------------------------------------------

  if (loadingTemplate) {
    return (
      <RouteGuard requiredPage="label-designer">
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 size={28} className="animate-spin text-brand-500" />
        </div>
      </RouteGuard>
    );
  }

  if (!template) return null;

  const canvasW = mmToPx(template.width,  zoom);
  const canvasH = mmToPx(template.height, zoom);

  return (
    <RouteGuard requiredPage="label-designer">
      {/* Full-screen layout — overrides dashboard padding */}
      <div className="fixed inset-0 flex flex-col bg-slate-950 z-[99]" style={{ top: 0, left: 0 }}>

        {/* -- TOOLBAR ------------------------------------------------------- */}
        <div className="flex items-center gap-2 px-3 h-12 bg-slate-900 border-b border-slate-800 shrink-0">
          {/* Back */}
          <button
            onClick={() => {
              if (isDirty && !confirm("You have unsaved changes. Leave anyway?")) return;
              router.push("/dashboard/label-designer");
            }}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm mr-2"
          >
            <ArrowLeft size={15} />
            <span className="hidden sm:inline">Templates</span>
          </button>

          <div className="w-px h-5 bg-slate-800 mx-1" />

          {/* Template name */}
          <button
            onClick={() => { setRenameName(template.name); setRenameOpen(true); }}
            className="flex items-center gap-1.5 text-white font-medium text-sm hover:text-brand-300 transition-colors max-w-[180px]"
          >
            <span className="truncate">{template.name}</span>
            <Settings size={12} className="text-slate-600 shrink-0" />
          </button>

          <span className="text-slate-600 text-xs ml-1">{template.width}×{template.height}mm</span>

          {isDirty && (
            <span className="text-amber-400 text-xs flex items-center gap-1 ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              Unsaved
            </span>
          )}

          <div className="flex-1" />

          {/* Undo / Redo */}
          <button
            onClick={undo}
            disabled={history.past.length === 0}
            title="Undo (Ctrl+Z)"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={redo}
            disabled={history.future.length === 0}
            title="Redo (Ctrl+Y)"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
          >
            <Redo2 size={14} />
          </button>

          <div className="w-px h-5 bg-slate-800 mx-1" />

          {/* Zoom */}
          <button
            onClick={() => setZoomClamped(zoom - 0.25)}
            className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ZoomOut size={13} />
          </button>
          <button
            onClick={() => setZoomClamped(1)}
            className="text-xs font-mono text-slate-400 hover:text-white w-12 text-center transition-colors"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => setZoomClamped(zoom + 0.25)}
            className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ZoomIn size={13} />
          </button>

          <div className="w-px h-5 bg-slate-800 mx-1" />

          {/* Grid toggle */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle grid"
            className={cn(
              "w-8 h-8 flex items-center justify-center rounded-lg transition-colors",
              showGrid ? "text-brand-400 bg-brand-600/10" : "text-slate-500 hover:text-white hover:bg-slate-800"
            )}
          >
            <Grid3x3 size={14} />
          </button>

          <div className="w-px h-5 bg-slate-800 mx-1" />

          {/* Save */}
          <button
            onClick={onSave}
            disabled={saving || !isDirty}
            className="btn-primary h-8 px-3 text-xs disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save
          </button>
        </div>

        {/* -- THREE-COLUMN BODY ---------------------------------------------- */}
        <div className="flex flex-1 overflow-hidden">

          {/* -- LEFT: VARIABLES PANEL ----------------------------------------- */}
          <div className="w-52 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-800">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Elements</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Drag onto canvas</p>
            </div>
            <div className="flex-1 overflow-y-auto py-1">

              {/* Static text */}
              <PanelSection title="Static">
                <DraggableToken
                  icon={<Type size={12} />}
                  label="Static Text"
                  token="__static__"
                  isImage={false}
                  color="text-slate-400 bg-slate-700/50 border-slate-600/30"
                />
                <DraggableToken
                  icon={<Minus size={12} />}
                  label="Line (H)"
                  token="__line__"
                  kind="line-h"
                  isImage={false}
                  color="text-slate-400 bg-slate-700/50 border-slate-600/30"
                />
                <DraggableToken
                  icon={<MoveVertical size={12} />}
                  label="Line (V)"
                  token="__line__"
                  kind="line-v"
                  isImage={false}
                  color="text-slate-400 bg-slate-700/50 border-slate-600/30"
                />
              </PanelSection>

              {/* Variable groups */}
              {(["order", "glass", "production", "image"] as const).map((cat) => {
                const defs = VARIABLE_DEFINITIONS.filter((v) => v.category === cat);
                const title = cat === "order" ? "Order" : cat === "glass" ? "Glass" : cat === "production" ? "Production" : "Images";
                return (
                  <PanelSection key={cat} title={title} defaultOpen={cat === "order"}>
                    {defs.map((def) => (
                      <DraggableToken
                        key={def.token}
                        icon={def.isImage ? <ImageIcon size={12} /> : <Type size={12} />}
                        label={def.label}
                        token={def.token}
                        isImage={def.isImage}
                        color={CAT_COLORS[cat]}
                      />
                    ))}
                  </PanelSection>
                );
              })}
            </div>
          </div>

          {/* -- CENTRE: CANVAS ------------------------------------------------ */}
          <div
            className="flex-1 overflow-auto bg-[#111318] flex items-start justify-center p-8"
            onClick={() => setSelectedId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onCanvasDrop}
          >
            {/* Grid dots background */}
            <div
              ref={canvasRef}
              style={{
                width:           canvasW,
                height:          canvasH,
                backgroundColor: template.background,
                position:        "relative",
                flexShrink:      0,
                boxShadow:       "0 4px 40px rgba(0,0,0,0.6)",
                borderRadius:    2,
                overflow:        "hidden",
                cursor:          "default",
                // 1mm grid via repeating-linear-gradient
                backgroundImage: showGrid
                  ? `
                    linear-gradient(to right, rgba(148,163,184,0.08) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(148,163,184,0.08) 1px, transparent 1px)
                  `
                  : "none",
                backgroundSize: showGrid
                  ? `${mmToPx(GRID_MM, zoom)}px ${mmToPx(GRID_MM, zoom)}px`
                  : "auto",
                backgroundPositionX: "0px",
                backgroundPositionY: "0px",
              }}
              onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
            >
              {/* Canvas border */}
              <div
                style={{
                  position:  "absolute",
                  inset:     0,
                  border:    "1px solid rgba(100,116,139,0.4)",
                  pointerEvents: "none",
                  zIndex:    9999,
                }}
              />

              {/* Elements */}
              {elements.map((el) => (
                <CanvasElementRenderer
                  key={el.id}
                  el={el}
                  zoom={zoom}
                  isSelected={el.id === selectedId}
                  onMouseDown={(e, type) => onElementMouseDown(e, el, type)}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }}
                />
              ))}
            </div>
          </div>

          {/* -- RIGHT: PROPERTIES PANEL --------------------------------------- */}
          <div className="w-56 shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-800 shrink-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Properties</p>
            </div>

            {!selectedEl ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                <p className="text-slate-600 text-xs">Select an element on the canvas to edit its properties.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">

                {/* Element header */}
                <div className="px-3 py-2 border-b border-slate-800 bg-slate-800/30">
                  <p className="text-white text-xs font-medium truncate">{elementLabel(selectedEl)}</p>
                  <p className="text-slate-500 text-[11px] font-mono mt-0.5">{selectedEl.type}</p>
                </div>

                {/* -- POSITION & SIZE --------------------------------------- */}
                <PanelSection title="Position & Size">
                  <div className="grid grid-cols-2 gap-1.5">
                    <PropRow label="X">
                      <SmallInput
                        type="number" step="0.5" suffix="mm"
                        value={selectedEl.x}
                        onChange={(v) => updateElement(selectedEl.id, { x: snapToGrid(parseFloat(v) || 0) })}
                      />
                    </PropRow>
                    <PropRow label="Y">
                      <SmallInput
                        type="number" step="0.5" suffix="mm"
                        value={selectedEl.y}
                        onChange={(v) => updateElement(selectedEl.id, { y: snapToGrid(parseFloat(v) || 0) })}
                      />
                    </PropRow>
                    <PropRow label="W">
                      <SmallInput
                        type="number" step="0.5" suffix="mm"
                        value={selectedEl.width}
                        onChange={(v) => updateElement(selectedEl.id, { width: Math.max(MIN_ELEMENT_MM, parseFloat(v) || MIN_ELEMENT_MM) })}
                      />
                    </PropRow>
                    <PropRow label="H">
                      <SmallInput
                        type="number" step="0.5" suffix="mm"
                        value={selectedEl.height}
                        onChange={(v) => updateElement(selectedEl.id, { height: Math.max(MIN_ELEMENT_MM, parseFloat(v) || MIN_ELEMENT_MM) })}
                      />
                    </PropRow>
                  </div>
                </PanelSection>

                {/* -- TEXT PROPERTIES --------------------------------------- */}
                {selectedEl.type === "text" && (() => {
                  const el = selectedEl as TextElement;
                  return (
                    <>
                      <PanelSection title="Text">
                        {/* Content — only editable for static text */}
                        {!el.variable && (
                          <div>
                            <p className="text-[11px] text-slate-500 mb-1">Content</p>
                            <textarea
                              value={el.content}
                              rows={2}
                              onChange={(e) => updateElement(el.id, { content: e.target.value })}
                              className="w-full px-2 py-1.5 rounded bg-slate-800 border border-slate-700 text-white text-xs resize-none focus:outline-none focus:ring-1 focus:ring-brand-500"
                            />
                          </div>
                        )}
                        {el.variable && (
                          <div className="px-2 py-1.5 rounded bg-slate-800/60 border border-slate-700/60">
                            <p className="text-[11px] text-slate-500">Variable</p>
                            <p className="text-brand-400 text-xs font-mono truncate">{el.variable}</p>
                          </div>
                        )}

                        {/* Font family */}
                        <div>
                          <p className="text-[11px] text-slate-500 mb-1">Font</p>
                          <select
                            value={el.fontFamily}
                            onChange={(e) => updateElement(el.id, { fontFamily: e.target.value })}
                            className="w-full h-7 px-2 rounded bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                          >
                            {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </div>

                        {/* Font size + weight + style */}
                        <div className="flex gap-1.5">
                          <div className="flex-1">
                            <p className="text-[11px] text-slate-500 mb-1">Size</p>
                            <select
                              value={el.fontSize}
                              onChange={(e) => updateElement(el.id, { fontSize: parseInt(e.target.value) })}
                              className="w-full h-7 px-2 rounded bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                            >
                              {FONT_SIZES.map((s) => <option key={s} value={s}>{s}pt</option>)}
                            </select>
                          </div>
                          <div className="flex gap-1 items-end pb-0.5">
                            <button
                              onClick={() => updateElement(el.id, { fontWeight: el.fontWeight === "bold" ? "normal" : "bold" })}
                              className={cn(
                                "w-7 h-7 rounded text-xs font-bold transition-colors",
                                el.fontWeight === "bold"
                                  ? "bg-brand-600 text-white"
                                  : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"
                              )}
                            >
                              B
                            </button>
                            <button
                              onClick={() => updateElement(el.id, { fontStyle: el.fontStyle === "italic" ? "normal" : "italic" })}
                              className={cn(
                                "w-7 h-7 rounded text-xs italic transition-colors",
                                el.fontStyle === "italic"
                                  ? "bg-brand-600 text-white"
                                  : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"
                              )}
                            >
                              I
                            </button>
                          </div>
                        </div>

                        {/* Alignment */}
                        <div>
                          <p className="text-[11px] text-slate-500 mb-1">Align</p>
                          <div className="flex gap-1">
                            {(["left", "center", "right"] as const).map((a) => (
                              <button
                                key={a}
                                onClick={() => updateElement(el.id, { align: a })}
                                className={cn(
                                  "flex-1 h-7 flex items-center justify-center rounded transition-colors",
                                  el.align === a
                                    ? "bg-brand-600 text-white"
                                    : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"
                                )}
                              >
                                {a === "left" ? <AlignLeft size={12} /> : a === "center" ? <AlignCenter size={12} /> : <AlignRight size={12} />}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Color */}
                        <PropRow label="Color">
                          <div className="flex gap-1.5">
                            <input
                              type="color"
                              value={el.color}
                              onChange={(e) => updateElement(el.id, { color: e.target.value })}
                              className="w-7 h-7 rounded cursor-pointer border border-slate-700 bg-slate-800 p-0.5"
                            />
                            <SmallInput
                              value={el.color}
                              onChange={(v) => updateElement(el.id, { color: v })}
                              className="font-mono uppercase"
                            />
                          </div>
                        </PropRow>

                        {/* Border toggle */}
                        <PropRow label="Border">
                          <button
                            onClick={() => updateElement(el.id, { border: !el.border })}
                            className={cn(
                              "w-full h-7 rounded text-xs font-medium transition-colors",
                              el.border
                                ? "bg-brand-600/20 border border-brand-500/40 text-brand-300"
                                : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"
                            )}
                          >
                            {el.border ? "On" : "Off"}
                          </button>
                        </PropRow>
                      </PanelSection>
                    </>
                  );
                })()}

                {/* -- IMAGE PROPERTIES -------------------------------------- */}
                {selectedEl.type === "image" && (() => {
                  const el = selectedEl as ImageElement;
                  return (
                    <PanelSection title="Image">
                      <div className="px-2 py-1.5 rounded bg-slate-800/60 border border-slate-700/60">
                        <p className="text-[11px] text-slate-500">Variable</p>
                        <p className="text-violet-400 text-xs font-mono truncate">{el.variable}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500 mb-1">Object Fit</p>
                        <select
                          value={el.objectFit}
                          onChange={(e) => updateElement(el.id, { objectFit: e.target.value as ImageElement["objectFit"] })}
                          className="w-full h-7 px-2 rounded bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none"
                        >
                          <option value="contain">Contain</option>
                          <option value="cover">Cover</option>
                          <option value="fill">Fill</option>
                        </select>
                      </div>
                    </PanelSection>
                  );
                })()}

                {/* -- LINE PROPERTIES --------------------------------------- */}
                {selectedEl.type === "line" && (() => {
                  const el = selectedEl as LineElement;
                  return (
                    <PanelSection title="Line">
                      <PropRow label="Color">
                        <div className="flex gap-1.5">
                          <input
                            type="color"
                            value={el.color}
                            onChange={(e) => updateElement(el.id, { color: e.target.value })}
                            className="w-7 h-7 rounded cursor-pointer border border-slate-700 bg-slate-800 p-0.5"
                          />
                          <SmallInput
                            value={el.color}
                            onChange={(v) => updateElement(el.id, { color: v })}
                            className="font-mono uppercase"
                          />
                        </div>
                      </PropRow>
                      <PropRow label="Dir">
                        <select
                          value={el.direction}
                          onChange={(e) => updateElement(el.id, {
                            direction: e.target.value as "horizontal" | "vertical",
                            width:  e.target.value === "horizontal" ? el.width  : 0.5,
                            height: e.target.value === "horizontal" ? 0.5 : el.height,
                          })}
                          className="w-full h-7 px-2 rounded bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none"
                        >
                          <option value="horizontal">Horizontal</option>
                          <option value="vertical">Vertical</option>
                        </select>
                      </PropRow>
                    </PanelSection>
                  );
                })()}

                {/* -- ACTIONS ----------------------------------------------- */}
                <PanelSection title="Actions">
                  <button
                    onClick={() => updateElement(selectedEl.id, { locked: !selectedEl.locked })}
                    className="w-full flex items-center gap-2 h-7 px-2 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    {selectedEl.locked ? <Lock size={12} /> : <Unlock size={12} />}
                    {selectedEl.locked ? "Unlock" : "Lock"}
                  </button>
                  <button
                    onClick={duplicateSelected}
                    className="w-full flex items-center gap-2 h-7 px-2 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <Copy size={12} /> Duplicate
                  </button>
                  <button
                    onClick={() => bringToFront(selectedEl.id)}
                    className="w-full flex items-center gap-2 h-7 px-2 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <Eye size={12} /> Bring to Front
                  </button>
                  <button
                    onClick={() => sendToBack(selectedEl.id)}
                    className="w-full flex items-center gap-2 h-7 px-2 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <EyeOff size={12} /> Send to Back
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="w-full flex items-center gap-2 h-7 px-2 rounded text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={12} /> Delete Element
                  </button>
                </PanelSection>

                {/* Element ID (debug/info) */}
                <div className="px-3 py-2 border-t border-slate-800">
                  <p className="text-[10px] text-slate-700 font-mono truncate" title={selectedEl.id}>
                    {selectedEl.id}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* -- RENAME MODAL (lightweight — no Modal component to avoid portal issues) */}
      {renameOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setRenameOpen(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-sm shadow-2xl animate-slide-up">
            <h2 className="text-white font-semibold mb-4">Template Settings</h2>
            <label className="form-label">Name</label>
            <input
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              className="input-base mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setRenameOpen(false)} className="btn-secondary">Cancel</button>
              <button
                onClick={async () => {
                  if (!renameName.trim()) return;
                  await updateTemplateMetadata(template.id, { name: renameName.trim() });
                  setTemplate({ ...template, name: renameName.trim() });
                  setRenameOpen(false);
                  toast.success("Name updated.");
                }}
                className="btn-primary"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- DELETE ELEMENT CONFIRM ---------------------------------------------- */}
      <ConfirmDialog
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={() => { deleteSelected(); setDeleteConfirm(false); }}
        title="Delete Element"
        message={`Delete "${selectedEl ? elementLabel(selectedEl) : ""}"?`}
        confirmLabel="Delete"
      />
    </RouteGuard>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DRAGGABLE TOKEN (left panel item)
// ════════════════════════════════════════════════════════════════════════════

function DraggableToken({
  icon, label, token, kind, isImage, color,
}: {
  icon:     React.ReactNode;
  label:    string;
  token:    string;
  kind?:    string;
  isImage:  boolean;
  color:    string;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("variable-token", token);
        e.dataTransfer.setData("element-kind", kind ?? "");
        e.dataTransfer.effectAllowed = "copy";
      }}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-md border text-xs font-medium cursor-grab active:cursor-grabbing select-none transition-all hover:scale-[1.02]",
        color
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CANVAS ELEMENT RENDERER
// ════════════════════════════════════════════════════════════════════════════

function CanvasElementRenderer({
  el, zoom, isSelected, onMouseDown, onClick,
}: {
  el:          CanvasElement;
  zoom:        number;
  isSelected:  boolean;
  onMouseDown: (e: React.MouseEvent, type: "move" | "resize-br") => void;
  onClick:     (e: React.MouseEvent) => void;
}) {
  const style: React.CSSProperties = {
    position:   "absolute",
    left:       mmToPx(el.x, zoom),
    top:        mmToPx(el.y, zoom),
    width:      mmToPx(el.width, zoom),
    height:     mmToPx(el.height, zoom),
    cursor:     el.locked ? "not-allowed" : "move",
    userSelect: "none",
    boxSizing:  "border-box",
  };

  // Selection ring
  const selectionStyle: React.CSSProperties = isSelected ? {
    outline:      "1.5px solid #0c8fe7",
    outlineOffset: "1px",
  } : {};

  // -- Text ------------------------------------------------------------------
  if (el.type === "text") {
    const t = el as TextElement;
    return (
      <div
        style={{
          ...style,
          ...selectionStyle,
          fontSize:        `${t.fontSize * MM_TO_PX * zoom * 0.352778}px`,
          fontFamily:      t.fontFamily,
          fontWeight:      t.fontWeight,
          fontStyle:       t.fontStyle,
          color:           t.color,
          textAlign:       t.align,
          lineHeight:      t.lineHeight,
          backgroundColor: t.background ?? "transparent",
          border:          t.border ? `${Math.max(1, zoom)}px solid ${t.color}` : "none",
          overflow:        "hidden",
          display:         "flex",
          alignItems:      "center",
          padding:         `0 ${mmToPx(0.5, zoom)}px`,
        }}
        onClick={onClick}
        onMouseDown={(e) => onMouseDown(e, "move")}
      >
        <span
          style={{
            width:     "100%",
            overflow:  "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {previewContent(t)}
        </span>
        {isSelected && !el.locked && <ResizeHandle onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, "resize-br"); }} />}
      </div>
    );
  }

  // -- Image -----------------------------------------------------------------
  if (el.type === "image") {
    const img = el as ImageElement;
    return (
      <div
        style={{
          ...style,
          ...selectionStyle,
          backgroundColor: "#e2e8f0",
          border: "1.5px dashed #94a3b8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 2,
        }}
        onClick={onClick}
        onMouseDown={(e) => onMouseDown(e, "move")}
      >
        <ImageIcon size={Math.max(10, mmToPx(4, zoom))} color="#64748b" />
        <span style={{ fontSize: Math.max(7, mmToPx(2, zoom)), color: "#64748b", textAlign: "center", padding: "0 4px" }}>
          {img.variable ? VARIABLE_DEFINITIONS.find(v => v.token === img.variable)?.label ?? img.variable : "Image"}
        </span>
        {isSelected && !el.locked && <ResizeHandle onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, "resize-br"); }} />}
      </div>
    );
  }

  // -- Line ------------------------------------------------------------------
  if (el.type === "line") {
    const ln = el as LineElement;
    return (
      <div
        style={{
          ...style,
          ...selectionStyle,
          backgroundColor: ln.color,
        }}
        onClick={onClick}
        onMouseDown={(e) => onMouseDown(e, "move")}
      >
        {isSelected && !el.locked && <ResizeHandle onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, "resize-br"); }} />}
      </div>
    );
  }

  return null;
}

// -- Bottom-right resize handle ------------------------------------------------

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position:        "absolute",
        right:           -4,
        bottom:          -4,
        width:           8,
        height:          8,
        backgroundColor: "#0c8fe7",
        border:          "1.5px solid white",
        borderRadius:    2,
        cursor:          "se-resize",
        zIndex:          100,
      }}
    />
  );
}
