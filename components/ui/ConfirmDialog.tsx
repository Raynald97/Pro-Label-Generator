"use client";

import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, message,
  confirmLabel = "Delete", loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex gap-4">
        <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
          <AlertTriangle size={18} className="text-red-400" />
        </div>
        <p className="text-slate-300 text-sm leading-relaxed pt-1.5">{message}</p>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} disabled={loading} className="btn-secondary">
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition-colors disabled:opacity-50"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : null}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
