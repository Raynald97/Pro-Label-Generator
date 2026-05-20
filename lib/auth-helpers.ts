/**
 * auth-helpers.ts
 * Pure Firestore helpers for user profile management.
 * Auth actions (signIn, signOut) live in hooks/useAuth.tsx.
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import type { AppUser, UserDocument, UserPermissions, UserRole } from "@/types";

// --- GET SINGLE USER DOCUMENT -------------------------------------------------

export async function getUserDocument(uid: string): Promise<UserDocument | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return snap.data() as UserDocument;
}

// --- GET ALL USER DOCUMENTS (admin only) --------------------------------------

export async function getAllUsers(): Promise<UserDocument[]> {
  const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as UserDocument);
}

// --- CREATE USER DOCUMENT -----------------------------------------------------

export async function createUserDocument(
  uid: string,
  data: {
    email: string;
    displayName: string;
    role: UserRole;
    permissions: UserPermissions;
    createdBy: string;
  }
): Promise<void> {
  const userDoc: UserDocument = {
    uid,
    email: data.email,
    displayName: data.displayName,
    role: data.role,
    permissions: data.permissions,
    createdAt: new Date().toISOString(),
    createdBy: data.createdBy,
    isActive: true,
  };
  await setDoc(doc(db, "users", uid), userDoc);
}

// --- UPDATE USER PERMISSIONS & ACTIVE STATE -----------------------------------

export async function updateUserPermissions(
  uid: string,
  permissions: UserPermissions,
  isActive: boolean
): Promise<void> {
  await updateDoc(doc(db, "users", uid), { permissions, isActive });
}

// --- UPDATE DISPLAY NAME ------------------------------------------------------

export async function updateUserDisplayName(
  uid: string,
  displayName: string
): Promise<void> {
  await updateDoc(doc(db, "users", uid), { displayName });
}

// --- RESOLVE FIREBASE USER → APP USER ----------------------------------------

export async function resolveAuthUser(firebaseUser: {
  uid: string;
  email: string | null;
  displayName: string | null;
}) {
  const userDoc = await getUserDocument(firebaseUser.uid);
  if (!userDoc) return null;
  const result: AppUser = {
    uid: firebaseUser.uid,
    email: firebaseUser.email ?? "",
    displayName: userDoc.displayName || firebaseUser.displayName || "",
    role: userDoc.role,
    permissions: userDoc.permissions,
    createdAt: userDoc.createdAt,
    createdBy: userDoc.createdBy,
    isActive: userDoc.isActive,
  };
  return result;
}

// --- PERMISSION CHECK ---------------------------------------------------------

export function hasPermission(user: AppUser | null, page: string): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.permissions[page] === true;
}
