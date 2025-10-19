"use client";

import type { SnapshotRule } from "@/types/vesting";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type RuleTableProps = {
  rules: SnapshotRule[];
  onToggle: (id: string) => void;
  onEdit: (rule: SnapshotRule) => void;
};

export function RuleTable({ rules, onToggle, onEdit }: RuleTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white/5">
      <table className="min-w-full divide-y divide-white/5">
        <thead className="bg-white/5 text-xs uppercase tracking-[0.35em] text-[var(--muted)]">
          <tr>
            <th className="px-4 py-3 text-left">Rule</th>
            <th className="px-4 py-3 text-left">Contract</th>
            <th className="px-4 py-3 text-left">Threshold</th>
            <th className="px-4 py-3 text-left">Allocation</th>
            <th className="px-4 py-3 text-left">Enabled</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-sm text-white/80">
          {rules.map((rule) => (
            <tr key={rule.id} className="transition-colors hover:bg-white/10">
              <td className="px-4 py-3">
                <div className="flex flex-col">
                  <span className="font-medium text-white">{rule.name}</span>
                  <span className="text-xs text-white/60">{rule.id}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-white/70">{rule.nftContract}</td>
              <td className="px-4 py-3">≥ {rule.threshold}</td>
              <td className="px-4 py-3">
                {rule.allocationType === "FIXED"
                  ? `${rule.allocationValue.toLocaleString()} tokens / NFT`
                  : `${rule.allocationValue}% of pool`}
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
                    rule.enabled
                      ? "bg-[var(--success)]/15 text-[var(--success)]"
                      : "bg-white/10 text-white/60"
                  )}
                >
                  <span className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: rule.enabled ? "var(--success)" : "rgba(255,255,255,0.35)",
                    }}
                  />
                  {rule.enabled ? "Active" : "Disabled"}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => onEdit(rule)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant={rule.enabled ? "secondary" : "primary"}
                    onClick={() => onToggle(rule.id)}
                  >
                    {rule.enabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
