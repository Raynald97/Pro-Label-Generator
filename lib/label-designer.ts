/**
 * lib/label-designer.ts
 *
 * Firestore CRUD for LabelTemplate + pure utility helpers used by
 * the designer canvas and the Production renderer.
 *
 * NO React imports here — this file is safe to import from both
 * client components and server-side code.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  LabelTemplate,
  LabelTemplateFormData,
  CanvasElement,
  TextElement,
  ImageElement,
  LineElement,
  VariableDefinition,
  VariableToken,
} from "@/types";

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════════

/** Base pixels-per-mm at 96 dpi screen resolution */
export const MM_TO_PX = 3.7795275591;

/** Snap grid in mm — elements snap to this value when dragging */
export const GRID_MM = 1;

/** Minimum element size in mm */
export const MIN_ELEMENT_MM = 3;

/** Default zoom level */
export const DEFAULT_ZOOM = 1.5;

// ════════════════════════════════════════════════════════════════════════════
// VARIABLE CATALOGUE
// ════════════════════════════════════════════════════════════════════════════

export const VARIABLE_DEFINITIONS: VariableDefinition[] = [
  // -- Order --------------------------------------------------------------
  {
    token:       "{{so_number}}",
    label:       "SO Number",
    category:    "order",
    description: 'Prints as "SO: 2400123"',
    isImage:     false,
  },
  {
    token:       "{{project_initial}}",
    label:       "Project Initial",
    category:    "order",
    description: 'Project short code, e.g. "PRJ"',
    isImage:     false,
  },
  {
    token:       "{{cust_name}}",
    label:       "Customer Name",
    category:    "order",
    description: "Full customer name from Master Data",
    isImage:     false,
  },
  {
    token:       "{{cust_initial}}",
    label:       "Customer Initial",
    category:    "order",
    description: 'Short code, e.g. "PTI"',
    isImage:     false,
  },
  {
    token:       "{{city}}",
    label:       "City",
    category:    "order",
    description: "Delivery city",
    isImage:     false,
  },
  {
    token:       "{{target_schedule}}",
    label:       "Target Schedule",
    category:    "order",
    description: 'Formatted as "Ts: 26 Feb"',
    isImage:     false,
  },
  {
    token:       "{{revision}}",
    label:       "Revision",
    category:    "order",
    description: 'Prints as "R1", "R2" etc.',
    isImage:     false,
  },
  {
    token:       "{{label_index}}",
    label:       "Label Index",
    category:    "order",
    description: 'Prints as "1 of 5", "2 of 5" etc.',
    isImage:     false,
  },
  // -- Glass ---------------------------------------------------------------
  {
    token:       "{{kog_initial}}",
    label:       "KoG Initial",
    category:    "glass",
    description: 'Kind of Glass short code, e.g. "TMP"',
    isImage:     false,
  },
  {
    token:       "{{kog_name}}",
    label:       "KoG Name",
    category:    "glass",
    description: 'Full name of Glass (e.g. Tempered)',
    isImage:     false,
  },
  {
    token:       "{{qr_code}}",
    label:       "QR Code SO",
    category:    "image",
    description: "QR Code details for scanning",
    isImage:     true,
  },
  {
    token:       "{{cat_initial}}",
    label:       "Category Initial",
    category:    "glass",
    description: "Category short code",
    isImage:     false,
  },
  {
    token:       "{{pvb_initial}}",
    label:       "PVB Initial",
    category:    "glass",
    description: 'Interlayer short code, e.g. "PVB"',
    isImage:     false,
  },
  {
    token:       "{{thickness_calc}}",
    label:       "Thickness Calc",
    category:    "glass",
    description: 'Formatted as "(06+1.52+06)"',
    isImage:     false,
  },
  {
    token:       "{{dimensions}}",
    label:       "Dimensions",
    category:    "glass",
    description: 'Width × Height, e.g. "1500x700"',
    isImage:     false,
  },
  {
    token:       "{{cut_shape}}",
    label:       "Cut Shape Name",
    category:    "glass",
    description: 'Full Cut Shape name, e.g. "Rectangle"',
    isImage:     false,
  },
  {
    token:       "{{cut_shape_initial}}",
    label:       "Cut Shape Initial",
    category:    "glass",
    description: 'Cut Shape short code, e.g. "SQ"',
    isImage:     false,
  },
  {
    token:       "{{glass_layers}}",
    label:       "Glass Layers",
    category:    "glass",
    description: 'e.g. "L1:DG06 L2:DG06"',
    isImage:     false,
  },
  {
  token:       "{{alerts}}",
  label:       "Alert Text",
  category:    "production",
  description: "Teks instruksi produksi dari baris terkait",
  isImage:     false,
  },
  {
  token:       "{{alert_icon}}",
  label:       "Alert Symbol",
  category:    "image",
  description: "Simbol peringatan (muncul otomatis jika baris memiliki alert)",
  isImage:     true,
  },
  // -- Production ----------------------------------------------------------
  {
    token:       "{{process_list}}",
    label:       "Process List",
    category:    "production",
    description: "Comma-separated checked processes",
    isImage:     false,
  },
  {
    token:       "{{process_initials}}",
    label:       "Process Initials",
    category:    "production",
    description: 'Comma-separated short codes, e.g. "TP, LM"',
    isImage:     false,
  },
  {
    token:       "{{edge_process}}",
    label:       "Edge Process",
    category:    "production",
    description: 'e.g. "FP[B,T,L,R]"',
    isImage:     false,
  },
  {
    token:       "{{marking_code}}",
    label:       "Marking Code",
    category:    "production",
    description: 'e.g. "M:SNI[BR8]"',
    isImage:     false,
  },
  // -- Image ---------------------------------------------------------------
  {
    token:       "{{logo}}",
    label:       "Logo Image",
    category:    "image",
    description: "Logo selected in Production",
    isImage:     true,
  },
  {
    token:       "{{marking_image}}",
    label:       "Marking Image",
    category:    "image",
    description: "Marking stamp image",
    isImage:     true,
  },
];

