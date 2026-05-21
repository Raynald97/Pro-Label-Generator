import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "./firebase"; // Pastikan auth juga di-import

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

// --- CREATE: Tambah User Baru (SEKARANG BIKIN AKUN LOGIN JUGA!) -------------
export async function createUser(data: any): Promise<AppUser> {
  const { email, password, displayName, role, status } = data;

  // 1. Daftarkan email dan password ke Firebase Authentication
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = userCredential.user.uid;

  // 2. Simpan profil lengkapnya ke Firestore (menggunakan UID dari Auth sebagai ID dokumen)
  const now = new Date().toISOString();
  const payload = {
    id: uid,
    uid: uid, // Disimpan juga agar terbaca oleh file useAuth.tsx
    email,
    displayName,
    role,
    status,
    isActive: status === "active", // Status diubah jadi boolean agar sesuai dengan useAuth.tsx
    permissions: {}, // Kosongkan dulu
    createdAt: now,
    updatedAt: now,
  };
  
  await setDoc(doc(db, COLLECTION_NAME, uid), payload);
  return payload as AppUser;
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