import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  Icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center mb-4">
        <Icon size={24} className="text-slate-600" />
      </div>
      <p className="text-slate-300 font-medium text-sm">{title}</p>
      {description && <p className="text-slate-500 text-xs mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
