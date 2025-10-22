"use client";

import { ReactNode, useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
// import { cn } from "@/lib/utils";
import { formatTokenAmount } from "@/lib/formatters";

function useCopyToClipboard() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return { copiedId, copy };
}

export type VestingSummary = {
  poolTotal: number;
  poolState: string;
  poolPaused: boolean;
  distributionType: string;
  userShare: {
    percentage: number;
    totalEligible: number;
  };
  balances: {
    unlocked: number;
    locked: number;
    totalClaimed: number;
  };
  nextUnlock: {
    seconds: number;
    timestamp: number;
  };
  vestingSchedule: {
    startTime: number;
    cliffTime: number;
    endTime: number;
  };
  nftCount: number;
  tier: number;
  eligible: boolean;
  streamflow?: {
    deployed: boolean;
    streamId: string | null;
    vestedPercentage: number;
  };
};

export type ClaimHistoryItem = {
  id: string;
  vestingId?: string;
  date: string;
  amount: number;
  feePaid: number;
  transactionSignature: string;
  status: string;
};

export type VestingRewardsCardProps = {
  wallet: string;
  poolId?: string;
  summary: VestingSummary | null;
  history: ClaimHistoryItem[];
  loadingSummary: boolean;
  loadingHistory: boolean;
  claimLoading: boolean;
  error: string | null;
  onClaim: (poolId?: string) => void;
  footer?: ReactNode;
};

function formatToken(amount: number) {
  return formatTokenAmount(Math.max(0, amount), false); // Returns formatted number without GARG suffix
}

function formatShare(percentage: number) {
  return `${percentage.toFixed(2)}%`;
}

function formatCountdown(seconds: number) {
  if (seconds <= 0) return "Fully unlocked";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function SummarySkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
      <div className="h-36 animate-pulse rounded-2xl bg-white/5" />
      <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-14 animate-pulse rounded-2xl bg-white/5" />
      ))}
    </div>
  );
}

