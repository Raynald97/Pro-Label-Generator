import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase"; // Pastikan path ini sesuai dengan file konfigurasi Firebase kamu

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "operator" | "viewer";
  status: "active" | "inactive";
  createdAt: string;
}

const COLLECTION_NAME = "users";

// --- READ: Ambil Semua Data User ---------------------------------------------
export async function getUsers(): Promise<AppUser[]> {
  const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      email: data.email || "",
      displayName: data.displayName || "",
      role: data.role || "viewer",
      status: data.status || "active",
      createdAt: data.createdAt || new Date().toISOString(),
    } as AppUser;
  });
}

// --- CREATE: Tambah User Baru ------------------------------------------------
export async function createUser(data: Omit<AppUser, "id" | "createdAt">): Promise<AppUser> {
  const now = new Date().toISOString();
  const payload = {
    ...data,
    createdAt: now,
  };
  
  const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);
  return { id: docRef.id, ...payload } as AppUser;
}

// --- UPDATE: Edit User -------------------------------------------------------
export async function updateUser(id: string, data: Partial<Omit<AppUser, "id" | "createdAt">>): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
}

// --- DELETE: Hapus User ------------------------------------------------------
export async function deleteUser(id: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}