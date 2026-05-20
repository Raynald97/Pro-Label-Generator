import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, Firestore } from "firebase/firestore";
import { getStorage, connectStorageEmulator, FirebaseStorage } from "firebase/storage";

// --- CONFIG -------------------------------------------------------------------
// All values come from .env.local — see .env.local.example for the full list.

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY            ?? "",
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? "",
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID         ?? "",
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID             ?? "",
};

// Warn once in dev if any key is missing (won't throw — lets the app boot for UI work)
if (process.env.NODE_ENV === "development") {
  const missing = Object.entries(firebaseConfig)
    .filter(([, v]) => !v)
    .map(([k]) => `NEXT_PUBLIC_${k.replace(/([A-Z])/g, "_$1").toUpperCase()}`);
  if (missing.length) {
    console.warn(
      "[Firebase] Missing env vars — copy .env.local.example → .env.local and fill them in:\n",
      missing.join("\n ")
    );
  }
}

// --- SINGLETON INITIALISATION -------------------------------------------------
// Next.js hot-reload can call this module multiple times; guard against re-init.

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (getApps().length === 0) {
  app     = initializeApp(firebaseConfig);
  auth    = getAuth(app);
  db      = getFirestore(app);
  storage = getStorage(app);

  // -- Optional: connect to local Firebase Emulator Suite --------------------
  // Set NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true in .env.local to enable.
  if (
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true"
  ) {
    try {
      connectAuthEmulator(auth,    "http://127.0.0.1:9099", { disableWarnings: true });
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
      connectStorageEmulator(storage, "127.0.0.1", 9199);
      console.info("[Firebase] Connected to local Emulator Suite");
    } catch {
      // Emulator already connected (HMR re-run) — safe to ignore
    }
  }
} else {
  app     = getApp();
  auth    = getAuth(app);
  db      = getFirestore(app);
  storage = getStorage(app);
}

export { app as default, auth, db, storage };
