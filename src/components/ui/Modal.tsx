"use client";

import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  widthClassName?: string;
};

export function Modal({ open, title, description, children, footer, onClose, widthClassName }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (typeof window === "undefined") {
    return null;
  }

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur">
      <div
        className={cn(
          "glass-panel relative max-h-[80vh] w-full overflow-hidden overflow-y-auto rounded-2xl p-6 text-white shadow-2xl",
          widthClassName ?? "max-w-xl"
        )}
      >
        <button
          className="absolute right-4 top-4 text-white/60 transition hover:text-white"
          aria-label="Close"
          onClick={onClose}
        >
          ✕
        </button>

        {(title || description) && (
          <header className="mb-4 space-y-1">
            {title && <h2 className="text-xl font-semibold text-white">{title}</h2>}
            {description && <p className="text-sm text-white/60">{description}</p>}
            <div className="panel-divider" />
          </header>
        )}

        <div className="space-y-4 text-sm text-white/80">{children}</div>

        {footer ? (
          <footer className="mt-6 flex flex-wrap justify-end gap-2">{footer}</footer>
        ) : (
          <footer className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}
