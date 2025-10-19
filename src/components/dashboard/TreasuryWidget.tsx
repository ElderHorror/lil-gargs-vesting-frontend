"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { formatTokenAmount } from "@/lib/formatters";

type TreasuryStatus = {
  treasury: {
    address: string;
    balance: number;
    tokenMint: string;
  };
  allocations: {
    totalAllocated: number;
    totalClaimed: number;
    remainingNeeded: number;
  };
  status: {
    health: "healthy" | "warning" | "critical";
    buffer: number;
    bufferPercentage: number;
    sufficientFunds: boolean;
  };
  streamflow?: {
    deployed: boolean;
    poolBalance: number;
  };
  recommendations: string[];
};

export function TreasuryWidget() {
  const [treasuryStatus, setTreasuryStatus] = useState<TreasuryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTreasuryStatus();
    const interval = setInterval(fetchTreasuryStatus, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  async function fetchTreasuryStatus() {
    try {
      setError(null);
      const data = await api.get<TreasuryStatus>("/treasury/status");
      setTreasuryStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch treasury status");
    } finally {
      setLoading(false);
    }
  }

  const getHealthColor = (health: string) => {
    switch (health) {
      case "healthy":
        return "text-[var(--success)]";
      case "warning":
        return "text-[#f0b94e]";
      case "critical":
        return "text-[var(--danger)]";
      default:
        return "text-white";
    }
  };

  const getHealthBgColor = (health: string) => {
    switch (health) {
      case "healthy":
        return "bg-[var(--success)]/10";
      case "warning":
        return "bg-[#f0b94e]/10";
      case "critical":
        return "bg-[var(--danger)]/10";
      default:
        return "bg-white/5";
    }
  };

  if (loading) {
    return (
      <div className="glass-panel flex flex-col gap-4 rounded-2xl p-6">
        <p className="text-white/60">Loading treasury status...</p>
      </div>
    );
  }

  if (error || !treasuryStatus) {
    return (
      <div className="glass-panel flex flex-col gap-4 rounded-2xl p-6">
        <p className="text-[var(--danger)]">{error || "Failed to load treasury status"}</p>
        <Button variant="secondary" size="sm" onClick={fetchTreasuryStatus}>
          Retry
        </Button>
      </div>
    );
  }

  const { treasury, allocations, status, recommendations } = treasuryStatus;
  const bufferPercentage = status.bufferPercentage;

  return (
    <div className="glass-panel flex flex-col gap-4 rounded-2xl p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--muted)]">Pools & Treasury</p>
          <h2 className="text-xl font-semibold text-white">Treasury Status</h2>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-medium ${getHealthBgColor(status.health)} ${getHealthColor(status.health)}`}>
          {status.health === "healthy" ? "✅ Healthy" : status.health === "warning" ? "⚠️ Warning" : "🚨 Critical"}
        </div>
      </header>

      <div className="space-y-3 text-sm text-white/70">
        {/* Treasury Balance */}
        <div className="rounded-xl bg-white/5 p-4">
          <p className="text-white/60">Treasury Balance</p>
          <p className="text-2xl font-semibold text-white">{formatTokenAmount(treasury.balance)}</p>
          <p className="font-mono text-xs text-white/50 mt-1">{treasury.address.slice(0, 20)}...</p>
        </div>

        {/* Streamflow Pool */}
        {treasuryStatus.streamflow?.deployed && (
          <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-4">
            <p className="text-green-400 text-xs">Streamflow Pool (On-Chain)</p>
            <p className="text-2xl font-semibold text-green-400">{formatTokenAmount(treasuryStatus.streamflow.poolBalance)}</p>
            <p className="text-xs text-green-400/70 mt-1">Vesting on-chain via Streamflow</p>
          </div>
        )}

        {/* Allocations Overview */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-white/60 text-xs">Total Allocated</p>
            <p className="text-lg font-semibold text-white">{formatTokenAmount(allocations.totalAllocated, false)}</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-white/60 text-xs">Total Claimed</p>
            <p className="text-lg font-semibold text-white">{formatTokenAmount(allocations.totalClaimed, false)}</p>
          </div>
        </div>

        {/* Buffer Status */}
        <div className="rounded-xl bg-white/5 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white/60">Buffer</p>
            <p className={`font-semibold ${getHealthColor(status.health)}`}>{bufferPercentage}%</p>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all ${
                status.health === "healthy"
                  ? "bg-[var(--success)]"
                  : status.health === "warning"
                  ? "bg-[#f0b94e]"
                  : "bg-[var(--danger)]"
              }`}
              style={{ width: `${Math.min(bufferPercentage, 100)}%` }}
            />
          </div>
          <p className="text-xs text-white/50 mt-2">
            {formatTokenAmount(status.buffer, false)} remaining needed: {formatTokenAmount(allocations.remainingNeeded, false)}
          </p>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="rounded-xl bg-white/5 p-4">
            <p className="text-white/60 text-xs mb-2">Recommendations</p>
            <ul className="space-y-1">
              {recommendations.map((rec, idx) => (
                <li key={idx} className="text-xs text-white/70">
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Button variant="secondary" size="sm" className="w-full" onClick={fetchTreasuryStatus}>
        Refresh Status
      </Button>
    </div>
  );
}
