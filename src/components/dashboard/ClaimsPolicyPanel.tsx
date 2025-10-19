"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";

type ClaimPolicy = {
  enableClaims: boolean;
  requireNFTOnClaim: boolean;
  claimFeeUSD: number;
  cooldownDays: number;
  gracePeriodDays: number;
};

export function ClaimsPolicyPanel() {
  const [policy, setPolicy] = useState<ClaimPolicy>({
    enableClaims: true,
    requireNFTOnClaim: true,
    claimFeeUSD: 10.0,
    cooldownDays: 1,
    gracePeriodDays: 14,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFee, setEditFee] = useState("");
  const [editCooldown, setEditCooldown] = useState("");
  const [editGracePeriod, setEditGracePeriod] = useState("");

  useEffect(() => {
    async function fetchPolicy() {
      try {
        const data = await api.get<ClaimPolicy>("/config/claim-policy");
        setPolicy(data);
      } catch (err) {
        console.error("Failed to fetch claim policy:", err);
      }
    }
    fetchPolicy();
  }, []);

  async function updatePolicy(updates: Partial<ClaimPolicy>) {
    setLoading(true);
    setError(null);
    try {
      await api.put("/config/claim-policy", {
        ...updates,
        adminWallet: "ADMIN_WALLET_PLACEHOLDER",
      });
      setPolicy((prev) => ({ ...prev, ...updates }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update policy");
    } finally {
      setLoading(false);
    }
  }

  function toggleClaims() {
    updatePolicy({ enableClaims: !policy.enableClaims });
  }

  function toggleNFTRequirement() {
    updatePolicy({ requireNFTOnClaim: !policy.requireNFTOnClaim });
  }

  function openEditModal() {
    setEditFee(policy.claimFeeUSD.toString());
    setEditCooldown(policy.cooldownDays.toString());
    setEditGracePeriod(policy.gracePeriodDays.toString());
    setEditModalOpen(true);
  }

  async function saveEdits() {
    setLoading(true);
    setError(null);
    try {
      const updates = {
        claimFeeUSD: parseFloat(editFee) || 0,
        cooldownDays: parseInt(editCooldown) || 0,
        gracePeriodDays: parseInt(editGracePeriod) || 0,
      };
      await api.put("/config/claim-policy", {
        ...updates,
        adminWallet: "ADMIN_WALLET_PLACEHOLDER",
      });
      setPolicy((prev) => ({ ...prev, ...updates }));
      setEditModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update policy");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-panel flex flex-col gap-4 rounded-2xl p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">Claims & Fees</p>
          <h2 className="text-xl font-semibold text-white">Claim Policy</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={openEditModal}>
          Edit Settings
        </Button>
      </header>

      <div className="space-y-3 text-sm text-white/70">
        <SettingToggle
          label="Enable Claims"
          helper="Gate withdrawals globally"
          value={policy.enableClaims}
          onToggle={toggleClaims}
          disabled={loading}
        />
        <SettingToggle
          label="Require NFT on Claim"
          helper="Enforce NFT verification"
          value={policy.requireNFTOnClaim}
          onToggle={toggleNFTRequirement}
          disabled={loading}
        />
        <SettingRow label="Withdraw Fee" value={`$${policy.claimFeeUSD.toFixed(2)} USD`} />
        <SettingRow label="Cooldown" value={`${policy.cooldownDays} day${policy.cooldownDays === 1 ? "" : "s"}`} helper="Auto" />
        <SettingRow label="Grace Period" value={`${policy.gracePeriodDays} days`} />
      </div>

      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Claim Policy">
        <div className="space-y-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.25em] text-white/50">Withdraw Fee (USD)</span>
            <input
              type="number"
              step="0.01"
              value={editFee}
              onChange={(e) => setEditFee(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
              placeholder="10.00"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.25em] text-white/50">Cooldown (days)</span>
            <input
              type="number"
              value={editCooldown}
              onChange={(e) => setEditCooldown(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
              placeholder="1"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.25em] text-white/50">Grace Period (days)</span>
            <input
              type="number"
              value={editGracePeriod}
              onChange={(e) => setEditGracePeriod(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
              placeholder="14"
            />
          </label>

          {error && (
            <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditModalOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button size="sm" loading={loading} onClick={saveEdits}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

type SettingToggleProps = {
  label: string;
  helper?: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

function SettingToggle({ label, helper, value, onToggle, disabled }: SettingToggleProps) {
  return (
    <div className="flex items-start justify-between rounded-xl bg-white/5 px-3 py-2">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-white/50">{label}</p>
        {helper && <p className="text-xs text-white/40">{helper}</p>}
      </div>
      <button
        className={`relative inline-flex h-6 w-12 items-center rounded-full transition ${
          value ? "bg-[var(--accent)]" : "bg-white/20"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        onClick={onToggle}
        disabled={disabled}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white transition ${value ? "translate-x-6" : "translate-x-1"}`}
        />
      </button>
    </div>
  );
}

type SettingRowProps = {
  label: string;
  value: string;
  helper?: string;
};

function SettingRow({ label, value, helper }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-white/50">{label}</p>
        {helper && <p className="text-xs text-white/40">{helper}</p>}
      </div>
      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">{value}</span>
    </div>
  );
}
