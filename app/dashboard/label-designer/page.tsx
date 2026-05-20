"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/Modal";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus, PenTool, Trash2, Copy, Calendar,
  Maximize2, ChevronRight, LayoutTemplate, X
} from "lucide-react";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  getTemplates,
  createTemplate,
  duplicateTemplate,
  deleteTemplate,
} from "@/lib/label-designer";
import { PRESET_SIZES } from "@/types";
import type { LabelTemplate, LabelTemplateFormData, PresetSize } from "@/types";
import { cn } from "@/lib/utils";

// --- VALIDATION SCHEMA --------------------------------------------------------

const schema = z.object({
  name:        z.string().min(1, "Name is required").max(80),
  description: z.string().max(200).optional().or(z.literal("")),
  width:       z.number().min(10, "Min 10mm").max(500, "Max 500mm"),
  height:      z.number().min(10, "Min 10mm").max(500, "Max 500mm"),
  background:  z.string(), 
});
type FormValues = z.infer<typeof schema>;

// --- MINI CANVAS PREVIEW ------------------------------------------------------

function TemplatePreview({ template }: { template: LabelTemplate }) {
  const MAX = 180;
  const scale = Math.min(MAX / template.width, (MAX * 0.6) / template.height);
  const pw    = template.width  * scale;
  const ph    = template.height * scale;

  return (
    <div className="flex items-center justify-center p-4 bg-slate-950 rounded-lg min-h-[120px]">
      <div
        style={{
          width:           pw,
          height:          ph,
          backgroundColor: template.background || "#ffffff",
          position:        "relative",
          overflow:        "hidden",
          border:          "1px solid #334155",
          borderRadius:    2,
          flexShrink:      0,
        }}
      >
        {template.elements.map((el) => {
          const style: React.CSSProperties = {
            position: "absolute",
            left:     el.x     * scale,
            top:      el.y     * scale,
            width:    el.width  * scale,
            height:   el.height * scale,
          };

          if (el.type === "text") {
            return (
              <div
                key={el.id}
                style={{
                  ...style,
                  fontSize:   Math.max(3, el.fontSize * scale * 0.4),
                  fontWeight: el.fontWeight,
                  fontStyle:  el.fontStyle,
                  color:      el.color,
                  textAlign:  el.align,
                  overflow:   "hidden",
                  lineHeight: el.lineHeight,
                  background: el.background || "transparent",
                  whiteSpace: "nowrap",
                }}
              >
                {el.content}
              </div>
            );
          }
          if (el.type === "line") {
            return (
              <div key={el.id} style={{ ...style, backgroundColor: el.color }} />
            );
          }
          if (el.type === "image") {
            return (
              <div
                key={el.id}
                style={{
                  ...style,
                  backgroundColor: "#e2e8f0",
                  border: "1px dashed #94a3b8",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 4, color: "#64748b",
                }}
              >
                {el.variable ? "IMG" : ""}
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

// --- PAGE ---------------------------------------------------------------------

export default function LabelDesignerPage() {
  const router = useRouter();

  const [templates, setTemplates]       = useState<LabelTemplate[]>([]);
  const [loading, setLoading]           = useState(true);
  const [createOpen, setCreateOpen]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LabelTemplate | null>(null);
  const [saving, setSaving]             = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PresetSize>(PRESET_SIZES[0]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      background: "#ffffff",
      width:      100,
      height:     50,
    },
  });

  const watchW = watch("width");
  const watchH = watch("height");

  async function load() {
    setLoading(true);
    try {
      setTemplates(await getTemplates());
    } catch {
      toast.error("Failed to load templates.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function applyPreset(preset: PresetSize) {
    setSelectedPreset(preset);
    if (preset.width > 0) {
      setValue("width",  preset.width,  { shouldValidate: true });
      setValue("height", preset.height, { shouldValidate: true });
    }
  }

  async function onCreate(values: FormValues) {
    setSaving(true);
    try {
      const data: LabelTemplateFormData = {
        name:        values.name,
        description: values.description ?? "",
        width:       values.width,
        height:      values.height,
        background:  values.background,
      };
      const tmpl = await createTemplate(data);
      toast.success(`"${tmpl.name}" created.`);
      router.push(`/dashboard/label-designer/${tmpl.id}`);
    } catch {
      toast.error("Failed to create template.");
      setSaving(false);
    }
  }

  async function onDuplicate(tmpl: LabelTemplate) {
    try {
      const copy = await duplicateTemplate(tmpl, `${tmpl.name} (Copy)`);
      toast.success(`Duplicated as "${copy.name}".`);
      await load();
    } catch {
      toast.error("Duplicate failed.");
    }
  }

  async function onDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTemplate(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error("Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  function openCreate() {
    reset({ name: "", description: "", width: 100, height: 50, background: "#ffffff" });
    setSelectedPreset(PRESET_SIZES[0]);
    setCreateOpen(true);
  }

  // --- RENDER -----------------------------------------------------------------
  return (
    <RouteGuard requiredPage="label-designer">
      <div className="animate-fade-in">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Label Designer</h1>
            <p className="page-subtitle">
              {loading
                ? "Loading…"
                : `${templates.length} template${templates.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button onClick={openCreate} className="btn-primary">
            <Plus size={15} /> New Template
          </button>
        </div>

        {/* Template grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3">
            <span className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-slate-400 text-sm">Loading templates…</span>
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            Icon={LayoutTemplate}
            title="No templates yet"
            description="Create your first label template. Define the canvas size, drag in variables, and save for use in Production."
            action={
              <button onClick={openCreate} className="btn-primary">
                <Plus size={14} /> New Template
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {templates.map((tmpl) => (
              <div
                key={tmpl.id}
                className="card group hover:border-slate-700 transition-all duration-200 flex flex-col overflow-hidden"
              >
                {/* Mini canvas preview */}
                <button
                  onClick={() => router.push(`/dashboard/label-designer/${tmpl.id}`)}
                  className="block hover:opacity-90 transition-opacity"
                >
                  <TemplatePreview template={tmpl} />
                </button>

                {/* Card body */}
                <div className="p-3 flex flex-col gap-2 flex-1">
                  {/* Name + open */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white font-medium text-sm truncate">{tmpl.name}</p>
                      {tmpl.description && (
                        <p className="text-slate-500 text-xs mt-0.5 truncate">{tmpl.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => router.push(`/dashboard/label-designer/${tmpl.id}`)}
                      className="shrink-0 flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors"
                    >
                      Edit <ChevronRight size={12} />
                    </button>
                  </div>

                  {/* Dimensions + element count */}
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Maximize2 size={11} />
                      {tmpl.width}×{tmpl.height}mm
                    </span>
                    <span className="flex items-center gap-1">
                      <LayoutTemplate size={11} />
                      {tmpl.elements.length} element{tmpl.elements.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Updated date */}
                  <p className="text-slate-600 text-[11px] flex items-center gap-1">
                    <Calendar size={10} />
                    {new Date(tmpl.updatedAt).toLocaleDateString("id-ID", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-1 mt-auto pt-2 border-t border-slate-800">
                    <button
                      onClick={() => router.push(`/dashboard/label-designer/${tmpl.id}`)}
                      className="flex-1 btn-secondary text-xs py-1.5"
                    >
                      <PenTool size={12} /> Open Designer
                    </button>
                    <button
                      onClick={() => onDuplicate(tmpl)}
                      title="Duplicate"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(tmpl)}
                      title="Delete"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* -- CUSTOM CENTERED CREATE MODAL ---------------------------------------- */}
      {createOpen && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          
          {/* Kotak Modal Utama */}
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            
            {/* Header Modal (Fixed) */}
            <div className="flex items-center justify-between p-6 border-b border-slate-800 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white">New Label Template</h2>
                <p className="text-sm text-slate-400 mt-1">Define the canvas size and a name.</p>
              </div>
              <button onClick={() => setCreateOpen(false)} className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Form & Body Modal (Scrollable) */}
            <form onSubmit={handleSubmit(onCreate)} className="flex flex-col min-h-0" noValidate>
              
              <div className="p-6 overflow-y-auto flex-1 space-y-5">
                {/* Name */}
                <div>
                  <label className="form-label">Template Name <span className="text-red-400">*</span></label>
                  <input
                    {...register("name")}
                    placeholder="Standard Laminated Label"
                    className={cn("input-base", errors.name && "border-red-500")}
                    autoFocus
                  />
                  {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
                </div>

                {/* Description */}
                <div>
                  <label className="form-label">Description</label>
                  <input
                    {...register("description")}
                    placeholder="Used for laminated glass production orders"
                    className="input-base"
                  />
                </div>

                {/* Preset sizes */}
                <div>
                  <label className="form-label">Canvas Size</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                    {PRESET_SIZES.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className={cn(
                          "px-3 py-2 rounded-lg border text-xs font-medium text-left transition-colors",
                          selectedPreset.label === preset.label
                            ? "bg-brand-600/20 border-brand-500/50 text-brand-300"
                            : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white"
                        )}
                      >
                        <p className="font-semibold">{preset.label.split(" (")[0]}</p>
                        {preset.width > 0 && (
                          <p className="text-slate-500 mt-0.5">{preset.width}×{preset.height}mm</p>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Custom W × H inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Width (mm) <span className="text-red-400">*</span></label>
                      <div className="relative">
                        <input
                          {...register("width", { valueAsNumber: true })}
                          type="number"
                          step="1"
                          min="10"
                          max="500"
                          className={cn("input-base pr-10 font-mono", errors.width && "border-red-500")}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none">mm</span>
                      </div>
                      {errors.width && <p className="mt-1 text-xs text-red-400">{errors.width.message}</p>}
                    </div>
                    <div>
                      <label className="form-label">Height (mm) <span className="text-red-400">*</span></label>
                      <div className="relative">
                        <input
                          {...register("height", { valueAsNumber: true })}
                          type="number"
                          step="1"
                          min="10"
                          max="500"
                          className={cn("input-base pr-10 font-mono", errors.height && "border-red-500")}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none">mm</span>
                      </div>
                      {errors.height && <p className="mt-1 text-xs text-red-400">{errors.height.message}</p>}
                    </div>
                  </div>

                  {/* Live dimension preview */}
                  {watchW > 0 && watchH > 0 && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                      <Maximize2 size={11} />
                      Canvas: <span className="text-white font-mono">{watchW}×{watchH}mm</span>
                      <span className="text-slate-600">
                        ({(watchW * 3.78).toFixed(0)}×{(watchH * 3.78).toFixed(0)}px @ 96dpi)
                      </span>
                    </div>
                  )}
                </div>

                {/* Background */}
                <div>
                  <label className="form-label">Background Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      {...register("background")}
                      type="color"
                      className="w-10 h-9 rounded cursor-pointer bg-slate-800 border border-slate-700 p-0.5 shrink-0"
                    />
                    <input
                      {...register("background")}
                      type="text"
                      placeholder="#ffffff"
                      className="input-base flex-1 font-mono uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Footer Modal (Fixed, Floating di bawah) */}
              <div className="p-6 border-t border-slate-800 shrink-0 flex justify-end gap-3 bg-slate-900 rounded-b-2xl">
                <button type="button" onClick={() => setCreateOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : <Plus size={14} />}
                  Create & Open Designer
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* -- DELETE CONFIRM ------------------------------------------------------ */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onDelete}
        loading={deleting}
        title="Delete Template"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone. Any Production forms using this template will lose their layout reference.`}
        confirmLabel="Delete Template"
      />
    </RouteGuard>
  );
}