/**
 * lib/label-renderer.ts
 *
 * Pure token-resolution engine: maps a LabelRecord + LabelTemplate →
 * a filled canvas that can be rendered to screen or printed to PDF.
 *
 * No React imports. Safe to call anywhere.
 */

import type {
  LabelRecord,
  LabelTemplate,
  CanvasElement,
  TextElement,
  ImageElement,
  VariableToken,
} from "@/types";
import {
  formatTargetSchedule,
  formatRevision,
  formatLabelIndex,
  formatGlassLayers,
  formatDimensions,
} from "./production";

// ════════════════════════════════════════════════════════════════════════════
// TOKEN RESOLUTION MAP
// Returns the print-time string (or image URL) for every token.
// ════════════════════════════════════════════════════════════════════════════

export interface ResolvedValues {
  text:   Record<string, string>;   // token → display string
  images: Record<string, string>;   // token → URL (or "")
}

export function resolveTokens(
  label:  LabelRecord,
  batch?: { soNumber: string; customerName: string; customerInitial: string }
): ResolvedValues {
  
  // --- 1. Bikin teks gabungan yang akan muncul kalau QR di-scan
  // Kita menggunakan (label as any) untuk menghindari error TypeScript jika type index.ts belum terupdate sempurna
  const kogNameStr = (label as any).kogName || label.kogInitial;
  const qrData = `SO: ${label.soNumber}\nRev: R${label.revision}\nCustomer: ${label.customerInitial}\nKoG: ${kogNameStr}\nSize: ${label.dimensionW}x${label.dimensionH} mm\nThickness: ${label.thicknessFormatted}\nProcesses: ${label.processNames.join(", ")}`;
  
  // --- 2. Ubah teks tersebut jadi URL Gambar QR Code via API
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}&margin=0`;

  const text: Record<string, string> = {
    "{{so_number}}":      `SO: ${label.soNumber}`,
    "{{cust_name}}":      batch?.customerName    ?? label.customerInitial,
    "{{cust_initial}}":   label.customerInitial,
    "{{city}}":           label.city,
    "{{target_schedule}}": formatTargetSchedule(label.targetSchedule),
    "{{revision}}":       formatRevision(label.revision),
    "{{label_index}}":    formatLabelIndex(label.labelIndex, label.totalLabels),
    "{{kog_initial}}":    label.kogInitial,
    "{{cat_initial}}":    label.categoryInitial ?? "",
    "{{thickness_calc}}": label.thicknessFormatted,
    "{{dimensions}}":     formatDimensions(label.dimensionW, label.dimensionH),
    "{{cut_shape}}":      label.cutShapeName,
    "{{process_list}}":   label.processNames.join(", "),
    "{{glass_layers}}":   formatGlassLayers(label.glassLayers),
    "{{edge_process}}":   label.edgeFormatted ?? "",
    "{{marking_code}}":   label.markingCode   ?? "",
    "{{pvb_initial}}":       (label as any).interlayerInitial || "-",
    "{{cut_shape_initial}}": (label as any).cutShapeInitial || "-",
    "{{process_initials}}":  (label as any).processesInitial || "-",
    "{{project_initial}}":   (label as any).projectInitial || "-",
    "{{kog_name}}":          kogNameStr || "-",
  };

  const images: Record<string, string> = {
    "{{logo}}":           label.logoUrl        ?? "",
    "{{marking_image}}":  label.markingImageUrl ?? "",
    "{{qr_code}}":        qrUrl, // <--- Token QR mengembalikan URL API QR Code
  };

  return { text, images };
}

// ════════════════════════════════════════════════════════════════════════════
// ELEMENT CONTENT RESOLVER
// Given a single canvas element + resolved values, returns the
// actual content string or image URL to render.
// ════════════════════════════════════════════════════════════════════════════

export function resolveElementContent(
  el:       CanvasElement,
  resolved: ResolvedValues
): string {
  if (el.type === "line") return "";

  if (el.type === "image") {
    const img = el as ImageElement;
    if (img.variable && img.variable in resolved.images) {
      return resolved.images[img.variable];
    }
    return img.src ?? "";
  }

  // Text element
  const txt = el as TextElement;
  if (txt.variable && txt.variable in resolved.text) {
    // Abaikan error TS di sini jika VariabelToken belum ter-update sempurna
    return resolved.text[txt.variable as any] || txt.content; 
  }
  // Static text — return content as-is
  return txt.content;
}

// ════════════════════════════════════════════════════════════════════════════
// MM → PX at 96dpi (for screen rendering)
// ════════════════════════════════════════════════════════════════════════════

export const MM_TO_PX_96 = 3.7795275591;

export function mm(val: number, scale = 1): number {
  return val * MM_TO_PX_96 * scale;
}

// ════════════════════════════════════════════════════════════════════════════
// CSS PROPERTIES BUILDER
// Converts a canvas element's mm coordinates → inline CSS for rendering.
// Used by both the screen preview and the printable sheet.
// ════════════════════════════════════════════════════════════════════════════

export function elementToCSS(
  el:    CanvasElement,
  scale: number   // 1 = actual size (print), <1 = thumbnail
): React.CSSProperties {
  const base: React.CSSProperties = {
    position:   "absolute",
    left:       mm(el.x,      scale),
    top:        mm(el.y,      scale),
    width:      mm(el.width,  scale),
    height:     mm(el.height, scale),
    boxSizing:  "border-box",
    overflow:   "hidden",
  };

  if (el.type === "text") {
    const t = el as TextElement;
    // pt → px: 1pt = 1/72 inch, 1 inch = 96px → 1pt = 96/72 = 1.333px
    // Then multiply by scale
    const fontPx = t.fontSize * (96 / 72) * scale;
    return {
      ...base,
      display:         "flex",
      alignItems:      "center",
      fontSize:        fontPx,
      fontFamily:      t.fontFamily,
      fontWeight:      t.fontWeight,
      fontStyle:       t.fontStyle,
      color:           t.color,
      textAlign:       t.align,
      lineHeight:      t.lineHeight,
      backgroundColor: t.background ?? "transparent",
      border:          t.border ? `${Math.max(0.5, scale)}px solid ${t.color}` : "none",
      padding:         `0 ${mm(0.5, scale)}px`,
      whiteSpace:      "pre-wrap",
      wordBreak:       "break-word",
    };
  }

  if (el.type === "line") {
    const l = el as import("@/types").LineElement;
    return {
      ...base,
      backgroundColor: l.color,
    };
  }

  if (el.type === "image") {
    return {
      ...base,
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      overflow:       "hidden",
    };
  }

  return base;
}