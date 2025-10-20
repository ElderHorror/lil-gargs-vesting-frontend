"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type RefObject,
} from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CreateVestingModal } from "@/components/vesting/CreateVestingModal";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

const navLinks = [
  { label: "Dashboard", href: "/" },
  { label: "Settings", href: "/settings" },
];

type Tone = "info" | "success" | "warning" | "danger";

const toneStyles: Record<Tone, string> = {
  info: "bg-[var(--accent-soft)] text-[var(--accent)]",
  success: "bg-[var(--success)]/15 text-[var(--success)]",
  warning: "bg-[#f0b94e33] text-[#f0b94e]",
  danger: "bg-[var(--danger)]/20 text-[var(--danger)]",
};

type NavMenuProps = {
  menuOpen: boolean;
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  menuRef: RefObject<HTMLDivElement | null>;
  pathname: string;
};

type StatusPillProps = {
  label: string;
  value: string;
  tone?: Tone;
};

type ChevronIconProps = {
  className?: string;
};

function ChevronIcon({ className }: ChevronIconProps) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4.47 6.47a.75.75 0 0 1 1.06 0L8 8.94l2.47-2.47a.75.75 0 0 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 0-1.06z"
        fill="currentColor"
      />
    </svg>
  );
}

function NavMenu({ menuOpen, setMenuOpen, menuRef, pathname }: NavMenuProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0, width: 240 });

  function updatePanelPosition() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const top = rect.bottom + 12;
    const availableWidth = Math.max(220, Math.min(360, window.innerWidth - 32));
    const centeredLeft = rect.left + rect.width / 2 - availableWidth / 2;
    const minLeft = 16;
    const maxLeft = window.innerWidth - availableWidth - 16;
    const left = Math.min(Math.max(centeredLeft, minLeft), maxLeft);
    setPanelPosition({ top, left, width: availableWidth });
  }

  useEffect(() => {
    if (!menuOpen) return;
    updatePanelPosition();

    const handle = () => updatePanelPosition();
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);

    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
    };
  }, [menuOpen]);

  return (
    <div ref={menuRef} className="relative z-[999]">
      <button
        ref={triggerRef}
        onClick={() => setMenuOpen((prev: boolean) => !prev)}
        className={cn(
          "flex items-center gap-2 rounded-full bg-white/8 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/12",
          menuOpen && "bg-white/15"
        )}
        aria-haspopup="true"
        aria-expanded={menuOpen}
        aria-label="Open navigation menu"
      >
        <ChevronIcon className={cn("transition-transform", menuOpen && "rotate-180")} />
        <span className="hidden sm:inline">Navigate</span>
      </button>
      <div
        className={cn(
          "fixed origin-top-right rounded-2xl border border-[var(--border)] bg-[#120d2b]/95 p-2 text-sm text-white/80 shadow-xl backdrop-blur",
          "z-[1000]",
          "transition-all duration-150",
          menuOpen ? "pointer-events-auto scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        )}
        style={{ top: panelPosition.top, left: panelPosition.left, width: panelPosition.width }}
      >
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "block rounded-xl px-3 py-2 transition-colors hover:bg-white/10",
              pathname === link.href ? "bg-white/15 text-white" : "text-white/70"
            )}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ label, tone = "info" }: StatusPillProps) {
  return (
    <span className={cn("flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium", toneStyles[tone])}>
      <span className="uppercase text-[10px] tracking-[0.25em] text-white/60">{label}</span>
    </span>
  );
}

export function AdminTopBar() {
  const { publicKey } = useWallet();
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [createVestingOpen, setCreateVestingOpen] = useState(false);
  const [vestingMode, setVestingMode] = useState<"snapshot" | "dynamic" | "manual">("snapshot");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function handlePauseStreams() {
    if (!publicKey) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await api.post("/streams/pause-all", {
        adminWallet: publicKey.toBase58(),
      });
      setPauseModalOpen(false);
      alert("All streams paused successfully");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to pause streams");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEmergencyStop() {
    if (!publicKey) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await api.post("/streams/emergency-stop", {
        adminWallet: publicKey.toBase58(),
      });
      setEmergencyModalOpen(false);
      alert("Emergency stop executed successfully");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to execute emergency stop");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <header className="glass-panel relative z-[120] flex flex-col gap-4 overflow-visible rounded-2xl px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex w-full flex-1 flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <Image 
            src="/WhatsApp Image 2025-10-04 at 12.46.50 PM.jpeg" 
            alt="Lil Gargs" 
            width={48}
            height={48}
            className="h-12 w-12 rounded-full border-2 border-purple-500/50 shadow-lg shadow-purple-500/20"
          />
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-[var(--muted)]">
              <span>Lil Gargs Admin Console</span>
            </div>
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">Vesting Dashboard</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
          <StatusPill label="Environment" value="Devnet" tone="info" />
          <StatusPill label="Last sync" value="11 min ago" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
        <NavMenu menuOpen={menuOpen} setMenuOpen={setMenuOpen} menuRef={menuRef} pathname={pathname} />
        <Button variant="primary" size="sm" className="px-4" onClick={() => setCreateVestingOpen(true)}>
          + Create Vesting
        </Button>
        <Button variant="ghost" size="sm" className="px-4 text-[#f0b94e]" onClick={() => setPauseModalOpen(true)}>
          Pause
        </Button>
        <Button variant="danger" size="sm" className="px-4" onClick={() => setEmergencyModalOpen(true)}>
          Emergency Stop
        </Button>
      </div>

      <Modal open={pauseModalOpen} onClose={() => setPauseModalOpen(false)} title="Pause All Streams">
        <div className="space-y-4">
          <p className="text-sm text-white/70">
            This will pause all active vesting streams. Recipients will not be able to claim tokens until streams are resumed.
          </p>
          <p className="text-sm text-white/60">
            Are you sure you want to pause all streams?
          </p>

          {actionError && (
            <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]">
              {actionError}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPauseModalOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button variant="ghost" size="sm" className="text-[#f0b94e]" loading={actionLoading} onClick={handlePauseStreams}>
              Pause All Streams
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={emergencyModalOpen} onClose={() => setEmergencyModalOpen(false)} title="Emergency Stop">
        <div className="space-y-4">
          <p className="text-sm text-white/70">
            <strong className="text-[var(--danger)]">WARNING:</strong> This will immediately stop and cancel all active vesting streams. This action cannot be undone.
          </p>
          <p className="text-sm text-white/60">
            Recipients will lose access to unvested tokens. Only use this in critical situations.
          </p>
          <p className="text-sm font-medium text-white">
            Type <code className="rounded bg-white/10 px-2 py-1 font-mono text-xs">EMERGENCY STOP</code> to confirm:
          </p>
          <input
            type="text"
            id="emergency-confirm"
            className="w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white placeholder:text-white/30 focus:border-[var(--danger)] focus:outline-none"
            placeholder="Type to confirm"
          />

          {actionError && (
            <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]">
              {actionError}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEmergencyModalOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={actionLoading}
              onClick={() => {
                const input = document.getElementById("emergency-confirm") as HTMLInputElement;
                if (input?.value === "EMERGENCY STOP") {
                  handleEmergencyStop();
                } else {
                  setActionError("Please type 'EMERGENCY STOP' to confirm");
                }
              }}
            >
              Execute Emergency Stop
            </Button>
          </div>
        </div>
      </Modal>

      <CreateVestingModal
        open={createVestingOpen}
        onClose={() => setCreateVestingOpen(false)}
        mode={vestingMode}
        onModeChange={setVestingMode}
      />
    </header>
  );
}
