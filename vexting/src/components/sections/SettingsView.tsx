"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/sections/SectionHeader";
import { api } from "@/lib/api";

type Mode = "snapshot" | "dynamic";

type AdminConfig = {
  mode: Mode;
  allowModeSwitch: boolean;
  lastSnapshot: string;
  gracePeriodDays: number;
  claimFeeUsd: number;
  cluster: string;
  heliusApiKeySet: boolean;
  supabaseConnected: boolean;
};

const INITIAL_CONFIG: AdminConfig = {
  mode: "snapshot",
  allowModeSwitch: true,
  lastSnapshot: "Oct 15, 2025 19:24 UTC",
  gracePeriodDays: 14,
  claimFeeUsd: 10.00,
  cluster: "devnet",
  heliusApiKeySet: true,
  supabaseConnected: true,
};

// Team members removed - not needed for single admin setup

export function SettingsView() {
  const { publicKey } = useWallet();
  const [config, setConfig] = useState<AdminConfig>(INITIAL_CONFIG);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const configData = await api.get<Record<string, unknown>>("/config");
        
        if (configData) {
          setConfig({
            mode: (configData.mode as Mode) || "snapshot",
            allowModeSwitch: (configData.allowModeSwitch as boolean) ?? true,
            lastSnapshot: (configData.snapshotDate as string) || "Oct 15, 2025 19:24 UTC",
            gracePeriodDays: (configData.gracePeriodDays as number) || 14,
            claimFeeUsd: (configData.claimFeeUsd as number) || 10.00,
            cluster: "mainnet-beta",
            heliusApiKeySet: true,
            supabaseConnected: true,
          });
        }
      } catch (err) {
        console.error("Failed to fetch config:", err);
      }
    }
    fetchConfig();
  }, []);

  async function toggleModeSwitch() {
    if (!publicKey) {
      setError("Please connect your wallet first");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.put("/config", {
        allowModeSwitch: !config.allowModeSwitch,
        adminWallet: publicKey.toBase58(),
      });
      setConfig((prev) => ({ ...prev, allowModeSwitch: !prev.allowModeSwitch }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update config");
    } finally {
      setLoading(false);
    }
  }

  async function switchMode(mode: Mode) {
    if (!publicKey) {
      setError("Please connect your wallet first");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.put("/config/mode", {
        mode,
        adminWallet: publicKey.toBase58(),
      });
      setConfig((prev) => ({ ...prev, mode }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch mode");
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    if (!publicKey) {
      setError("Please connect your wallet first");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.put("/config", {
        gracePeriodDays: config.gracePeriodDays,
        claimFeeUsd: config.claimFeeUsd,
        adminWallet: publicKey.toBase58(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="glass-panel flex flex-col gap-4 rounded-2xl p-6">
        <SectionHeader
          eyebrow="Settings"
          title="Admin Settings"
          description="Configure vesting mode, cluster credentials, and team access controls."
          actions={(
            <>
              <Button variant="ghost" size="sm" onClick={saveConfig} loading={loading}>
                Save Draft
              </Button>
              <Button size="sm" onClick={saveConfig} loading={loading}>Publish Config</Button>
            </>
          )}
        />
      </header>

      <section className="max-w-md">
        <aside className="glass-panel rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white">Mode Configuration</h2>
          <div className="mt-4 space-y-4 text-sm text-white/80">
            <div className="rounded-xl bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-white/50">Current Mode</p>
              <p className="mt-2 text-xl font-semibold text-white">{config.mode.toUpperCase()}</p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant={config.mode === "snapshot" ? "primary" : "ghost"} onClick={() => switchMode("snapshot")} disabled={loading}>
                  Snapshot
                </Button>
                <Button size="sm" variant={config.mode === "dynamic" ? "primary" : "ghost"} onClick={() => switchMode("dynamic")} disabled={loading}>
                  Dynamic
                </Button>
              </div>
              {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}
              <p className="mt-3 text-xs text-white/50">Backed by `switchMode.ts` script and `VestingModeService`.</p>
            </div>
            <div className="rounded-xl bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-white/50">Allow Mode Switch</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-white/70">Toggle to allow CLI or UI switches</span>
                <button
                  className={`relative inline-flex h-6 w-12 items-center rounded-full transition ${
                    config.allowModeSwitch ? "bg-[var(--accent)]" : "bg-white/20"
                  }`}
                  onClick={toggleModeSwitch}
                >
                  <span className={`h-5 w-5 rounded-full bg-white transition ${config.allowModeSwitch ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            </div>
            <div className="rounded-xl bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-white/50">Grace Period</p>
              <p className="mt-2 text-xl font-semibold text-white">{config.gracePeriodDays} days</p>
              <p className="text-xs text-white/50">Used across snapshot & dynamic reclaim flows.</p>
            </div>
            <div className="rounded-xl bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-white/50">Claim Fee (USD)</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xl font-semibold text-white">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={config.claimFeeUsd}
                  onChange={(e) => setConfig((prev) => ({ ...prev, claimFeeUsd: parseFloat(e.target.value) || 0 }))}
                  className="w-24 rounded-lg border border-white/20 bg-white/10 px-3 py-1 text-xl font-semibold text-white focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
              <p className="mt-2 text-xs text-white/50">Fee charged when users claim vested tokens.</p>
            </div>
          </div>
        </aside>

      </section>
    </div>
  );
}

