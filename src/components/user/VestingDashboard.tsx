"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { Connection } from "@solana/web3.js";
import { WalletConnectButton } from "./WalletConnectButton";
import { apiClient } from "@/lib/apiClient";
import { CircularProgress } from "@/components/ui/CircularProgress";
import { RetryPrompt } from "@/components/ui/RetryPrompt";
import { useClaimWithFee } from "@/hooks/useClaimWithFee";
import { DEMO_WALLET, DEMO_SUMMARY, DEMO_HISTORY } from "@/lib/demoData";

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
  
  // Demo mode state
  const [demoMode, setDemoMode] = useState(false);
  
  // Animated percentage counter
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  
  // Live countdown timer
  const [liveCountdown, setLiveCountdown] = useState(0);

  const connection = useMemo(
    () => new Connection('https://mainnet.helius-rpc.com/?api-key=17f39a5b-e46f-42f7-a4e3-3ece44a6426a'),
    []
  );
  const loadSummary = useCallback(async () => {
    if (!wallet) {
      setSummary(null);
      return;
    }

    // If demo mode, load demo data immediately
    if (demoMode) {
      setLoading(true);
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      setSummary(DEMO_SUMMARY);
      setLoading(false);
      setLastUpdated(new Date());
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<SummaryData>(
        `/user/vesting/summary-all?wallet=${wallet}`,
        {
          timeout: 30000,
          retries: 1,
          retryDelay: 1000,
          cache: 'no-store', // Disable caching to prevent stale data
        }
      );
      setSummary(response);
      setLastUpdated(new Date());
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (!error.message.includes('404')) {
        setError(error);
      }
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [wallet, demoMode]);

  const loadHistory = useCallback(async () => {
    if (!wallet) {
      setHistory([]);
      return;
    }

    // If demo mode, load demo history
    if (demoMode) {
      setHistory(DEMO_HISTORY);
      return;
    }

    try {
      const response = await apiClient.get<ClaimHistoryItem[]>(
        `/user/vesting/claim-history?wallet=${wallet}`,
        {
          timeout: 30000,
          retries: 1,
          retryDelay: 1000,
          cache: 'no-store', // Disable caching to prevent stale data
        }
      );
      setHistory(response ?? []);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (!error.message.includes('404')) {
        setError(error);
        console.error('[HISTORY] Error loading claim history:', err);
      }
    }
  }, [wallet, demoMode]);

  const loadHistoryWithTimestamp = useCallback(async () => {
    await loadHistory();
    setLastUpdated(new Date());
  }, [loadHistory]);

  // Add event listener for refresh-summary event
  useEffect(() => {
    const handleRefreshSummary = () => {
      void loadSummary();
    };

    window.addEventListener('refresh-summary', handleRefreshSummary);
    return () => {
      window.removeEventListener('refresh-summary', handleRefreshSummary);
    };
  }, [loadSummary, wallet]);

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
    setWallet(newWallet);
    setSummary(null);
    setHistory([]);
    setError(null);
    setLastUpdated(null);
    isInitialLoad.current = true;
    setDemoMode(false); // Exit demo mode when wallet changes
  }, []);

  const toggleDemoMode = useCallback(() => {
    const newDemoMode = !demoMode;
    setDemoMode(newDemoMode);
    
    if (newDemoMode) {
      // Enter demo mode
      setWallet(DEMO_WALLET);
      setSummary(null);
      setHistory([]);
      setError(null);
    } else {
      // Exit demo mode
      setWallet(null);
      setSummary(null);
      setHistory([]);
      setError(null);
    }
  }, [demoMode]);

  const formatNumber = (num: number) => {
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatCountdown = (seconds: number) => {
    if (seconds <= 0) return "Fully unlocked";
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    // Show different formats based on time remaining
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };


  // Animate percentage counter when summary changes
  useEffect(() => {
    if (!summary) return;
    const target = summary.vestedPercentage;
    const duration = 1500; // 1.5 seconds
    const steps = 60; // 60 frames for smooth animation
    const increment = target / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setAnimatedPercentage(target);
        clearInterval(timer);
      } else {
        setAnimatedPercentage(current);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [summary]);
  
  // Initialize and update live countdown
  useEffect(() => {
    if (!summary) return;
    setLiveCountdown(summary.nextUnlockTime - Math.floor(Date.now() / 1000));
  }, [summary]);
  
  // Tick countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

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
        {/* Top row: Logo + Title on left, Wallet on right */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Image 
              src="/WhatsApp Image 2025-10-04 at 12.46.50 PM.jpeg" 
              alt="Lil Gargs" 
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-full border-2 border-purple-500/50"
            />
            <h1 className="text-xl sm:text-2xl font-bold truncate">Lil Gargs Vesting</h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Demo Mode Toggle */}
            <button
              onClick={toggleDemoMode}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                demoMode
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 hover:bg-yellow-500/30'
                  : 'bg-purple-500/20 text-purple-300 border border-purple-500/50 hover:bg-purple-500/30'
              }`}
            >
              {demoMode ? '✨ Exit Demo' : '👁️ View Demo'}
            </button>
            <WalletConnectButton onWalletChange={handleWalletChange} />
          </div>
        </div>

        {/* Demo Mode Banner */}
        {demoMode && (
          <div className="rounded-xl border-2 border-yellow-500/50 bg-yellow-500/10 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-yellow-300 mb-1">Demo Mode Active</h3>
                <p className="text-xs text-yellow-200/80">
                  You&apos;re viewing sample data. No wallet connection required. Claims are simulated and won&apos;t execute real transactions.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Bottom row: Last updated + Refresh button */}
        {wallet && !demoMode && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className="text-xs text-white/40">Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}</span>
            <button
              onClick={() => {
                void loadSummary();
                void loadHistoryWithTimestamp();
              }}
              disabled={loading}
              className="w-full sm:w-auto rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 disabled:opacity-50 flex items-center justify-center gap-2"
              title="Refresh data"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        )}
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
                          percentage={animatedPercentage}
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
                      <span className="font-semibold">{animatedPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/60">Time to Full Unlock</span>
                      <span className="font-semibold">{formatCountdown(liveCountdown)}</span>
                    </div>
                    {/* Breakdown Toggle */}
                    {summary.totalClaimable > 0 && (
                      <button
                        onClick={() => setShowBreakdown((v) => !v)}
                        className="mt-2 flex items-center gap-2 text-sm text-purple-300 hover:text-purple-200"
                      >
                        <span>{showBreakdown ? "Hide Breakdown" : "View Breakdown"}</span>
                        <svg className={`h-4 w-4 transition-transform ${showBreakdown ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                    {summary.totalClaimable > 0 && showBreakdown && summary.pools && (
                      <div className="mt-3 space-y-2">
                        {summary.pools
                          .filter((p) => p.claimable > 0.001) // Use a threshold to filter out dust amounts
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
                        <div key={item.id} className="rounded-2xl bg-white/5 border border-white/10 p-4 hover:bg-white/8 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20">
                                  <svg className="h-3.5 w-3.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                                <span className="text-xs font-semibold text-green-400">Claimed</span>
                              </div>
                              <p className="text-lg font-bold text-white mb-1">+{formatNumber(item.amount)} $GARG</p>
                              <p className="text-xs text-white/60">{item.poolName}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-white/60 mb-2">{formatDateTime(item.date)}</div>
                              <a
                                href={`https://solscan.io/tx/${item.transactionSignature}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2 py-1 text-xs text-purple-400 hover:bg-purple-500/20 transition-colors"
                              >
                                View Tx
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4m-4-4l4-4m0 0l-4 4m4-4v12" />
                                </svg>
                              </a>
                            </div>
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
            // Clear cache after successful claim (skip in demo mode)
            if (!demoMode) {
              apiClient.clearCache(`vesting-summary-${wallet}`);
              apiClient.clearCache(`claim-history-${wallet}`);
            }
            void loadSummary();
            void loadHistoryWithTimestamp();
            setShowClaimModal(false);
          }}
          wallet={wallet || ""}
          connection={connection}
          demoMode={demoMode}
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
  demoMode?: boolean;
}

function ClaimModal({ summary, onClose, onSuccess, demoMode }: ClaimModalProps) {
  const [amount, setAmount] = useState<string>("");
  const [claimStep, setClaimStep] = useState<"input" | "signing" | "processing">("input");
  const [error, setError] = useState<string | null>(null);
  const { executeClaim, loading, status, progress } = useClaimWithFee();

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
    
    // Minimum claim amount validation (matches backend)
    const MIN_CLAIM_AMOUNT = 0.001;
    if (claimAmount < MIN_CLAIM_AMOUNT) {
      setError(`Minimum claim amount is ${MIN_CLAIM_AMOUNT} tokens`);
      return;
    }
    
    if (claimAmount > summary.totalClaimable) {
      setError(`Amount exceeds available balance of ${summary.totalClaimable.toFixed(2)}`);
      return;
    }

    setError(null);
    setClaimStep("signing");

    // Demo mode: simulate claim without real transaction
    if (demoMode) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate delay
      onSuccess(
        `Demo: Successfully claimed ${claimAmount.toLocaleString()} $GARG`,
        'DemoTxSignature...123abc'
      );
      return;
    }

    try {
      // Execute the full claim flow: prepare -> sign -> submit
      const result = await executeClaim(claimAmount);
      
      if (result) {
        onSuccess(
          `Successfully claimed ${result.totalAmountClaimed.toLocaleString()} $GARG`,
          result.tokenTransactionSignature
        );
      } else {
        setError("Transaction failed. Please try again.");
        setClaimStep("input");
      }
    } catch (err) {
      let errorMessage = "Something went wrong. Please try again.";
      
      if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        
        // User cancelled/rejected transaction
        if (msg.includes('user rejected') || msg.includes('user cancelled') || msg.includes('user denied')) {
          errorMessage = "You cancelled the transaction. No tokens were claimed.";
        }
        // Insufficient funds for fee
        else if (msg.includes('insufficient funds') || msg.includes('insufficient lamports') || msg.includes('not enough sol')) {
          errorMessage = "Insufficient SOL for transaction fee. Please add SOL to your wallet.";
        }
        // Exceeds available balance
        else if (msg.includes('exceeds available balance') || msg.includes('exceeds balance')) {
          errorMessage = "Amount exceeds your available balance. Try refreshing or claiming less.";
        }
        // Network/timeout errors
        else if (msg.includes('timeout') || msg.includes('timed out')) {
          errorMessage = "Transaction timed out. It may still succeed - check your history in a moment.";
        }
        // Transaction failed on-chain
        else if (msg.includes('transaction failed') || msg.includes('failed on-chain')) {
          errorMessage = "Transaction failed on blockchain. Please try again with a smaller amount.";
        }
        // Wallet not connected
        else if (msg.includes('wallet not connected') || msg.includes('not connected')) {
          errorMessage = "Wallet disconnected. Please reconnect your wallet and try again.";
        }
        // Minimum amount error
        else if (msg.includes('minimum claim amount')) {
          errorMessage = err.message; // Use exact message from backend
        }
        // Generic error with message
        else if (err.message && err.message.length < 100) {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      setClaimStep("input");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0b25] p-6 space-y-4">
        {/* Progressive Status Display */}
        {claimStep === "signing" && (
          <>
            <div className="flex items-center justify-center py-8">
              <div className="relative h-24 w-24">
                <svg className="transform -rotate-90" width="96" height="96">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="#a855f7"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">{progress}%</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-center text-white font-semibold">
                {status === 'preparing' && 'Preparing Claim...'}
                {status === 'signing_fee' && 'Waiting for Signature...'}
                {status === 'confirming_fee' && 'Confirming Fee Payment...'}
                {status === 'processing_claim' && 'Processing Claim...'}
                {status === 'confirming_claim' && 'Confirming Transaction...'}
                {status === 'success' && 'Claim Successful!'}
              </p>
              <p className="text-center text-sm text-white/60">
                {status === 'preparing' && 'Calculating available amounts...'}
                {status === 'signing_fee' && 'Please approve the transaction in your wallet'}
                {status === 'confirming_fee' && 'Waiting for blockchain confirmation...'}
                {status === 'processing_claim' && 'Transferring tokens from treasury...'}
                {status === 'confirming_claim' && 'Verifying transaction on Solana...'}
                {status === 'success' && 'Your tokens have been claimed!'}
              </p>
            </div>
          </>
        )}

        {/* Processing State (Legacy - kept for compatibility) */}
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
              <label className="text-sm text-white/60">Enter Amount (min: 0.001)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.001"
                min="0.001"
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
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {error.includes('cancelled') ? (
                      <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    ) : error.includes('Insufficient SOL') ? (
                      <svg className="w-5 h-5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${
                      error.includes('cancelled') ? 'text-yellow-300' : 
                      error.includes('Insufficient SOL') ? 'text-orange-300' : 
                      'text-red-300'
                    }`}>
                      {error}
                    </p>
                    {error.includes('Insufficient SOL') && (
                      <p className="text-xs text-white/60 mt-1">
                        You need a small amount of SOL (~0.01) to pay for the transaction fee.
                      </p>
                    )}
                    {error.includes('exceeds available balance') && (
                      <button 
                        onClick={() => {
                          setError(null);
                          window.dispatchEvent(new CustomEvent('refresh-summary'));
                        }}
                        className="text-xs text-purple-400 hover:text-purple-300 underline mt-1"
                      >
                        Refresh balance
                      </button>
                    )}
                  </div>
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
