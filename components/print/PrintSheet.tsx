"use client";

/**
 * components/print/PrintSheet.tsx
 *
 * Renders all labels in a batch ready for @media print.
 * Mounted as a portal so it doesn't affect the main UI layout.
 * Each label gets its own page via `page-break-after: always`.
 *
 * Usage:
 *   <PrintSheet
 *     labels={labels}
 *     template={template}
 *     batch={batch}
 *     onClose={() => setPrintOpen(false)}
 *   />
 *
 * Printing flow:
 *   1. Component mounts and injects @page CSS into <head>
 *   2. After 300ms (fonts settle), window.print() is called
 *   3. onClose() fires after print dialog closes
 */

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { LabelCanvas } from "./LabelCanvas";
import type { LabelRecord, LabelBatch, LabelTemplate } from "@/types";

interface Props {
  labels:   LabelRecord[];
  template: LabelTemplate;
  batch:    LabelBatch;
  onClose:  () => void;
}

export function PrintSheet({ labels, template, batch, onClose }: Props) {
  const styleRef = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    // ── 1. Inject @page and print CSS ─────────────────────────────────────
    const style        = document.createElement("style");
    style.id           = "label-print-styles";
    style.textContent  = `
      @page {
        size: ${template.width}mm ${template.height}mm;
        margin: 0;
      }

      @media print {
        /* Hide absolutely everything that is NOT the print sheet */
        body > *:not(#label-print-portal) {
          display: none !important;
        }

        /* 1. SEMBUNYIKAN TOOLBAR SAAT DI-PRINT */
        .print-preview-toolbar {
          display: none !important;
        }

        /* 2. RESET CONTAINER AGAR PAS DI KERTAS STIKER */
        #label-print-portal {
          display: block !important;
          position: static !important;
          background: transparent !important;
        }

        .print-preview-scroll {
          display: block !important;
          padding: 0 !important;
          gap: 0 !important;
          overflow: visible !important;
        }

        .label-print-page {
          width:             ${template.width}mm;
          height:            ${template.height}mm;
          page-break-after:  always;
          break-after:       page;
          overflow:          hidden;
          position:          relative;
          box-shadow:        none !important; /* Hilangkan bayangan saat print */
          margin:            0 !important;
        }

        .label-print-page:last-child {
          page-break-after:  avoid;
          break-after:       avoid;
        }
      }

      /* Screen preview overlay */
      #label-print-portal {
        position:         fixed;
        inset:            0;
        z-index:          9999;
        background:       rgba(0, 0, 0, 0.85);
        display:          flex;
        flex-direction:   column;
        overflow:         hidden;
      }

      .print-preview-toolbar {
        display:          flex;
        align-items:      center;
        gap:              12px;
        padding:          10px 20px;
        background:       #0f172a;
        border-bottom:    1px solid #1e293b;
        flex-shrink:      0;
      }

      .print-preview-scroll {
        flex:             1;
        overflow-y:       auto;
        display:          flex;
        flex-direction:   column;
        align-items:      center;
        gap:              16px;
        padding:          24px;
      }

      .label-screen-wrapper {
        box-shadow:       0 2px 20px rgba(0,0,0,0.5);
      }
    `;
    document.head.appendChild(style);
    styleRef.current = style;

    // ── 2. Auto-print after fonts settle ──────────────────────────────────
    const t = setTimeout(() => {
      window.print();
      // onClose after print dialog dismisses
      window.addEventListener("afterprint", onClose, { once: true });
    }, 350);

    return () => {
      clearTimeout(t);
      style.remove();
      window.removeEventListener("afterprint", onClose);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const batchInfo = {
    soNumber:        batch.soNumber,
    customerName:    batch.customerName,
    customerInitial: batch.customerInitial,
  };

  const content = (
    <div id="label-print-portal">
      {/* ── Screen toolbar (hidden when printing) ─────────────────────── */}
      <div className="print-preview-toolbar">
        <div style={{ flex: 1 }}>
          <p style={{ color: "#f1f5f9", fontWeight: 600, fontSize: 14 }}>
            Print Preview — SO: {batch.soNumber} · R{batch.revision}
          </p>
          <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
            {labels.length} label{labels.length !== 1 ? "s" : ""} ·{" "}
            {template.width}×{template.height}mm ·{" "}
            {template.name}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          style={{
            background:   "#2563eb",
            color:        "#fff",
            border:       "none",
            borderRadius: 8,
            padding:      "7px 18px",
            fontSize:     13,
            fontWeight:   600,
            cursor:       "pointer",
          }}
        >
          🖨 Print
        </button>
        <button
          onClick={onClose}
          style={{
            background:   "transparent",
            color:        "#94a3b8",
            border:       "1px solid #334155",
            borderRadius: 8,
            padding:      "7px 14px",
            fontSize:     13,
            cursor:       "pointer",
          }}
        >
          ✕ Close
        </button>
      </div>

      {/* ── Label pages ────────────────────────────────────────────────── */}
      <div className="print-preview-scroll">
        {labels.map((label) => (
          <div
            key={label.id}
            className="label-print-page label-screen-wrapper"
          >
            <LabelCanvas
              label={label}
              template={template}
              scale={1}
              batchInfo={batchInfo}
            />
          </div>
        ))}
      </div>
    </div>
  );

  // Mount outside the React tree so our CSS hide-everything trick works
  return createPortal(content, document.body);
}
