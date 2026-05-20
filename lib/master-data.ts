/**
 * master-data.ts
 * Generic Firestore CRUD for all Master Data collections, plus specific
 * Formula Process logic.
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
  where,
  orderBy,
  Timestamp,
  DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";
import type { 
  MasterBase, 
  MasterCollection, 
  FormulaProcess, 
  FormulaProcessFormData,
  KoG,
  Process 
} from "@/types";

// Convert Firestore Timestamps → ISO strings so types stay clean
function normalise(data: DocumentData): DocumentData {
  const out: DocumentData = {};
  for (const [k, v] of Object.entries(data)) {
    if (v instanceof Timestamp) {
      out[k] = v.toDate().toISOString();
    } else if (Array.isArray(v)) {
      // Recursively normalise arrays (e.g., processSnapshots)
      out[k] = v.map((item) =>
        typeof item === "object" && item !== null ? normalise(item) : item
      );
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
// 1. GENERIC MASTER DATA CRUD
// ════════════════════════════════════════════════════════════════════════════

// ─── READ ALL ─────────────────────────────────────────────────────────────────
export async function getMasterList<T extends MasterBase>(
  col: MasterCollection
): Promise<T[]> {
  const q = query(collection(db, col), orderBy("name", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...normalise(d.data()) } as T));
}

// ─── CREATE ───────────────────────────────────────────────────────────────────
export async function createMasterItem<T extends MasterBase>(
  col: MasterCollection,
  data: Omit<T, "id" | "createdAt" | "updatedAt">
): Promise<T> {
  const now = new Date().toISOString();
  const payload = { ...data, createdAt: now, updatedAt: now };
  const ref = await addDoc(collection(db, col), payload);
  return { id: ref.id, ...payload } as unknown as T;
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────
export async function updateMasterItem<T extends Partial<MasterBase>>(
  col: MasterCollection,
  id: string,
  data: Omit<T, "id" | "createdAt">
): Promise<void> {
  await updateDoc(doc(db, col, id), {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function deleteMasterItem(
  col: MasterCollection,
  id: string
): Promise<void> {
  await deleteDoc(doc(db, col, id));
}

// ════════════════════════════════════════════════════════════════════════════
// 2. FORMULA PROCESS SPECIFIC CRUD
// ════════════════════════════════════════════════════════════════════════════

// ─── READ ALL FORMULAS ────────────────────────────────────────────────────────
export async function getFormulaProcesses(): Promise<FormulaProcess[]> {
  const q = query(collection(db, "formulaProcesses"), orderBy("kogName", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...normalise(d.data()) } as FormulaProcess));
}

// ─── LOOKUP FORMULA BY KOG (Used in Production) ───────────────────────────────
export async function getFormulaByKogId(kogId: string): Promise<FormulaProcess | null> {
  const q = query(collection(db, "formulaProcesses"), where("kogId", "==", kogId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...normalise(snap.docs[0].data()) } as FormulaProcess;
}

// ─── CREATE FORMULA ───────────────────────────────────────────────────────────
export async function createFormulaProcess(
  data: FormulaProcessFormData,
  kogs: KoG[],
  processes: Process[]
): Promise<FormulaProcess> {
  // Build snapshots
  const targetKog = kogs.find((k) => k.id === data.kogId);
  if (!targetKog) throw new Error("KoG not found.");

  const processSnapshots = data.processIds.map((pid) => {
    const p = processes.find((proc) => proc.id === pid);
    if (!p) throw new Error(`Process ${pid} not found.`);
    return { id: p.id, name: p.name, initial: p.initial };
  });

  const now = new Date().toISOString();
  const payload = {
    kogId: data.kogId,
    kogName: targetKog.name,
    kogInitial: targetKog.initial,
    processIds: data.processIds,
    processSnapshots,
    createdAt: now,
    updatedAt: now,
  };

  const ref = await addDoc(collection(db, "formulaProcesses"), payload);
  return { id: ref.id, ...payload } as FormulaProcess;
}

// ─── UPDATE FORMULA ───────────────────────────────────────────────────────────
export async function updateFormulaProcess(
  id: string,
  data: FormulaProcessFormData,
  kogs: KoG[],
  processes: Process[]
): Promise<void> {
  // Rebuild snapshots
  const targetKog = kogs.find((k) => k.id === data.kogId);
  if (!targetKog) throw new Error("KoG not found.");

  const processSnapshots = data.processIds.map((pid) => {
    const p = processes.find((proc) => proc.id === pid);
    if (!p) throw new Error(`Process ${pid} not found.`);
    return { id: p.id, name: p.name, initial: p.initial };
  });

  await updateDoc(doc(db, "formulaProcesses", id), {
    kogId: data.kogId,
    kogName: targetKog.name,
    kogInitial: targetKog.initial,
    processIds: data.processIds,
    processSnapshots,
    updatedAt: new Date().toISOString(),
  });
}

// ─── DELETE FORMULA ───────────────────────────────────────────────────────────
export async function deleteFormulaProcess(id: string): Promise<void> {
  await deleteDoc(doc(db, "formulaProcesses", id));
}