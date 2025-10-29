"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection } from "@solana/web3.js";
import { WalletConnectButton } from "./WalletConnectButton";
import { apiClient } from "@/lib/apiClient";
import { CircularProgress } from "@/components/ui/CircularProgress";
import { RetryPrompt } from "@/components/ui/RetryPrompt";

interface Pool {
  poolId: string;
  poolName: string;
  claimable: number;
  locked: number;
  claimed: number;
  share: number;
  nftCount: number;
  status: string;
}

interface SummaryData {
  totalClaimable: number;
  totalLocked: number;
  totalClaimed: number;
  totalVested: number;
  vestedPercentage: number;
  nextUnlockTime: number;
  pools?: Pool[];
}

interface ClaimHistoryItem {
  id: string;
  date: string;
  amount: number;
  transactionSignature: string;
  status: string;
  poolName: string;
}

type Tab = "overview" | "history";

export function VestingDashboard() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [history, setHistory] = useState<ClaimHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [successToast, setSuccessToast] = useState<{ message: string; signature: string } | null>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isInitialLoad = useRef(true);

  const connection = useMemo(
    () => new Connection('https://mainnet.helius-rpc.com/?api-key=17f39a5b-e46f-42f7-a4e3-3ece44a6426a'),
    []
  );

  // Add event listener for refresh-summary event
  useEffect(() => {
    const handleRefreshSummary = () => {
      void loadSummary();
    };

    window.addEventListener('refresh-summary', handleRefreshSummary);
    return () => {
      window.removeEventListener('refresh-summary', handleRefreshSummary);
      // Clear cache when component unmounts
      if (wallet) {
        apiClient.clearCache(`vesting-summary-${wallet}`);
        apiClient.clearCache(`claim-history-${wallet}`);
      }
    };
  }, [loadSummary, wallet]);

  const loadSummary = useCallback(async () => {
    if (!wallet) {
      setSummary(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<SummaryData>(
        `/user/vesting/summary-all?wallet=${wallet}`,
        {
          timeout: 30000,
          retries: 3,
          retryDelay: 1000,
          cacheKey: `vesting-summary-${wallet}`,
          cacheDuration: 1 * 60 * 1000, // 1 minute
        }
      );
      setSummary(response);
      setLastUpdated(new Date());
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (!error.message.includes('404')) {
        setError(error);
        setRetryCount(0);
      }
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  const loadHistory = useCallback(async () => {
    if (!wallet) {
      setHistory([]);
      return;
    }

    try {
      const response = await apiClient.get<ClaimHistoryItem[]>(
        `/user/vesting/claim-history?wallet=${wallet}`,
        {
          timeout: 30000,
          retries: 3,
          retryDelay: 1000,
          cacheKey: `claim-history-${wallet}`,
          cacheDuration: 1 * 60 * 1000, // 1 minute
        }
      );
      setHistory(response ?? []);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (!error.message.includes('404')) {
        setError(error);
        setRetryCount(0);
      }
      setHistory([]);
    }
  }, [wallet]);

  const loadHistoryWithTimestamp = useCallback(async () => {
    await loadHistory();
    setLastUpdated(new Date());
  }, [loadHistory]);

  useEffect(() => {
    void loadSummary();
    void loadHistoryWithTimestamp();

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadHistory();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [loadSummary, loadHistory, loadHistoryWithTimestamp]);

  const handleWalletChange = useCallback((newWallet: string | null) => {
    // Clear cache for previous wallet
    if (wallet) {
      apiClient.clearCache(`vesting-summary-${wallet}`);
      apiClient.clearCache(`claim-history-${wallet}`);
    }
    
    setWallet(newWallet);
    setSummary(null);
    setHistory([]);
    setError(null);
    setLastUpdated(null);
    isInitialLoad.current = true;
  }, [wallet]);

  const formatNumber = (num: number) => {
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatCountdown = (seconds: number) => {
    if (seconds <= 0) return "Fully unlocked";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  };


  const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  // Helpers for breakdown UI
  const poolStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return { text: "Active", cls: "bg-green-500/15 text-green-400 border-green-500/30" };
      case "paused":
        return { text: "Paused", cls: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" };
      case "cancelled":
        return { text: "Cancelled", cls: "bg-red-500/15 text-red-400 border-red-500/30" };
      case "fully_vested":
        return { text: "Fully Vested", cls: "bg-purple-500/15 text-purple-300 border-purple-500/30" };
      default:
        return { text: status, cls: "bg-white/10 text-white/80 border-white/20" };
    }
  };

  const poolProgressPct = (p: Pool) => {
    const total = (p.claimable ?? 0) + (p.locked ?? 0) + (p.claimed ?? 0);
    if (total <= 0) return 0;
    return ((p.claimed + p.claimable) / total) * 100;
  };

  // Skeleton loader component
  const SkeletonLoader = ({ height = "h-12" }: { height?: string }) => (
    <div className={`${height} animate-pulse rounded-lg bg-white/10`} />
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col bg-gradient-to-b from-[#0c0b25] via-[#0c0b25] to-[#08071a] px-4 py-8 text-white">
      {/* Success Toast */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-top-5 fade-in">
          <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4 shadow-lg backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/20">
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-green-400">{successToast.message}</p>
                <a 
                  href={`https://solscan.io/tx/${successToast.signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 text-xs text-green-400/80 hover:text-green-400 underline"
                >
                  View transaction →
                </a>
              </div>
              <button
                onClick={() => setSuccessToast(null)}
                className="shrink-0 text-white/60 hover:text-white transition-colors"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image 
              src="/WhatsApp Image 2025-10-04 at 12.46.50 PM.jpeg" 
              alt="Lil Gargs" 
              width={48}
              height={48}
              className="h-12 w-12 rounded-full border-2 border-purple-500/50"
            />
            <h1 className="text-2xl font-bold">Lil Gargs Vesting</h1>
          </div>
          <div className="flex items-center gap-2">
            {wallet && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    void loadSummary();
                    void loadHistoryWithTimestamp();
                  }}
                  disabled={loading}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <span className="text-xs text-white/40">Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}</span>
              </div>
            )}
            <WalletConnectButton onWalletChange={handleWalletChange} />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6">
          <RetryPrompt
            error={error}
            retrying={loading}
            retryCount={retryCount}
            onRetry={() => {
              setRetryCount(prev => prev + 1);
              void loadSummary();
              void loadHistory();
            }}
            onDismiss={() => setError(null)}
          />
        </div>
      )}

      {/* No Wallet Connected */}
      {!wallet && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
          <p>Connect your wallet to view your vesting rewards</p>
        </div>
      )}

      {/* No Pools */}
      {wallet && !loading && summary && (!summary.pools || summary.pools.length === 0) && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
          <p>No active vesting pools found for this wallet.</p>
        </div>
      )}

      {/* Loading State */}
      {wallet && loading && !summary && (
        <div className="space-y-6">
          <SkeletonLoader height="h-40" />
          <SkeletonLoader height="h-32" />
          <SkeletonLoader height="h-32" />
        </div>
      )}

      {/* Main Content */}
      {wallet && summary && summary.pools && summary.pools.length > 0 && (
        <div className="space-y-6">
          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-white/10">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "overview"
                  ? "border-b-2 border-purple-500 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "history"
                  ? "border-b-2 border-purple-500 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              History
            </button>
          </div>

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {loading ? (
                <>
                  <SkeletonLoader height="h-40" />
                  <SkeletonLoader height="h-40" />
                </>
              ) : (
                <>
                  {/* Total Claimable Card */}
                  <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-6">
                    <div className="flex items-center gap-6 flex-row">
                      {/* Progress */}
                      <div className="flex-shrink-0">
                        <CircularProgress
                          percentage={summary.vestedPercentage}
                          label="Unlocked"
                          size={140}
                          strokeWidth={10}
                        />
                      </div>

                      {/* Amount + Button */}
                      <div className="flex-1 text-left">
                        <p className="text-sm text-white/60 mb-2">Total Claimable</p>
                        <p className="text-4xl font-bold text-white mb-4">{formatNumber(summary.totalClaimable)} $GARG</p>
                        <button
                          onClick={() => setShowClaimModal(true)}
                          className="rounded-lg bg-purple-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
                          disabled={summary.totalClaimable <= 0}
                        >
                          Claim Rewards
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-white/60">Total Locked</span>
                      <span className="font-semibold">{formatNumber(summary.totalLocked)} $GARG</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/60">Total Claimed</span>
                      <span className="font-semibold">{formatNumber(summary.totalClaimed)} $GARG</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/60">Vested</span>
                      <span className="font-semibold">{summary.vestedPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/60">Time to Full Unlock</span>
                      <span className="font-semibold">{formatCountdown(summary.nextUnlockTime - Math.floor(Date.now() / 1000))}</span>
                    </div>
                    {/* Breakdown Toggle */}
                    <button
                      onClick={() => setShowBreakdown((v) => !v)}
                      className="mt-2 flex items-center gap-2 text-sm text-purple-300 hover:text-purple-200"
                    >
                      <span>{showBreakdown ? "Hide Breakdown" : "View Breakdown"}</span>
                      <svg className={`h-4 w-4 transition-transform ${showBreakdown ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                      </svg>
                    </button>
                    {showBreakdown && summary.pools && (
                      <div className="mt-3 space-y-2">
                        {summary.pools
                          .filter((p) => p.status === 'active' || p.claimable > 0 || p.status === 'paused' || p.status === 'cancelled')
                          .map((pool) => {
                            // derive status
                            const isFullyVested = (pool.locked ?? 0) <= 0 && ((pool.claimed ?? 0) + (pool.claimable ?? 0)) > 0;
                            const derivedStatus = isFullyVested ? 'fully_vested' : pool.status === 'active' ? 'active' : pool.status;
                            const badge = poolStatusBadge(derivedStatus);
                            const progress = poolProgressPct(pool);
                            const isClaimable = pool.status === 'active' && pool.claimable > 0;
                            const awaiting = isClaimable && !isFullyVested;
                            const isDisabled = pool.status === 'paused' || pool.status === 'cancelled';
                            return (
                              <div key={pool.poolId} className={`flex items-center justify-between rounded-xl border p-3 text-sm ${isDisabled ? 'border-white/5 bg-white/2 opacity-60' : 'border-white/10 bg-white/5'}`}>
                                {/* Left pill with pool name and claimable */}
                                <div className="flex items-start gap-3">
                                  <div className={`px-3 py-2 rounded-lg border ${badge.cls}`}>
                                    <div className="text-xs font-semibold">{badge.text}</div>
                                  </div>
                                  <div>
                                    <p className="font-semibold text-white">{pool.poolName}</p>
                                    <p className="text-xs text-white/60">Claimable: <span className={`font-semibold ${isDisabled ? 'text-white/40' : 'text-white'}`}>{formatNumber(pool.claimable)} GARG</span></p>
                                    {isDisabled && <p className="text-xs text-yellow-400/70 mt-1">Cannot claim from {pool.status} pool</p>}
                                  </div>
                                </div>

                                {/* Right column: status + progress */}
                                <div className="text-right">
                                  <p className="text-white font-semibold">{awaiting ? 'Awaiting Claim' : badge.text}</p>
                                  <div className="text-xs text-white/60">Progress: {progress.toFixed(0)}%</div>
                                  {derivedStatus === 'active' && !isDisabled && (
                                    <div className="text-xs text-white/50">Time to Unlock: {formatCountdown(Math.max(0, summary.nextUnlockTime - Math.floor(Date.now()/1000)))}</div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        <p className="text-xs text-white/40">Only active pools contribute to your claimable balance. Paused and cancelled pools are shown for reference.</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}


          {/* History Tab */}
          {activeTab === "history" && (
            <div className="space-y-4">
              {loading ? (
                <>
                  <SkeletonLoader height="h-24" />
                  <SkeletonLoader height="h-24" />
                  <SkeletonLoader height="h-24" />
                </>
              ) : (
                <>
                  {/* Past Vesting Pools */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-white/80">Past Vesting Pools</h3>
                    {(() => {
                      const completed = (summary.pools ?? []).filter((p) => (p.locked ?? 0) <= 0 && (p.claimed ?? 0) > 0);
                      if (completed.length === 0) {
                        return (
                          <p className="text-xs text-white/50">No completed pools yet.</p>
                        );
                      }
                      return completed.map((p) => (
                        <div key={p.poolId} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-white">{p.poolName}</p>
                              <p className="text-xs text-white/60 mt-1">Claimed: <span className="text-white font-semibold">{formatNumber(p.claimed)} $GARG</span></p>
                            </div>
                            <div className="flex items-center gap-2 text-green-400">
                              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                              <span className="text-sm font-semibold">Completed</span>
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>

                  {/* Claim Transactions */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-white/80">Claim Transactions</h3>
                    {history.length === 0 ? (
                      <p className="text-xs text-white/50">No claim transactions yet.</p>
                    ) : (
                      history.map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
                          <div className="text-white font-semibold">+{formatNumber(item.amount)} $GARG</div>
                          <div className="text-right">
                            <div className="text-xs text-white/60">{formatDateTime(item.date)}</div>
                            <a
                              href={`https://solscan.io/tx/${item.transactionSignature}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-purple-400 hover:text-purple-300"
                            >
                              View Tx →
                            </a>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Claim Modal */}
      {showClaimModal && summary && (
        <ClaimModal
          summary={summary}
          onClose={() => {
            setShowClaimModal(false);
            // Clear any existing error when closing the modal
            // The error will be cleared in the ClaimModal component when it mounts
          }}
          onSuccess={(message, signature) => {
            setSuccessToast({ message, signature });
            // Clear cache after successful claim
            apiClient.clearCache(`vesting-summary-${wallet}`);
            apiClient.clearCache(`claim-history-${wallet}`);
            void loadSummary();
            void loadHistoryWithTimestamp();
            setShowClaimModal(false);
          }}
          wallet={wallet || ""}
          connection={connection}
        />
      )}
    </div>
  );
}

interface ClaimModalProps {
  summary: SummaryData;
  onClose: () => void;
  onSuccess: (message: string, signature: string) => void;
  wallet: string;
  connection: Connection;
}

function ClaimModal({ summary, onClose, onSuccess, wallet }: ClaimModalProps) {
  const [amount, setAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [claimStep, setClaimStep] = useState<"input" | "processing" | "confirming">("input");
  const [error, setError] = useState<string | null>(null);

  // Clear error when component mounts
  useEffect(() => {
    setError(null);
  }, []);

  const handleQuickAmount = (percentage: number) => {
    const value = (summary.totalClaimable * percentage) / 100;
    setAmount(value.toFixed(2));
  };

  const handleClaim = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    const claimAmount = parseFloat(amount);
    if (claimAmount > summary.totalClaimable) {
      setError(`Amount exceeds available balance of ${summary.totalClaimable.toFixed(2)}`);
      return;
    }

    // Clear cache before making the claim to ensure we have fresh data
    apiClient.clearCache(`vesting-summary-${wallet}`);
    apiClient.clearCache(`claim-history-${wallet}`);

    setLoading(true);
    setError(null);
    setClaimStep("processing");

    try {
      setClaimStep("processing");
      const response = await apiClient.post<{
        totalAmountClaimed: number;
        poolBreakdown: Array<{ poolId: string; poolName: string; amountToClaim: number }>;
        transactionSignature: string;
      }>("/user/vesting/claim-all", {
        userWallet: wallet,
        amountToClaim: claimAmount,
      }, {
        timeout: 30000, // Reduced from 60s for faster feedback
        retries: 1, // Reduced from 3 for faster failure detection
        retryDelay: 500, // Reduced from 1000ms
      });

      // Skip confirming step and go straight to success for faster UX
      onSuccess(
        `Successfully claimed ${claimAmount.toLocaleString()} $GARG`,
        response.transactionSignature
      );
    } catch (err) {
      if (err instanceof Error) {
        // Check if this is a specific available balance error from the backend
        if (err.message.includes('exceeds available balance')) {
          setError(err.message);
        } else {
          setError(`Failed to claim rewards: ${err.message}`);
        }
      } else {
        setError("Failed to claim rewards");
      }
      setClaimStep("input");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0b25] p-6 space-y-4">
        {/* Processing State */}
        {claimStep === "processing" && (
          <>
            <div className="flex items-center justify-center py-8">
              <div className="relative h-16 w-16">
                <div className="absolute inset-0 rounded-full border-4 border-white/10" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" />
              </div>
            </div>
            <p className="text-center text-white font-semibold">Processing Claim...</p>
            <p className="text-center text-sm text-white/60">Sending transaction to blockchain</p>
          </>
        )}

        {/* Confirming State */}
        {claimStep === "confirming" && (
          <>
            <div className="flex items-center justify-center py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                <svg className="h-8 w-8 text-green-400 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <p className="text-center text-white font-semibold">Confirming Transaction...</p>
            <p className="text-center text-sm text-white/60">Waiting for blockchain confirmation</p>
          </>
        )}

        {/* Input State */}
        {claimStep === "input" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Claim Rewards</h2>
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white transition-colors"
              >
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-white/60">Available to Claim</p>
              <p className="text-2xl font-bold text-white">{summary.totalClaimable.toFixed(2)} $GARG</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/60">Enter Amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleQuickAmount(100)}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
              >
                Max
              </button>
              <button
                onClick={() => handleQuickAmount(50)}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
              >
                50%
              </button>
              <button
                onClick={() => handleQuickAmount(25)}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
              >
                25%
              </button>
            </div>


            {/* Removed per redesign: no breakdown needed in the withdrawal modal */}

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex-1">{error}</span>
                  {error.includes('exceeds available balance') && (
                    <button 
                      onClick={() => {
                        setError(null);
                        // Refresh the summary data
                        window.dispatchEvent(new CustomEvent('refresh-summary'));
                      }}
                      className="text-xs underline hover:text-red-300 whitespace-nowrap"
                    >
                      Refresh balance
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleClaim}
                disabled={loading || !amount || parseFloat(amount) <= 0}
                className="flex-1 rounded-lg bg-purple-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? "Processing..." : "Claim"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
