"use client";

/**
 * components/print/LabelCanvas.tsx
 *
 * Renders one label using its template + resolved data.
 *
 * Props:
 *   label      – LabelRecord (the data)
 *   template   – LabelTemplate (the layout)
 *   scale      – 1.0 = physical mm size (for print), <1 = thumbnail
 *   batchInfo  – optional extra batch fields not on LabelRecord
 *   className  – extra wrapper class
 *   style      – extra wrapper style
 */

import React from "react";
import type { LabelRecord, LabelTemplate, CanvasElement, TextElement, ImageElement, LineElement } from "@/types";
import {
  resolveTokens,
  resolveElementContent,
  elementToCSS,
  MM_TO_PX_96,
  mm,
} from "@/lib/label-renderer";

interface Props {
  label:     LabelRecord;
  template:  LabelTemplate;
  scale?:    number;
  batchInfo?: { customerName: string; soNumber: string; customerInitial: string };
  className?: string;
  style?:     React.CSSProperties;
}

export function LabelCanvas({
  label,
  template,
  scale = 1,
  batchInfo,
  className = "",
  style,
}: Props) {
  const resolved = resolveTokens(label, batchInfo);

  const canvasW  = mm(template.width,  scale);
  const canvasH  = mm(template.height, scale);

  return (
    <div
      className={className}
      style={{
        width:           canvasW,
        height:          canvasH,
        backgroundColor: template.background || "#ffffff",
        position:        "relative",
        overflow:        "hidden",
        flexShrink:      0,
        ...style,
      }}
    >
      {template.elements.map((el) => (
        <ElementRenderer
          key={el.id}
          el={el}
          scale={scale}
          resolved={resolved}
        />
      ))}
    </div>
  );
}

// --- SINGLE ELEMENT RENDERER -------------------------------------------------

function ElementRenderer({
  el,
  scale,
  resolved,
}: {
  el:       CanvasElement;
  scale:    number;
  resolved: ReturnType<typeof resolveTokens>;
}) {
  const css     = elementToCSS(el, scale);
  const content = resolveElementContent(el, resolved);

  // -- Line ----------------------------------------------------------------
  if (el.type === "line") {
    return <div style={css} />;
  }

  // -- Image ----------------------------------------------------------------
  if (el.type === "image") {
    const img = el as ImageElement;
    if (content) {
      return (
        <div style={css}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={content}
            alt=""
            style={{
              width:      "100%",
              height:     "100%",
              objectFit:  img.objectFit,
              display:    "block",
            }}
          />
        </div>
      );
    }
    // Placeholder when no image URL resolved (e.g. no logo selected)
    return (
      <div
        style={{
          ...css,
          border:     `${Math.max(0.5, scale * 0.5)}px dashed #cbd5e1`,
          background: "#f1f5f9",
        }}
      />
    );
  }

  // -- Text ----------------------------------------------------------------
  const txt = el as TextElement;
  return (
    <div style={css}>
      <span
        style={{
          width:        "100%",
          display:      "block",
          textAlign:    txt.align,
          overflow:     "hidden",
          // Multi-line wrap for process list etc.
          whiteSpace:   content.length > 30 ? "pre-wrap" : "nowrap",
          wordBreak:    "break-word",
        }}
      >
        {content}
      </span>
    </div>
  );
}
