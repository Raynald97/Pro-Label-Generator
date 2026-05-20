/**
 * lib/production.ts
 *
 * Pure formatting helpers + Firestore write logic for the Production module.
 * No React imports — safe to call from server actions too.
 */

import {
  collection,
  doc,
  addDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  DocumentData,
  getDocs,
  query,
  orderBy,
  where,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  LabelBatch,
  LabelRecord,
  LineItemRow,
  BatchHeader,
  ThicknessCalc,
  GlassLayer,
  EdgeSide,
  Process,
  ProcessWithCheck,
} from "@/types";

// ════════════════════════════════════════════════════════════════════════════
// FORMATTING HELPERS
// These are pure functions — no I/O. Used both when generating and when
// rendering labels in the PDF export.
// ════════════════════════════════════════════════════════════════════════════

export function formatThickness(t: ThicknessCalc): string {
  function padGlass(n: number): string {
    return Number.isInteger(n) ? String(n).padStart(2, "0") : String(n);
  }

  const parts: string[] = [padGlass(t.l1)];
  if (t.l2 !== null) parts.push(String(t.l2));
  if (t.l3 !== null) parts.push(padGlass(t.l3));
  return `(${parts.join("+")})`;
}

export function formatTargetSchedule(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Ts: —";
  const day = d.getDate();
  const month = d.toLocaleString("en-GB", { month: "short" });
  return `Ts: ${day} ${month}`;
}

export function formatLabelIndex(index: number, total: number): string {
  return `${index} of ${total}`;
}

export function formatEdgeProcess(
  initial: string | null,
  sides: EdgeSide[]
): string | null {
  if (!initial || sides.length === 0) return null;
  const ordered: EdgeSide[] = ["B", "T", "L", "R"];
  const selected = ordered.filter((s) => sides.includes(s));
  return `${initial}[${selected.join(",")}]`;
}

export function formatMarkingCode(
  initial: string | null,
  position: string | null,
  offset: number | null
): string | null {
  if (!initial || !position) return null;
  const off = offset != null && offset > 0 ? String(offset) : "";
  return `M:${initial}[${position}${off}]`;
}

export function formatGlassLayers(layers: GlassLayer[]): string {
  return layers
    .map((l, i) => {
      const thickness = Number.isInteger(l.thicknessMm)
        ? String(l.thicknessMm).padStart(2, "0")
        : String(l.thicknessMm);
      return `L${i + 1}:${l.glassTypeInitial}${thickness}`;
    })
    .join(" ");
}

export function formatDimensions(w: number, h: number): string {
  return `${w}x${h}`;
}

export function formatRevision(n: number): string {
  return `R${n}`;
}

// ════════════════════════════════════════════════════════════════════════════
// PROCESS CHECKLIST HELPERS
// ════════════════════════════════════════════════════════════════════════════

export function buildProcessChecklist(
  allProcesses: Process[],
  formulaProcessIds: string[],
  manualOverrideIds: string[] = []
): ProcessWithCheck[] {
  const formulaSet = new Set(formulaProcessIds);
  const overrideSet = new Set(manualOverrideIds);

  return allProcesses.map((p) => ({
    ...p,
    checked:     formulaSet.has(p.id) || overrideSet.has(p.id),
    autoChecked: formulaSet.has(p.id),
  }));
}

// ════════════════════════════════════════════════════════════════════════════
// CLIENT-SIDE ROW FACTORY
// ════════════════════════════════════════════════════════════════════════════

let _rowCounter = 0;

