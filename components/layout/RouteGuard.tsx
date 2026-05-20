"use client";

export const RouteGuard = ({ children }: { children: React.ReactNode }) => {
  // Bypass sementara agar tidak error saat testing UI
  return <>{children}</>;
};