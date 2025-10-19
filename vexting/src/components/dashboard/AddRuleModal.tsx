"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";

type AddRuleModalProps = {
  open: boolean;
  onClose: () => void;
  poolId: string;
  onSuccess: () => void;
};

export function AddRuleModal({ open, onClose, poolId, onSuccess }: AddRuleModalProps) {
  const [name, setName] = useState("");
  const [nftContract, setNftContract] = useState("");
  const [threshold, setThreshold] = useState("1");
  const [allocationType, setAllocationType] = useState<"FIXED" | "PERCENTAGE">("FIXED");
  const [allocationValue, setAllocationValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name || !nftContract || !threshold || !allocationValue) {
      setError("All fields are required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.post(`/pools/${poolId}/rules`, {
        name,
        nftContract,
        threshold: parseInt(threshold),
        allocationType,
        allocationValue: parseFloat(allocationValue),
        enabled: true,
      });

      // Reset form
      setName("");
      setNftContract("");
      setThreshold("1");
      setAllocationType("FIXED");
      setAllocationValue("");
      
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add rule");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add New Snapshot Rule">
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs uppercase tracking-[0.25em] text-white/50 mb-2">
            Rule Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Fused OGs"
            className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-[0.25em] text-white/50 mb-2">
            NFT Contract Address
          </label>
          <input
            type="text"
            value={nftContract}
            onChange={(e) => setNftContract(e.target.value)}
            placeholder="Collection address"
            className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-[0.25em] text-white/50 mb-2">
            Threshold (Min NFTs)
          </label>
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            min="1"
            className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-[0.25em] text-white/50 mb-2">
            Allocation Type
          </label>
          <select
            value={allocationType}
            onChange={(e) => setAllocationType(e.target.value as "FIXED" | "PERCENTAGE")}
            className="w-full rounded-lg border border-[var(--border)] bg-[#0c0b25] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="FIXED">Fixed Amount</option>
            <option value="PERCENTAGE">Percentage of Pool</option>
          </select>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-[0.25em] text-white/50 mb-2">
            Allocation Value
          </label>
          <input
            type="number"
            value={allocationValue}
            onChange={(e) => setAllocationValue(e.target.value)}
            placeholder={allocationType === "FIXED" ? "e.g., 1000000" : "e.g., 50"}
            className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <p className="mt-1 text-xs text-white/50">
            {allocationType === "FIXED" ? "Tokens per NFT" : "Percentage of total pool"}
          </p>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} loading={loading}>
          Add Rule
        </Button>
      </div>
    </Modal>
  );
}
