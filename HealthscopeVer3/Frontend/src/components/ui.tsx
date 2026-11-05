import { type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from "lucide-react";
import { useApp } from "../store/AppContext";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`hs-card p-5 ${className}`}>{children}</div>;
}

export function SectionTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h2 className="text-lg font-semibold text-midnight-800">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "royal",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: "royal" | "teal" | "amber" | "red" | "slate";
}) {
  const tones: Record<string, string> = {
    royal: "bg-royal/10 text-royal",
    teal: "bg-teal/10 text-teal-dark",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <div className="hs-card p-5">
      <div className="flex items-start justify-between">
        <div className="hs-label">{label}</div>
        {icon && (
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${tones[tone]}`}>
            {icon}
          </div>
        )}
      </div>
      <div className="mt-2 text-2xl font-semibold text-midnight-800 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 className={`h-4 w-4 animate-spin ${className}`} />;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
      <Spinner />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="hs-card p-10 text-center">
      {icon && (
        <div className="mx-auto h-12 w-12 rounded-xl bg-pale flex items-center justify-center text-royal">
          {icon}
        </div>
      )}
      <h3 className="mt-4 text-base font-semibold text-midnight-800">{title}</h3>
      {description && (
        <p className="mt-1.5 text-sm text-slate-500 max-w-md mx-auto">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "royal" | "teal" | "amber" | "red" | "slate";
}) {
  const tones: Record<string, string> = {
    royal: "bg-royal/10 text-royal",
    teal: "bg-teal/10 text-teal-dark",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 w-80">
      {toasts.map((t) => {
        const Icon =
          t.kind === "success" ? CheckCircle2 : t.kind === "error" ? AlertTriangle : Info;
        const tone =
          t.kind === "success"
            ? "border-teal/40 bg-white"
            : t.kind === "error"
              ? "border-red-300 bg-white"
              : "border-slate-300 bg-white";
        const iconTone =
          t.kind === "success"
            ? "text-teal"
            : t.kind === "error"
              ? "text-red-600"
              : "text-royal";
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-xl border ${tone} shadow-card p-3 animate-fade-in`}
          >
            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconTone}`} />
            <div className="text-sm text-midnight-800 flex-1">{t.message}</div>
            <button
              onClick={() => dismissToast(t.id)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-900/40 p-4">
      <div className="bg-white rounded-2xl shadow-card w-full max-w-md p-6">
        <h3 className="text-base font-semibold text-midnight-800">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="hs-btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="hs-btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}