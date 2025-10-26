"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection } from "@solana/web3.js";
import { WalletConnectButton } from "./WalletConnectButton";
import { api } from "@/lib/api";

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
  pools: Pool[];
}

interface ClaimHistoryItem {
  id: string;
  date: string;
  amount: number;
  transactionSignature: string;
  status: string;
  poolName: string;
}

type Tab = "overview" | "pools" | "history";

export function VestingDashboard() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [history, setHistory] = useState<ClaimHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<{ message: string; signature: string } | null>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const isInitialLoad = useRef(true);

  const connection = useMemo(
    () => new Connection('https://mainnet.helius-rpc.com/?api-key=17f39a5b-e46f-42f7-a4e3-3ece44a6426a'),
    []
  );

  const loadSummary = useCallback(async () => {
    if (!wallet) {
      setSummary(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.get<{ success: boolean; data: SummaryData }>(
        `/user/vesting/summary-all?wallet=${wallet}`
      );
      setSummary(response.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '';
      if (!errorMessage.includes('404')) {
        setError(err instanceof Error ? err.message : "Failed to load summary");
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
      const response = await api.get<{ success: boolean; data: ClaimHistoryItem[] }>(
        `/user/vesting/claim-history?wallet=${wallet}`
      );
      setHistory(response.data ?? []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '';
      if (!errorMessage.includes('404')) {
        setError(err instanceof Error ? err.message : "Failed to load history");
      }
      setHistory([]);
    }
  }, [wallet]);

  useEffect(() => {
    void loadSummary();
    void loadHistory();

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadHistory();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [loadSummary, loadHistory]);

  const handleWalletChange = useCallback((newWallet: string | null) => {
    setWallet(newWallet);
    setSummary(null);
    setHistory([]);
    setError(null);
    isInitialLoad.current = true;
  }, []);

  const formatNumber = (num: number) => {
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatCountdown = (seconds: number) => {
    if (seconds <= 0) return "Fully unlocked";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  };

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
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
              <button
                onClick={() => {
                  void loadSummary();
                  void loadHistory();
                }}
                disabled={loading}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
            <WalletConnectButton onWalletChange={handleWalletChange} />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      )}

      {/* No Wallet Connected */}
      {!wallet && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
          <p>Connect your wallet to view your vesting rewards</p>
        </div>
      )}

      {/* No Pools */}
      {wallet && !loading && summary && summary.pools.length === 0 && (
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
      {wallet && summary && summary.pools.length > 0 && (
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
              onClick={() => setActiveTab("pools")}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "pools"
                  ? "border-b-2 border-purple-500 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Pools
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
                    <p className="text-sm text-white/60 mb-2">Total Claimable</p>
                    <p className="text-4xl font-bold text-white mb-6">{formatNumber(summary.totalClaimable)} $GARG</p>
                    <button
                      onClick={() => setShowClaimModal(true)}
                      className="w-full rounded-lg bg-purple-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
                      disabled={summary.totalClaimable <= 0}
                    >
                      Claim Rewards
                    </button>
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
                  </div>
                </>
              )}
            </div>
          )}

          {/* Pools Tab */}
          {activeTab === "pools" && (
            <div className="space-y-3">
              {loading ? (
                <>
                  <SkeletonLoader height="h-32" />
                  <SkeletonLoader height="h-32" />
                  <SkeletonLoader height="h-32" />
                </>
              ) : (
                summary.pools.map((pool) => (
                  <div key={pool.poolId} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-white">{pool.poolName}</p>
                        <p className="text-xs text-white/50 mt-1">
                          {pool.status === 'active' ? '✓ Active' : pool.status === 'paused' ? '⏸ Paused' : '✗ Cancelled'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">{formatNumber(pool.claimable)} $GARG</p>
                        <p className="text-xs text-white/50">Claimable</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-white/60">Locked</p>
                        <p className="font-semibold text-white">{formatNumber(pool.locked)} $GARG</p>
                      </div>
                      <div>
                        <p className="text-white/60">Share</p>
                        <p className="font-semibold text-white">{pool.share.toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-white/60">NFTs Held</p>
                        <p className="font-semibold text-white">{pool.nftCount}</p>
                      </div>
                      <div>
                        <p className="text-white/60">Claimed</p>
                        <p className="font-semibold text-white">{formatNumber(pool.claimed)} $GARG</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === "history" && (
            <div className="space-y-3">
              {loading ? (
                <>
                  <SkeletonLoader height="h-20" />
                  <SkeletonLoader height="h-20" />
                  <SkeletonLoader height="h-20" />
                </>
              ) : history.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
                  <p>No claim history yet</p>
                </div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-white">{formatNumber(item.amount)} $GARG</p>
                        <p className="text-xs text-white/50 mt-1">{item.poolName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-white/60">{formatDate(item.date)}</p>
                        <a
                          href={`https://solscan.io/tx/${item.transactionSignature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-purple-400 hover:text-purple-300 mt-1 inline-block"
                        >
                          View Tx →
                        </a>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Claim Modal */}
      {showClaimModal && summary && (
        <ClaimModal
          summary={summary}
          onClose={() => setShowClaimModal(false)}
          onSuccess={(message, signature) => {
            setSuccessToast({ message, signature });
            void loadSummary();
            void loadHistory();
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
  const { sendTransaction } = useWallet();

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

    setLoading(true);
    setError(null);
    setClaimStep("processing");

    try {
      setClaimStep("processing");
      const response = await api.post<{
        success: boolean;
        data: {
          totalAmountClaimed: number;
          poolBreakdown: Array<{ poolId: string; poolName: string; amountToClaim: number }>;
          transactionSignature: string;
        };
      }>("/user/vesting/claim-all", {
        userWallet: wallet,
        amountToClaim: claimAmount,
      });

      if (!response.success) {
        throw new Error("Claim failed");
      }

      setClaimStep("confirming");
      
      onSuccess(
        `Successfully claimed ${claimAmount.toLocaleString()} $GARG`,
        response.data.transactionSignature
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim rewards");
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

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
              <p className="text-xs text-white/60">Pool Breakdown</p>
              {summary.pools.map((pool) => (
                <div key={pool.poolId} className="flex justify-between text-xs">
                  <span className="text-white/80">{pool.poolName}</span>
                  <span className="font-semibold text-white">
                    {amount ? ((parseFloat(amount) / summary.totalClaimable) * pool.claimable).toFixed(2) : "0.00"} $GARG
                  </span>
                </div>
              ))}
            </div>

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