export function makeEmptyRow(): LineItemRow {
  _rowCounter++;
  return {
    rowId:            `row_${Date.now()}_${_rowCounter}`,
    categoryId:       "",
    categoryInitial:  "",
    kogId:            "",
    kogInitial:       "",
    kogName:          "",
    cutShapeId:       "",
    cutShapeName:     "",
    thickness:        { l1: 0, l2: null, l3: null },
    dimensionW:       0,
    dimensionH:       0,
    glassLayers:      [{ glassTypeId: "", glassTypeInitial: "", glassTypeName: "", thicknessMm: 0 }],
    checkedProcessIds:  [],
    edgeProcessId:    "",
    edgeProcessInitial: "",
    edgeSides:        [],
    markingPosition:  "BR",
    markingOffset:    8,
    quantity:         1,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// GENERATE BATCH  (the core write transaction)
// ════════════════════════════════════════════════════════════════════════════

export async function generateBatch(
  header:    BatchHeader,
  rows:      LineItemRow[],
  processes: Process[],
  uid:       string
): Promise<LabelBatch> {

  // -- Pre-compute totals ----------------------------------------------------
  const totalLabels = rows.reduce((sum, r) => sum + r.quantity, 0);

  // -- Build the batch header document ---------------------------------------
  const now = new Date().toISOString();

  const batchPayload: Omit<LabelBatch, "id"> = {
    soNumber:        header.soNumber.trim(),
    revision:        header.revision,
    targetSchedule:  header.targetSchedule,
    customerId:      header.customerId,
    customerName:    header.customerName,
    customerInitial: header.customerInitial,
    city:            header.city.trim(),
    logoId:          header.logoId  || null,
    logoUrl:         header.logoUrl || null,
    markingId:       header.markingId    || null,
    markingName:     header.markingName  || null,
    markingInitial:  header.markingInitial || null,
    markingImageUrl: header.markingImageUrl || null,
    templateId:      header.templateId,
    templateName:    header.templateName,
    totalLabels,
    lineItemCount:   rows.length,
    status:          "generated",
    createdAt:       now,
    updatedAt:       now,
    createdBy:       uid,
  };

  const batchRef = await addDoc(collection(db, "labelBatches"), batchPayload);
  const batchId  = batchRef.id;

  let globalIndex = 1;
  const CHUNK = 490;
  const allLabelPayloads: Omit<LabelRecord, "id">[] = [];

  rows.forEach((row, rowIndex) => {
    // Pre-compute row-level formatting
    const thicknessFormatted = formatThickness(row.thickness);
    const edgeFormatted = formatEdgeProcess(row.edgeProcessInitial || null, row.edgeSides);
    const markingCode = formatMarkingCode(header.markingInitial || null, row.markingPosition || null, row.markingOffset ?? null);

    // Resolve checked process names
    const processNames = row.checkedProcessIds
      .map((pid) => processes.find((p) => p.id === pid)?.name ?? pid);

    // NEW: Resolve checked process INITIALS (e.g. "TP, LM")
    const processesInitial = row.checkedProcessIds
      .map((pid) => processes.find((p) => p.id === pid)?.initial ?? pid)
      .join(", ");

    for (let piece = 1; piece <= row.quantity; piece++) {
      const label: Omit<LabelRecord, "id"> = {
        batchId,
        soNumber:           batchPayload.soNumber,
        revision:           batchPayload.revision,
        labelIndex:         globalIndex,
        totalLabels,
        rowIndex,
        pieceIndex:         piece,

        customerInitial:    header.customerInitial,
        city:               header.city.trim(),
        targetSchedule:     header.targetSchedule,
        logoUrl:            header.logoUrl || null,
        markingImageUrl:    header.markingImageUrl || null,
        markingCode,
        templateId:         header.templateId,

        // --- 4 DATA BARU DISIMPAN KE FIRESTORE DI SINI ---
        processesInitial:   processesInitial,
        // Kita menggunakan "as any" sementara untuk mengakomodasi form UI lama
        // yang mungkin belum mengirimkan data ini
        interlayerInitial:  (row as any).interlayerInitial || "", 
        cutShapeInitial:    (row as any).cutShapeInitial || "",
        projectInitial:     (header as any).projectInitial || "",
        // --------------------------------------------------

        categoryInitial:    row.categoryInitial || null,
        kogInitial:         row.kogInitial,
        kogName:            row.kogName,
        cutShapeName:       row.cutShapeName,
        thickness:          row.thickness,
        thicknessFormatted,
        dimensionW:         row.dimensionW,
        dimensionH:         row.dimensionH,
        glassLayers:        row.glassLayers,
        processNames,
        edgeProcessInitial: row.edgeProcessInitial || null,
        edgeSides:          row.edgeSides,
        edgeFormatted,
        markingPosition:    row.markingPosition || null,
        markingOffset:      row.markingOffset ?? null,

        createdAt:          now,
      };
      allLabelPayloads.push(label);
      globalIndex++;
    }
  });

  const labelsCol = collection(db, "labelBatches", batchId, "labels");

  for (let i = 0; i < allLabelPayloads.length; i += CHUNK) {
    const chunk  = allLabelPayloads.slice(i, i + CHUNK);
    const fbBatch = writeBatch(db);
    chunk.forEach((payload) => {
      const ref = doc(labelsCol);
      fbBatch.set(ref, payload);
    });
    await fbBatch.commit();
  }

  return { id: batchId, ...batchPayload };
}

// ════════════════════════════════════════════════════════════════════════════
// HISTORY / REPRINT HELPERS
// ════════════════════════════════════════════════════════════════════════════

export async function getLabelBatches(): Promise<LabelBatch[]> {
  const q    = query(collection(db, "labelBatches"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...normalise(d.data()) } as LabelBatch));
}

export async function getBatchLabels(batchId: string): Promise<LabelRecord[]> {
  const q    = query(collection(db, "labelBatches", batchId, "labels"), orderBy("labelIndex", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...normalise(d.data()) } as LabelRecord));
}

