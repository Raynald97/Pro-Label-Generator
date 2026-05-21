"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { RefreshCw } from "lucide-react";
import type { AppPage } from "@/types";

export const RouteGuard = ({ 
  children, 
  requiredPage 
}: { 
  children: React.ReactNode;
  requiredPage?: string; 
}) => {
  const { user, loading, canAccess } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Jika sudah selesai loading (cek auth selesai)
    if (!loading) {
      if (!user) {
        // Jika tidak ada user login, tendang ke halaman login
        router.replace("/login");
      } else if (requiredPage && !canAccess(requiredPage as AppPage)) {
        // Jika role/permission tidak cukup, tendang ke dashboard utama
        router.replace("/dashboard");
      }
    }
  }, [user, loading, canAccess, requiredPage, router]);

  // Tampilkan loading screen saat sedang mengecek akun
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950">
        <RefreshCw className="animate-spin text-brand-500" size={32} />
      </div>
    );
  }

  // Jika tidak ada user atau akses ditolak, cegah render UI
  if (!user || (requiredPage && !canAccess(requiredPage as AppPage))) {
    return null;
  }

  return <>{children}</>;
};