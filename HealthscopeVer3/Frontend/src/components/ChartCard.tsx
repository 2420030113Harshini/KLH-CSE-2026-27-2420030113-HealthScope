import { type ReactNode } from "react";

export default function ChartCard({
  title,
  subtitle,
  right,
  children,
  empty,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  empty?: { title: string; description?: string; action?: ReactNode };
}) {
  return (
    <div className="hs-card p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-midnight-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
      {empty ? (
        <div className="py-10 text-center">
          <div className="text-sm font-medium text-midnight-800">{empty.title}</div>
          {empty.description && (
            <div className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {empty.description}
            </div>
          )}
          {empty.action && <div className="mt-4 flex justify-center">{empty.action}</div>}
        </div>
      ) : (
        children
      )}
    </div>
  );
}