export async function reprintBatch(
  originalBatch: LabelBatch,
  updatedRows:   LineItemRow[],
  processes:     Process[],
  uid:           string
): Promise<LabelBatch> {
  const newHeader: BatchHeader = {
    soNumber:        originalBatch.soNumber,
    revision:        originalBatch.revision + 1,
    targetSchedule:  originalBatch.targetSchedule,
    customerId:      originalBatch.customerId,
    customerName:    originalBatch.customerName,
    customerInitial: originalBatch.customerInitial,
    city:            originalBatch.city,
    logoId:          originalBatch.logoId    ?? "",
    logoUrl:         originalBatch.logoUrl   ?? "",
    markingId:       originalBatch.markingId ?? "",
    markingName:     originalBatch.markingName    ?? "",
    markingInitial:  originalBatch.markingInitial ?? "",
    markingImageUrl: originalBatch.markingImageUrl ?? "",
    templateId:      originalBatch.templateId,
    templateName:    originalBatch.templateName,
    // @ts-ignore (Memastikan projectInitial tetap terbawa saat reprint form utuh)
    projectInitial:  (originalBatch as any).projectInitial ?? "", 
  };
  return generateBatch(newHeader, updatedRows, processes, uid);
}

function normalise(data: DocumentData): DocumentData {
  const out: DocumentData = {};
  for (const [k, v] of Object.entries(data)) {
    if (v instanceof Timestamp) {
      out[k] = v.toDate().toISOString();
    } else if (Array.isArray(v)) {
      out[k] = v.map((item) =>
        item && typeof item === "object" && !(item instanceof Timestamp)
          ? normalise(item as DocumentData)
          : item instanceof Timestamp ? item.toDate().toISOString() : item
      );
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function reprintExactLabels(
  originalBatch: LabelBatch,
  labelsToCopy:  LabelRecord[],
  uid:           string
): Promise<LabelBatch> {
  const now = new Date().toISOString();
  const newRevision = originalBatch.revision + 1;

  const { id: _oldBatchId, ...batchData } = originalBatch;
  
  const batchPayload: Omit<LabelBatch, "id"> = {
    ...batchData,
    revision: newRevision,
    createdAt: now,
    updatedAt: now,
    createdBy: uid,
  };

  const batchRef = await addDoc(collection(db, "labelBatches"), batchPayload);
  const batchId  = batchRef.id;

  const labelsCol = collection(db, "labelBatches", batchId, "labels");
  const fbBatch   = writeBatch(db);

  labelsToCopy.forEach((oldLabel) => {
    const { id: _oldLabelId, ...labelData } = oldLabel; 
    
    const ref = doc(labelsCol);
    const newLabel: Omit<LabelRecord, "id"> = {
      ...labelData,
      batchId: batchId,
      revision: newRevision,
      createdAt: now,
    };
    fbBatch.set(ref, newLabel);
  });

  await fbBatch.commit();
  return { id: batchId, ...batchPayload };
}