export function VestingRewardsCard({
  // wallet,
  poolId,
  summary,
  history,
  loadingSummary,
  loadingHistory,
  claimLoading,
  error,
  onClaim,
  footer,
}: VestingRewardsCardProps) {
  const { copiedId, copy } = useCopyToClipboard();
  
  // Live countdown timer
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate live unlocked balance - updates every second!
  const liveUnlockedBalance = useMemo(() => {
    if (!summary || !summary.vestingSchedule) return summary?.balances.unlocked || 0;
    
    const { startTime, cliffTime, endTime } = summary.vestingSchedule;
    const totalAllocation = summary.userShare.totalEligible;
    const totalClaimed = summary.balances.totalClaimed;
    
    // Debug logging
    console.log('Vesting calc:', {
      currentTime,
      startTime,
      cliffTime,
      endTime,
      totalAllocation,
      totalClaimed,
      hasStarted: currentTime >= startTime,
      afterCliff: currentTime >= cliffTime,
    });
    
    // Always use client-side linear calculation for smooth per-second updates
    // IMPORTANT: During cliff period, NO tokens are unlocked
    if (currentTime < startTime) {
      return 0;
    } else if (currentTime < cliffTime) {
      // During cliff period - no tokens unlocked yet
      return 0;
    } else if (currentTime >= endTime) {
      return totalAllocation - totalClaimed;
    } else {
      // After cliff: tokens vest linearly from startTime to endTime
      const timeElapsed = currentTime - startTime;
      const totalVestingTime = endTime - startTime;
      const vestedAmount = (totalAllocation * timeElapsed) / totalVestingTime;
      return Math.max(0, vestedAmount - totalClaimed);
    }
  }, [summary, currentTime]);

  // Calculate live countdown
  const liveCountdownSeconds = useMemo(() => {
    if (!summary || !summary.vestingSchedule) return summary?.nextUnlock.seconds || 0;
    return Math.max(0, summary.vestingSchedule.endTime - currentTime);
  }, [summary, currentTime]);

  // Calculate live vested percentage for display
  const liveVestedPercentage = useMemo(() => {
    if (!summary || !summary.vestingSchedule) return 0;
    
    const { startTime, endTime } = summary.vestingSchedule;
    
    if (currentTime < startTime) {
      return 0;
    } else if (currentTime >= endTime) {
      return 100;
    } else {
      const timeElapsed = currentTime - startTime;
      const totalVestingTime = endTime - startTime;
      return (timeElapsed / totalVestingTime) * 100;
    }
  }, [summary, currentTime]);

  // Check if user can claim (only after cliff, and only if there's unlocked balance)
  const canClaim = useMemo(() => {
    console.log('Can claim check:', {
      hasSummary: !!summary,
      liveUnlockedBalance,
      hasBalance: liveUnlockedBalance > 0,
      currentTime,
      cliffTime: summary?.vestingSchedule?.cliffTime,
      endTime: summary?.vestingSchedule?.endTime,
      afterCliff: summary?.vestingSchedule ? currentTime >= summary.vestingSchedule.cliffTime : false,
      fullyVested: summary?.vestingSchedule ? currentTime >= summary.vestingSchedule.endTime : false,
    });
    
    if (!summary || liveUnlockedBalance <= 0) return false;
    
    // If no vesting schedule, allow claiming (backwards compatibility)
    if (!summary.vestingSchedule) return true;
    
    // Can claim if:
    // 1. After cliff time, OR
    // 2. Fully vested (current time >= end time)
    const afterCliff = currentTime >= summary.vestingSchedule.cliffTime;
    const fullyVested = currentTime >= summary.vestingSchedule.endTime;
    
    return afterCliff || fullyVested;
  }, [summary, liveUnlockedBalance, currentTime]);
  const shareWidth = useMemo(() => {
    const value = summary?.userShare.percentage ?? 0;
    if (!Number.isFinite(value)) return "0%";
    const clamped = Math.max(0, Math.min(100, value));
    return `${clamped}%`;
  }, [summary?.userShare.percentage]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col">
      <div className="w-full rounded-3xl border border-white/10 bg-[#151236] px-6 py-7 shadow-[0_40px_120px_-40px_rgba(58,46,216,0.65)]">
        <div className="space-y-6">
          {error && (
            <div className="rounded-2xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-4 text-sm text-[var(--danger)]">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--danger)]/20">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1 whitespace-pre-line">
                  {error}
                </div>
              </div>
            </div>
          )}

          {loadingSummary && !summary ? (
            <SummarySkeleton />
          ) : summary ? (
            <div className="space-y-6">
              <section className="rounded-2xl bg-white/5 p-4">
                <div className="grid gap-3 text-sm">
                  <div className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3">
                    <span className="text-xs uppercase tracking-[0.3em] text-white/50">Total Pool</span>
                    <span className="text-base font-semibold text-white">{formatToken(summary.poolTotal)} $GARG</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3">
                    <span className="text-xs uppercase tracking-[0.3em] text-white/50">Distribution</span>
                    <span className="text-sm text-white/80">{summary.distributionType}</span>
                  </div>
                  {summary.streamflow?.deployed && (
                    <div className="flex items-center justify-between rounded-xl bg-green-500/10 border border-green-500/30 px-4 py-3">
                      <span className="text-xs uppercase tracking-[0.3em] text-green-400">On-Chain Vesting</span>
                      <span className="text-sm font-semibold text-green-400">{liveVestedPercentage.toFixed(2)}% Vested</span>
                    </div>
                  )}
                  {summary.poolState === 'paused' && (
                    <div className="flex items-center justify-between rounded-xl bg-yellow-500/10 border border-yellow-500/30 px-4 py-3">
                      <span className="text-xs uppercase tracking-[0.3em] text-yellow-400">Pool Paused</span>
                      <span className="text-sm font-semibold text-yellow-400">Claims Temporarily Disabled</span>
                    </div>
                  )}
                  {summary.poolState === 'cancelled' && (
                    <div className="flex items-center justify-between rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3">
                      <span className="text-xs uppercase tracking-[0.3em] text-red-400">Pool Cancelled</span>
                      <span className="text-sm font-semibold text-red-400">No Further Claims Allowed</span>
                    </div>
                  )}
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>Your Share</span>
                    <span className="font-medium text-white">{formatShare(summary.userShare.percentage)}</span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-[var(--accent)] transition-all" style={{ width: shareWidth }} />
                  </div>
                  <p className="mt-3 text-sm text-white/70">
                    Your Total Eligible Vesting <span className="font-medium text-white">{formatToken(summary.userShare.totalEligible)} $GARG</span>
                  </p>
                </div>
              </section>

              <section className="rounded-2xl bg-white/5 p-4">
                <div className="grid gap-4 text-sm">
                  <div className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.3em] text-white/50">Unlocked Balance</p>
                      <p className="text-base font-semibold text-white">{formatToken(liveUnlockedBalance)} GARG</p>
                    </div>
                    <div className="text-right text-xs text-white/40">
                      Previously claimed: {formatToken(summary.balances.totalClaimed)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-white/50">Locked Balance</p>
                      <p className="text-base font-semibold text-white">{formatToken(summary.userShare.totalEligible - liveUnlockedBalance - summary.balances.totalClaimed)} GARG</p>
                    </div>
                    <div className="text-right text-xs text-white/40">
                      NFT Tier {summary.tier} · {summary.nftCount} NFT{summary.nftCount === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-white/50">Next Unlock</p>
                      <p className="text-base font-semibold text-white">{formatCountdown(liveCountdownSeconds)}</p>
                    </div>
                    <div className="text-right text-xs text-white/40">
                      Unlocks at {formatDate(new Date(summary.nextUnlock.timestamp * 1000).toISOString())}
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <Button
                    size="lg"
                    className="w-full text-sm font-semibold"
                    loading={claimLoading}
                    onClick={() => onClaim(poolId)}
                    disabled={!canClaim || claimLoading || summary.poolState === 'paused' || summary.poolState === 'cancelled'}
                  >
                    {summary.poolState === 'paused' ? 'Pool Paused - Claims Disabled' : 
                     summary.poolState === 'cancelled' ? 'Pool Cancelled - No Claims' : 
                     'Claim Unlocked $GARG'}
                  </Button>
                </div>
              </section>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/20 p-6 text-center text-sm text-white/60">
              Connect a wallet with active vesting to view rewards.
            </div>
          )}

          <section className="rounded-2xl bg-white/5 p-4">
            <header className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">Claim History</p>
                <p className="text-xs text-white/40">Record of completed withdrawals</p>
              </div>
            </header>

            <div className="mt-4 space-y-3">
              {loadingHistory ? (
                <HistorySkeleton />
              ) : history.length === 0 ? (
                <p className="rounded-2xl bg-white/10 px-4 py-5 text-center text-xs text-white/50">
                  No claims recorded yet. Your withdrawals will appear here.
                </p>
              ) : (
                history.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-4 text-sm">
                    <div className="flex-1">
                      <p className="font-medium text-white">{formatDate(entry.date)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-white/50">Tx: {entry.transactionSignature.slice(0, 4)}…{entry.transactionSignature.slice(-4)}</p>
                        <button
                          onClick={() => copy(entry.transactionSignature, entry.id)}
                          className="text-xs text-[var(--accent)] hover:text-[var(--accent)]/80 transition-colors"
                          title="Copy transaction signature"
                        >
                          {copiedId === entry.id ? '✓ Copied' : '📋 Copy'}
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-white">{formatToken(entry.amount)} GARG</p>
                      <p className="text-xs text-[var(--accent)]">{entry.status}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {footer && <div>{footer}</div>}
        </div>
      </div>
    </div>
  );
}
