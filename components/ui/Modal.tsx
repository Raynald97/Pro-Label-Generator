"use client";

import { useEffect, useRef, ReactNode, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}

export function Modal({ open, onClose, title, description, children, size = "md" }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Next.js Hydration Fix: Memastikan portal hanya dirender di sisi client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Tutup modal saat menekan tombol Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Mengunci scroll layar utama (body) saat modal terbuka
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || !mounted) return null;

  // Menggunakan createPortal untuk merender modal di luar hierarki DOM utama
  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[999999] flex items-center justify-center p-4 sm:p-6"
      onClick={(e) => {
        // Tutup modal jika user mengklik area backdrop di luar panel modal
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Backdrop (Latar belakang gelap dengan blur) */}
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity" />

      {/* Panel Modal */}
      <div
        className={cn(
          "relative w-full bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl animate-slide-up flex flex-col max-h-[90vh] overflow-hidden",
          size === "sm" && "max-w-md",
          size === "md" && "max-w-2xl", 
          size === "lg" && "max-w-4xl"
        )}
      >
        {/* Header Modal */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-800 shrink-0 bg-slate-900">
          <div>
            <h2 className="text-lg font-bold text-white">{title}</h2>
            {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="ml-4 flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Modal (Memungkinkan scroll internal jika konten terlalu panjang) */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>,
    document.body // Target portal: langsung ke elemen body
  );
}