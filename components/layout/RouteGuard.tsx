"use client";

// Kita tambahkan 'requiredPage?: string' agar TypeScript tahu ini legal
export const RouteGuard = ({ 
  children, 
  requiredPage 
}: { 
  children: React.ReactNode;
  requiredPage?: string; 
}) => {
  // Bypass sementara agar tidak error saat testing UI
  return <>{children}</>;
};