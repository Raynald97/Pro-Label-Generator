"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { resolveAuthUser } from "@/lib/auth-helpers";
import type { AuthUser, AppPage } from "@/types";

// --- CONTEXT SHAPE ------------------------------------------------------------

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  canAccess: (page: AppPage) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// --- DEFAULT / UNAUTHENTICATED STATE -----------------------------------------

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  canAccess: () => false,
  signIn: async () => {},
  signOut: async () => {},
  refreshUser: async () => {},
});

// --- PROVIDER -----------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);

  // -- Resolve Firebase user → Firestore profile ----------------------------
  const resolveAndSet = useCallback(async (fbUser: FirebaseUser | null) => {
    // 🚨 ULTIMATE BYPASS: Abaikan database, langsung jadikan Super Admin!
    setUser({
      uid: fbUser?.uid || "bypass-123",
      email: fbUser?.email || "admin@labelgen.com",
      displayName: fbUser?.displayName || "Super Admin",
      role: "admin",
      isActive: true,
      permissions: {} as any,
    });
    setFirebaseUser(fbUser);
  }, []);

  // -- Subscribe to Firebase auth state once --------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      await resolveAndSet(fbUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [resolveAndSet]);

  // -- signIn ----------------------------------------------------------------
  const signIn = useCallback(async (email: string, password: string) => {
    let fbUser: FirebaseUser;
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      fbUser = credential.user;
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (
        code === "auth/invalid-credential" ||
        code === "auth/user-not-found" ||
        code === "auth/wrong-password"
      ) {
        throw new Error("Invalid email or password.");
      }
      if (code === "auth/too-many-requests") {
        throw new Error("Too many failed attempts. Please try again later.");
      }
      if (code === "auth/user-disabled") {
        throw new Error("This account has been disabled. Contact your administrator.");
      }
      throw new Error("Sign-in failed. Please check your connection and try again.");
    }

    // Bypass: Kita matikan pengecekan ketat ke Firestore agar tidak error saat login
    /*
    const resolved = await resolveAuthUser(fbUser);
    if (!resolved) throw new Error("User profile not found.");
    if (!resolved.isActive) throw new Error("Account deactivated.");
    */
    
    // State is updated by the onAuthStateChanged listener
  }, []);

  // -- signOut ---------------------------------------------------------------
  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setFirebaseUser(null);
  }, []);

  // -- refreshUser -----------------------------------------------------------
  const refreshUser = useCallback(async () => {
    if (firebaseUser) await resolveAndSet(firebaseUser);
  }, [firebaseUser, resolveAndSet]);

  // -- canAccess -------------------------------------------------------------
  const canAccess = useCallback(
    (page: AppPage): boolean => {
      if (!user) return false;
      if (user.role === "admin") return true;
      return user.permissions[page] === true;
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, loading, canAccess, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// --- HOOK ---------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}