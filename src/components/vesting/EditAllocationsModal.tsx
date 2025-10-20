"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";

type ManualAllocation = {
  id: string;
  wallet: string;
  allocationType: "PERCENTAGE" | "FIXED";
  allocationValue: number;
  note?: string;
};

type EditAllocationsModalProps = {
  open: boolean;
  onClose: () => void;
  poolId: string;
  poolName: string;
  totalPoolAmount: number;
  currentAllocations: Array<{
    user_wallet: string;
    token_amount: number;
    share_percentage: number;
  }>;
  onSuccess: () => void;
};

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export function EditAllocationsModal({
  open,
  onClose,
  poolId,
  poolName,
  totalPoolAmount,
  currentAllocations,
  onSuccess,
}: EditAllocationsModalProps) {
  const [allocations, setAllocations] = useState<ManualAllocation[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkWallets, setBulkWallets] = useState("");
  const [bulkAllocationType, setBulkAllocationType] = useState<"PERCENTAGE" | "FIXED">("FIXED");
  const [bulkAllocationValue, setBulkAllocationValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    // Convert current allocations to editable format
    const editableAllocations = currentAllocations.map((alloc) => ({
      id: generateId(),
      wallet: alloc.user_wallet,
      allocationType: "PERCENTAGE" as const,
      allocationValue: alloc.share_percentage,
      note: undefined,
    }));

    setAllocations(editableAllocations);
    setBulkMode(false);
    setBulkWallets("");
    setError(null);
  }, [open, currentAllocations]);

  function addAllocation() {
    setAllocations((prev) => [
      ...prev,
      {
        id: generateId(),
        wallet: "",
        allocationType: "PERCENTAGE",
        allocationValue: 0,
        note: undefined,
      },
    ]);
  }

  function removeAllocation(id: string) {
    setAllocations((prev) => prev.filter((a) => a.id !== id));
  }

  function updateAllocation(id: string, field: keyof ManualAllocation, value: string | number | undefined) {
    setAllocations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
  }

  function processBulkWallets() {
    const lines = bulkWallets.split("\n").filter((line) => line.trim());
    const newAllocations: ManualAllocation[] = lines.map((wallet) => ({
      id: generateId(),
      wallet: wallet.trim(),
      allocationType: bulkAllocationType,
      allocationValue: bulkAllocationValue,
    }));

    setAllocations((prev) => [...prev, ...newAllocations]);
    setBulkWallets("");
    setBulkMode(false);
  }

  async function handleSave() {
    setLoading(true);
    setError(null);

    try {
      // Validate
      const validAllocations = allocations.filter((a) => a.wallet.trim());

      if (validAllocations.length === 0) {
        throw new Error("Add at least one wallet allocation");
      }

      // Calculate totals
      let totalPercentage = 0;
      let totalFixed = 0;

      for (const alloc of validAllocations) {
        if (alloc.allocationType === "PERCENTAGE") {
          totalPercentage += alloc.allocationValue;
        } else {
          totalFixed += alloc.allocationValue;
        }
      }

      if (totalPercentage > 100) {
        throw new Error(`Percentage allocations sum to ${totalPercentage.toFixed(2)}%, which exceeds 100%`);
      }

      if (totalFixed > totalPoolAmount) {
        throw new Error(`Fixed allocations (${totalFixed}) exceed pool amount (${totalPoolAmount})`);
      }

      // Update allocations
      await api.put(`/pools/${poolId}/allocations`, {
        allocations: validAllocations.map((a) => ({
          wallet: a.wallet,
          allocationType: a.allocationType,
          allocationValue: a.allocationValue,
          note: a.note,
        })),
      });

      alert(`Successfully updated allocations for ${validAllocations.length} wallet(s)!`);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update allocations");
    } finally {
      setLoading(false);
    }
  }

  // Calculate current totals
  const totalPercentage = allocations
    .filter((a) => a.allocationType === "PERCENTAGE")
    .reduce((sum, a) => sum + a.allocationValue, 0);

  const totalFixed = allocations
    .filter((a) => a.allocationType === "FIXED")
    .reduce((sum, a) => sum + a.allocationValue, 0);

  return (
    <Modal open={open} onClose={onClose} title={`Edit Allocations - ${poolName}`} widthClassName="max-w-3xl">
      <div className="space-y-6 text-sm text-white/80">
        {/* Pool Info */}
        <section className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-4">
          <div className="flex justify-between text-xs">
            <span className="text-white/60">Total Pool Amount:</span>
            <span className="font-semibold text-white">{totalPoolAmount.toLocaleString()} tokens</span>
          </div>
          <div className="mt-2 flex justify-between text-xs">
            <span className="text-white/60">Current Allocations:</span>
            <span className="font-semibold text-white">{allocations.length} wallet(s)</span>
          </div>
        </section>

        {/* Allocation Summary */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex justify-between text-xs">
            <span className="text-white/60">Total Percentage:</span>
            <span className={totalPercentage > 100 ? "text-red-400" : "text-green-400"}>
              {totalPercentage.toFixed(2)}%
            </span>
          </div>
          <div className="mt-2 flex justify-between text-xs">
            <span className="text-white/60">Total Fixed:</span>
            <span className={totalFixed > totalPoolAmount ? "text-red-400" : "text-green-400"}>
              {totalFixed.toLocaleString()} tokens
            </span>
          </div>
        </section>

        {/* Bulk Add Mode */}
        {bulkMode ? (
          <section className="space-y-3 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-4">
            <h3 className="text-sm font-semibold text-white">Bulk Add Wallets</h3>
            <textarea
              value={bulkWallets}
              onChange={(e) => setBulkWallets(e.target.value)}
              placeholder="Paste wallet addresses (one per line)"
              className="h-32 w-full rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/60">Allocation Type</span>
                <select
                  value={bulkAllocationType}
                  onChange={(e) => setBulkAllocationType(e.target.value as "PERCENTAGE" | "FIXED")}
                  className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white focus:border-[var(--accent)] focus:outline-none"
                >
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED">Fixed Amount</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/60">
                  {bulkAllocationType === "PERCENTAGE" ? "Percentage (%)" : "Token Amount"}
                </span>
                <input
                  type="number"
                  value={bulkAllocationValue}
                  onChange={(e) => setBulkAllocationValue(Number(e.target.value))}
                  className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-white focus:border-[var(--accent)] focus:outline-none"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={processBulkWallets}>
                Add Wallets
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setBulkMode(false)}>
                Cancel
              </Button>
            </div>
          </section>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" onClick={addAllocation}>
              + Add Wallet
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setBulkMode(true)}>
              Bulk Add
            </Button>
          </div>
        )}

        {/* Allocations List */}
        <section className="space-y-3">
          {allocations.map((allocation) => (
            <div key={allocation.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    value={allocation.wallet}
                    onChange={(e) => updateAllocation(allocation.id, "wallet", e.target.value)}
                    placeholder="Wallet address"
                    className="flex-1 rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeAllocation(allocation.id)}>
                    Remove
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-white/60">Type</span>
                    <select
                      value={allocation.allocationType}
                      onChange={(e) =>
                        updateAllocation(allocation.id, "allocationType", e.target.value)
                      }
                      className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white focus:border-[var(--accent)] focus:outline-none"
                    >
                      <option value="PERCENTAGE">Percentage</option>
                      <option value="FIXED">Fixed Amount</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-white/60">
                      {allocation.allocationType === "PERCENTAGE" ? "Percentage (%)" : "Token Amount"}
                    </span>
                    <input
                      type="number"
                      value={allocation.allocationValue}
                      onChange={(e) =>
                        updateAllocation(allocation.id, "allocationValue", Number(e.target.value))
                      }
                      className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white focus:border-[var(--accent)] focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-white/60">Note (optional)</span>
                    <input
                      value={allocation.note || ""}
                      onChange={(e) => updateAllocation(allocation.id, "note", e.target.value)}
                      placeholder="e.g., Team member"
                      className="rounded-lg border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[var(--accent)] focus:outline-none"
                    />
                  </label>
                </div>
              </div>
            </div>
          ))}
        </section>

        {error && (
          <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/15 p-3 text-xs text-[var(--danger)]">
            {error}
          </div>
        )}

        <footer className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} loading={loading}>
            Save Changes
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
