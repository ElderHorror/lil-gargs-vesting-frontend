"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
  actions?: ReactNode;
};

export function SectionHeader({ eyebrow, title, description, actions, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">{eyebrow}</p>
        <h1 className="text-3xl font-semibold text-white">{title}</h1>
        {description && <p className="mt-2 text-sm text-white/60">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
