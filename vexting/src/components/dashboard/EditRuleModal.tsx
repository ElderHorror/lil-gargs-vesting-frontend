"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import type { SnapshotRule } from "@/types/vesting";

type EditRuleModalProps = {
  open: boolean;
  onClose: () => void;
  rule: SnapshotRule | null;
  poolId: string | null;
  onSuccess: () => void;
};

export function EditRuleModal({ open, onClose, rule, poolId, onSuccess }: EditRuleModalProps) {
  const [name, setName] = useState("");
  const [nftContract, setNftContract] = useState("");
  const [threshold, setThreshold] = useState("");
  const [allocationType, setAllocationType] = useState<"PERCENTAGE" | "FIXED">("PERCENTAGE");
  const [allocationValue, setAllocationValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setNftContract(rule.nftContract);
      setThreshold(rule.threshold.toString());
      setAllocationType(rule.allocationType);
      setAllocationValue(rule.allocationValue.toString());
    }
  }, [rule]);

  async function handleSave() {
    if (!poolId || !rule) return;

    try {
      setLoading(true);
      setError(null);

      // Validate inputs
      if (!name || !nftContract || !threshold || !allocationValue) {
        throw new Error("All fields are required");
      }

      // Update the pool's nft_requirements in the database
      await api.put(`/pools/${poolId}/rules`, {
        ruleId: rule.id,
        name,
        nftContract,
        threshold: Number(threshold),
        allocationType,
        allocationValue: Number(allocationValue),
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update rule");
    } finally {
      setLoading(false);
    }
  }

  if (!rule) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Edit Rule: ${rule.name}`}>
      <div className="space-y-4 text-sm text-white/80">
        {error && (
          <div className="rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 p-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/60">Rule Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
            placeholder="OG Holders"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/60">NFT Collection Mint</span>
          <input
            type="text"
            value={nftContract}
            onChange={(e) => setNftContract(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white font-mono text-xs placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
            placeholder="83sizftJAr24WF4Ji4c8qZdboiE6anNx4mUrVGQ8WhpF"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/60">Minimum NFTs</span>
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
            placeholder="1"
            min="1"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/60">Allocation Type</span>
          <select
            value={allocationType}
            onChange={(e) => setAllocationType(e.target.value as "PERCENTAGE" | "FIXED")}
            className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white focus:border-[var(--accent)] focus:outline-none"
          >
            <option value="PERCENTAGE">Percentage of pool</option>
            <option value="FIXED">Fixed amount</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/60">
            {allocationType === "PERCENTAGE" ? "Percentage (%)" : "Fixed Amount (tokens)"}
          </span>
          <input
            type="number"
            value={allocationValue}
            onChange={(e) => setAllocationValue(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
            placeholder={allocationType === "PERCENTAGE" ? "50" : "1000000000"}
            min="0"
          />
          <span className="text-xs text-white/40">
            {allocationType === "PERCENTAGE" 
              ? "Percentage of total pool allocated to this rule" 
              : "Fixed token amount per eligible wallet"}
          </span>
        </label>

        <div className="flex gap-3 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={loading} className="flex-1">
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={loading} className="flex-1">
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