// ════════════════════════════════════════════════════════════════════════════
// ELEMENT FACTORIES
// ════════════════════════════════════════════════════════════════════════════

function uid(): string {
  return `el_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function makeTextElement(
  token: VariableToken | null,
  label: string,
  x: number,
  y: number,
  canvasWidth: number
): TextElement {
  return {
    id:         uid(),
    type:       "text",
    x:          snapToGrid(x),
    y:          snapToGrid(y),
    width:      snapToGrid(Math.min(40, canvasWidth * 0.4)),
    height:     8,
    content:    token ?? label,
    variable:   token,
    fontSize:   9,
    fontFamily: "Arial",
    fontWeight: "normal",
    fontStyle:  "normal",
    color:      "#000000",
    align:      "left",
    lineHeight: 1.2,
    background: null,
    border:     false,
    locked:     false,
  };
}

export function makeImageElement(
  token: VariableToken,
  x: number,
  y: number
): ImageElement {
  return {
    id:        uid(),
    type:      "image",
    x:         snapToGrid(x),
    y:         snapToGrid(y),
    width:     15,
    height:    10,
    variable:  token,
    src:       null,
    objectFit: "contain",
    locked:    false,
  };
}

export function makeLineElement(
  x: number,
  y: number,
  canvasWidth: number,
  direction: "horizontal" | "vertical" = "horizontal"
): LineElement {
  return {
    id:        uid(),
    type:      "line",
    x:         snapToGrid(x),
    y:         snapToGrid(y),
    width:     direction === "horizontal" ? Math.min(40, canvasWidth) : 0.5,
    height:    direction === "horizontal" ? 0.5 : 10,
    variable:  null,
    color:     "#000000",
    direction,
    locked:    false,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// COORDINATE HELPERS
// ════════════════════════════════════════════════════════════════════════════

export function snapToGrid(mm: number): number {
  return Math.round(mm / GRID_MM) * GRID_MM;
}

export function mmToPx(mm: number, zoom = 1): number {
  return mm * MM_TO_PX * zoom;
}

export function pxToMm(px: number, zoom = 1): number {
  return px / (MM_TO_PX * zoom);
}

export function clampElement(
  el: CanvasElement,
  canvasW: number,
  canvasH: number
): Partial<CanvasElement> {
  const x = Math.max(0, Math.min(el.x, canvasW - el.width));
  const y = Math.max(0, Math.min(el.y, canvasH - el.height));
  return { x: snapToGrid(x), y: snapToGrid(y) };
}

export function ptToMm(pt: number): number {
  return pt * 0.352778;
}

// ════════════════════════════════════════════════════════════════════════════
// DISPLAY HELPERS
// ════════════════════════════════════════════════════════════════════════════

export function elementLabel(el: CanvasElement): string {
  if (el.type === "line") return "Line";
  if (el.type === "image") return el.variable ? varLabel(el.variable) : "Static Image";
  const txt = el as TextElement;
  if (txt.variable) return varLabel(txt.variable);
  return txt.content.length > 22 ? txt.content.slice(0, 22) + "…" : txt.content;
}

function varLabel(token: VariableToken): string {
  return VARIABLE_DEFINITIONS.find((v) => v.token === token)?.label ?? token;
}

export function previewContent(el: TextElement): string {
  const PREVIEWS: Partial<Record<VariableToken, string>> = {
    "{{so_number}}":       "SO: 2400123",
    "{{cust_name}}":       "PT. Example Indonesia",
    "{{cust_initial}}":    "PTI",
    "{{city}}":            "Jakarta",
    "{{target_schedule}}": "Ts: 26 Feb",
    "{{revision}}":        "R1",
    "{{label_index}}":     "1 of 5",
    "{{kog_name}}": "Tempered Glass",
    "{{qr_code}}":  "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=Preview",
    "{{kog_initial}}":     "TMP",
    "{{cat_initial}}":     "STD",
    "{{thickness_calc}}":  "(06+1.52+06)",
    "{{dimensions}}":      "1500×700",
    "{{cut_shape}}":       "REC",
    "{{process_list}}":    "Cutting, Tempering",
    "{{glass_layers}}":    "L1:DG06 L2:DG06",
    "{{edge_process}}":    "FP[B,T,L,R]",
    "{{marking_code}}":    "M:SNI[BR8]",
    "{{pvb_initial}}":       "PVB",
    "{{cut_shape_initial}}": "SQ",
    "{{process_initials}}":  "TP, LM",
    "{{project_initial}}":   "PRJ",
    "{{alerts}}":          "Hati-hati sisi coating luar",
    "{{alert_icon}}":      "https://cdn-icons-png.flaticon.com/512/564/564619.png",
  };
  if (el.variable && el.variable in PREVIEWS) {
    return PREVIEWS[el.variable as VariableToken]!;
  }
  return el.content || el.variable || "Text";
}

// ════════════════════════════════════════════════════════════════════════════
// UNDO / REDO STACK HELPERS
// ════════════════════════════════════════════════════════════════════════════

export interface HistoryStack {
  past:    CanvasElement[][];
  present: CanvasElement[];
  future:  CanvasElement[][];
}

export function historyPush(stack: HistoryStack, next: CanvasElement[]): HistoryStack {
  return {
    past:    [...stack.past, stack.present].slice(-50),
    present: next,
    future:  [],
  };
}

export function historyUndo(stack: HistoryStack): HistoryStack {
  if (stack.past.length === 0) return stack;
  const previous = stack.past[stack.past.length - 1];
  return {
    past:    stack.past.slice(0, -1),
    present: previous,
    future:  [stack.present, ...stack.future],
  };
}

export function historyRedo(stack: HistoryStack): HistoryStack {
  if (stack.future.length === 0) return stack;
  const next = stack.future[0];
  return {
    past:    [...stack.past, stack.present],
    present: next,
    future:  stack.future.slice(1),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// FIRESTORE HELPERS
// ════════════════════════════════════════════════════════════════════════════

function normalise(data: DocumentData): DocumentData {
  const out: DocumentData = {};
  for (const [k, v] of Object.entries(data)) {
    if (v instanceof Timestamp) {
      out[k] = v.toDate().toISOString();
    } else if (Array.isArray(v)) {
      out[k] = v.map((item) =>
        item && typeof item === "object" && !(item instanceof Timestamp)
          ? normalise(item as DocumentData)
          : item instanceof Timestamp
          ? item.toDate().toISOString()
          : item
      );
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
// FIRESTORE CRUD
// ════════════════════════════════════════════════════════════════════════════

const COL = "labelTemplates";

/** Load all templates */
export async function getTemplates(): Promise<LabelTemplate[]> {
  const q    = query(collection(db, COL), orderBy("updatedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...normalise(d.data()), id: d.id } as LabelTemplate));
}

/** Load a single template by ID */
export async function getTemplate(id: string): Promise<LabelTemplate | null> {
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) return null;
  return { ...normalise(snap.data()), id: snap.id } as LabelTemplate;
}

/** Create a new empty template */
export async function createTemplate(
  data: LabelTemplateFormData
): Promise<LabelTemplate> {
  const now     = new Date().toISOString();
  const payload: Omit<LabelTemplate, "id"> = {
    name:        data.name.trim(),
    description: data.description.trim(),
    width:       data.width,
    height:      data.height,
    background:  data.background || "#ffffff",
    showGrid:    true,
    elements:    [],
    createdAt:   now,
    updatedAt:   now,
  };
  const ref = await addDoc(collection(db, COL), payload);
  return { id: ref.id, ...payload };
}

/** Update template metadata */
export async function updateTemplateMetadata(
  id:   string,
  data: Partial<LabelTemplateFormData>
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

/** Save the current canvas elements */
export async function saveTemplateElements(
  id:       string,
  elements: CanvasElement[]
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    elements,
    updatedAt: new Date().toISOString(),
  });
}

/** Duplicate a template */
export async function duplicateTemplate(
  template: LabelTemplate,
  newName:  string
): Promise<LabelTemplate> {
  const now = new Date().toISOString();
  
  // BUANG id LAMA
  const { id: _oldId, ...restOfTemplate } = template;

  const payload: Omit<LabelTemplate, "id"> = {
    ...restOfTemplate,
    name:      newName,
    createdAt: now,
    updatedAt: now,
  };
  
  // Berikan ID baru untuk setiap elemen di dalamnya
  payload.elements = template.elements.map((el) => ({ ...el, id: uid() }));
  
  const ref = await addDoc(collection(db, COL), payload);
  return { id: ref.id, ...payload };
}

/** Delete a template permanently */
export async function deleteTemplate(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

/**
 * MM_TO_PX, GRID_MM, MIN_ELEMENT_MM, DEFAULT_ZOOM, VARIABLE_DEFINITIONS,
 * makeTextElement, makeImageElement, makeLineElement, snapToGrid, mmToPx,
 * pxToMm, clampElement, ptToMm, elementLabel, previewContent, historyPush,
 * historyUndo, historyRedo, HistoryStack, getTemplates, getTemplate,
 * createTemplate, updateTemplateMetadata, saveTemplateElements,
 * duplicateTemplate, deleteTemplate
 */