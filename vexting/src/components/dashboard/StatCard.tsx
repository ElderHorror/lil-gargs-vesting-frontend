import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
  trend?: { value: string; positive?: boolean };
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function StatCard({ label, value, helper, trend, icon, action, className }: StatCardProps) {
  return (
    <article className={cn("glass-panel flex flex-col gap-4 rounded-2xl px-6 py-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">{label}</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-white lg:text-4xl">{value}</span>
            {trend && (
              <span
                className={cn(
                  "text-xs font-medium",
                  trend.positive ? "text-[var(--success)]" : "text-[var(--danger)]"
                )}
              >
                {trend.value}
              </span>
            )}
          </div>
          {helper && <p className="text-sm text-white/60">{helper}</p>}
        </div>
        {icon && <div className="rounded-full bg-[var(--accent-soft)]/40 p-3 text-[var(--accent)]">{icon}</div>}
      </div>
      {action && <div className="mt-auto">{action}</div>}
    </article>
  );
}
