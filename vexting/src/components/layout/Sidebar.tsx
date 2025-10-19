"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Dashboard", href: "/" },
  { label: "Settings", href: "/settings" },
];

type SidebarProps = {
  variant?: "vertical" | "horizontal";
  className?: string;
};

export function Sidebar({ variant = "vertical", className }: SidebarProps) {
  const pathname = usePathname();

  if (variant === "horizontal") {
    return (
      <nav
        className={cn(
          "glass-panel flex items-center gap-2 overflow-x-auto rounded-2xl px-3 py-3 text-sm text-white/80",
          "[&::-webkit-scrollbar]:hidden",
          "-mx-1",
          className
        )}
      >
        {navLinks.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className={cn(
              "whitespace-nowrap rounded-full px-4 py-2 transition-colors hover:bg-white/10",
              pathname === link.href ? "bg-white/15 text-white" : "text-white/70"
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className={cn("flex flex-1 flex-col gap-6 p-6 text-sm text-white/80", className)}>
      <div>
        <p className="text-[10px] uppercase tracking-[0.35em] text-[var(--muted)]">Navigation</p>
        <ul className="mt-4 space-y-2">
          {navLinks.map((link) => (
            <li key={link.label}>
              <Link
                href={link.href}
                className={cn(
                  "block w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/5",
                  pathname === link.href ? "bg-white/10 text-white" : "text-white/70"
                )}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto space-y-2 rounded-xl bg-white/5 p-4 text-xs text-white/70">
        <p className="text-white">Operational Tips</p>
        <p>Switch to Dynamic mode before running the sync daemon.</p>
        <p>Run reclaim job after grace period ends.</p>
      </div>
    </nav>
  );
}
