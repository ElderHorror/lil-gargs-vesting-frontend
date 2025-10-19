"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--foreground)] font-medium shadow-[0_10px_30px_-12px_rgba(103,91,255,0.7)] hover:bg-[var(--accent)]/90 disabled:bg-gray-600 disabled:text-gray-400 disabled:shadow-none",
  secondary:
    "bg-[var(--accent-soft)] text-[var(--foreground)] hover:bg-[var(--accent-soft)]/80 disabled:bg-gray-600 disabled:text-gray-400",
  ghost:
    "bg-transparent text-[var(--foreground)] hover:bg-white/5 disabled:text-gray-500",
  danger:
    "bg-[var(--danger)] text-white hover:bg-[var(--danger)]/85 disabled:bg-gray-600 disabled:text-gray-400",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "h-10 w-10 p-0 flex items-center justify-center",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          loading && "opacity-80",
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/70 border-r-transparent" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export type { ButtonProps };
