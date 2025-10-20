"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, Transaction } from "@solana/web3.js";
import { VestingRewardsCard, VestingSummary, ClaimHistoryItem } from "./VestingRewardsCard";
import { WalletConnectButton } from "./WalletConnectButton";
import { api } from "@/lib/api";

interface VestingPool {
  id: string;
  poolId: string;
  poolName: string;
  vestingMode: string;
  tokenAmount: number;
  nftCount: number;
  streamflowId: string | null;
  createdAt: string;
}

export function VestingRewardsPage() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [pools, setPools] = useState<VestingPool[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Map<string, VestingSummary>>(new Map());
  const [history, setHistory] = useState<ClaimHistoryItem[]>([]);
  const [loadingPools, setLoadingPools] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [claimLoading, setClaimLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<{ message: string; signature: string } | null>(null);
  const isInitialLoad = useRef(true);

  const loadPools = useCallback(async () => {
    if (!wallet) {
      setPools([]);
      setSummaries(new Map());
      return;
    }
    
    setLoadingPools(true);
    setError(null);
    
    try {
      // Get list of all pools for this wallet
      const poolsResponse = await api.get<{ success: boolean; vestings: VestingPool[] }>(
        `/user/vesting/list?wallet=${wallet}`
      );
      
      const userPools = poolsResponse.vestings ?? [];
      setPools(userPools);
      
      // Auto-select first pool ONLY on initial load
      if (userPools.length > 0 && isInitialLoad.current) {
        setSelectedPoolId(userPools[0].poolId);
        isInitialLoad.current = false;
      }
      
      // Load summary for each pool
      const newSummaries = new Map<string, VestingSummary>();
      for (const pool of userPools) {
        try {
          const summaryResponse = await api.get<{ success: boolean; data: VestingSummary }>(
            `/user/vesting/summary?wallet=${wallet}&poolId=${pool.poolId}`
          );
          if (summaryResponse.data) {
            newSummaries.set(pool.poolId, summaryResponse.data);
          }
        } catch (err) {
          console.error(`Failed to load summary for pool ${pool.poolName}:`, err);
          // Don't show error to user - just skip this pool's summary
        }
      }
      setSummaries(newSummaries);
    } catch (err) {
      // No pools (404) is normal for new users - don't show as error
      const errorMessage = err instanceof Error ? err.message : '';
      if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
        setPools([]);
        setSummaries(new Map());
        // Don't set error - this is a normal state
      } else {
        // Only show error for actual failures
        setPools([]);
        setSummaries(new Map());
        setError(err instanceof Error ? err.message : "Failed to load pools");
      }
    } finally {
      setLoadingPools(false);
    }
  }, [wallet]);

  const loadHistory = useCallback(async () => {
    if (!wallet) {
      setHistory([]);
      return;
    }
    
    setLoadingHistory(true);
    // Don't clear error here - only clear on actual errors, not empty history
    
    try {
      const response = await api.get<{ success: boolean; data: ClaimHistoryItem[] }>(
        `/user/vesting/history?wallet=${wallet}`
      );
      setHistory(response.data ?? []);
    } catch (err) {
      // Empty history (404) is normal - don't show as error
      const errorMessage = err instanceof Error ? err.message : '';
      if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
        setHistory([]); // Just set empty history, no error
      } else {
        // Only show error for actual failures (network, server errors, etc.)
        setHistory([]);
        setError(err instanceof Error ? err.message : "Failed to load history");
      }
    } finally {
      setLoadingHistory(false);
    }
  }, [wallet]);

  useEffect(() => {
    // Initial load
    void loadPools();
    void loadHistory();
    
    // Optimized polling: Only refresh history periodically
    // Vesting amounts are calculated client-side in VestingRewardsCard
    const interval = setInterval(() => {
      // Only poll when tab is visible to save resources
      if (document.visibilityState === 'visible') {
        void loadHistory(); // Only history, not pools (vesting is calculated client-side)
      }
    }, 60000); // 1 minute - reduced from 5 seconds (12x fewer API calls)
    
    return () => clearInterval(interval);
  }, [loadPools, loadHistory]);

  const { sendTransaction } = useWallet();
  const connection = useMemo(
    () => new Connection('https://mainnet.helius-rpc.com/?api-key=17f39a5b-e46f-42f7-a4e3-3ece44a6426a'),
    []
  );

  const handleClaim = useCallback(async (poolId?: string) => {
    if (!wallet) {
      setError("Connect a wallet to claim rewards.");
      return;
    }

    if (!sendTransaction) {
      setError("Wallet does not support transactions.");
      return;
    }

    try {
      setClaimLoading(poolId || null);
      setError(null);

      // Step 1: Get claim details and fee transaction from backend
      const claimResponse = await api.post<{
        success: boolean;
        step: string;
        feeTransaction: string;
        feeDetails: {
          amountUsd: number;
          amountSol: number;
          feeWallet: string;
        };
        claimDetails: {
          amountClaimable: number;
        };
      }>("/user/vesting/claim", {
        userWallet: wallet,
        poolId,
      });

      if (!claimResponse.success || claimResponse.step !== 'fee_payment_required') {
        throw new Error('Unexpected response from server');
      }

      // Step 2: User pays fee (deserialize and send fee transaction)
      const feeTransactionBuffer = Buffer.from(claimResponse.feeTransaction, 'base64');
      const feeTransaction = Transaction.from(feeTransactionBuffer);
      
      console.log('[CLAIM] Sending fee transaction...');
      let feeSignature: string;
      try {
        feeSignature = await sendTransaction(feeTransaction, connection);
        console.log('[CLAIM] Fee transaction sent:', feeSignature);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        
        // Check for insufficient balance error
        if (errorMessage.includes('Insufficient SOL balance') || 
            errorMessage.includes('insufficient funds') ||
            errorMessage.includes('Attempt to debit an account but found no record')) {
          throw new Error(
            `❌ Insufficient SOL Balance\n\n` +
            `You need ${claimResponse.feeDetails.amountSol.toFixed(4)} SOL to pay the claim fee.\n\n` +
            `Please add SOL to your wallet and try again.`
          );
        }
        
        throw new Error(`Failed to send fee transaction: ${errorMessage}`);
      }
      
      // Wait for fee confirmation with timeout
      console.log('[CLAIM] Confirming fee transaction...');
      try {
        await Promise.race([
          connection.confirmTransaction(feeSignature, 'confirmed'),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Fee transaction confirmation timeout (60s)')), 60000)
          )
        ]);
        console.log('[CLAIM] Fee transaction confirmed');
      } catch (err) {
        throw new Error(`Fee transaction failed to confirm: ${err instanceof Error ? err.message : 'Unknown error'}. Your fee may have been charged. Please contact support with signature: ${feeSignature}`);
      }

      // Step 3: Complete claim (backend transfers tokens) with retry
      console.log('[CLAIM] Completing claim on backend...');
      let completeResponse;
      const maxRetries = 3;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          completeResponse = await api.post<{
            success: boolean;
            data: {
              amountClaimed: number;
              tokenTransactionSignature: string;
            };
          }>("/user/vesting/complete-claim", {
            userWallet: wallet,
            feeSignature: feeSignature,
            poolId,
          });

          if (!completeResponse.success) {
            throw new Error('Backend returned unsuccessful response');
          }
          
          console.log('[CLAIM] Claim completed successfully');
          break; // Success
          
        } catch (err) {
          console.error(`[CLAIM] Complete claim attempt ${attempt}/${maxRetries} failed:`, err);
          
          if (attempt === maxRetries) {
            throw new Error(`Failed to complete claim after ${maxRetries} attempts. Your fee was charged (${feeSignature}). Please contact support to complete your claim.`);
          }
          
          // Wait before retry (exponential backoff)
          const waitTime = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
          console.log(`[CLAIM] Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      if (!completeResponse) {
        throw new Error('Failed to complete claim');
      }

      // Refresh data after successful claim
      await Promise.all([loadPools(), loadHistory()]);
      
      // Show success toast
      setError(null);
      setSuccessToast({
        message: `Successfully claimed ${completeResponse.data.amountClaimed.toLocaleString()} $GARG`,
        signature: completeResponse.data.tokenTransactionSignature
      });
      
      // Auto-dismiss after 10 seconds
      setTimeout(() => setSuccessToast(null), 10000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process claim");
    } finally {
      setClaimLoading(null);
    }
  }, [wallet, sendTransaction, connection, loadPools, loadHistory]);

  const handleWalletChange = useCallback((newWallet: string | null) => {
    setWallet(newWallet);
    setPools([]);
    setSelectedPoolId(null);
    setSummaries(new Map());
    setHistory([]);
    setError(null);
    isInitialLoad.current = true; // Reset on wallet change
  }, []);

  const header = (
    <div className="mb-8 space-y-6">
      {/* Logo Header */}
      <div className="flex items-center justify-center gap-4">
        <Image 
          src="/WhatsApp Image 2025-10-04 at 12.46.50 PM.jpeg" 
          alt="Lil Gargs" 
          width={64}
          height={64}
          className="h-16 w-16 rounded-full border-2 border-purple-500/50 shadow-lg shadow-purple-500/20"
        />
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Lil Gargs Vesting</h1>
          <p className="text-sm text-white/60">Earn $GARG based on your NFT holdings</p>
        </div>
      </div>
      
      {/* Wallet & Title */}
      <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-[0.45em] text-white/50">Vesting Rewards</p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Claim your rewards automatically over time
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {wallet && (
            <button
              onClick={() => {
                void loadPools();
                void loadHistory();
              }}
              disabled={loadingPools || loadingHistory}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 disabled:opacity-50"
              title="Refresh data"
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
  );

  const footer = (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-xs text-white/40">
      <p>
        This dashboard is a prototype. Signature-based claiming will replace the test key
        requirement in production. Connect your Phantom wallet to view your vesting rewards.
      </p>
    </div>
  );

  const selectedPool = pools.find(p => p.poolId === selectedPoolId);
  const selectedSummary = selectedPoolId ? (summaries.get(selectedPoolId) ?? null) : null;
  const selectedHistory = selectedPool ? history.filter(h => h.vestingId === selectedPool.id) : [];
  
  // Check if pool is fully claimed (only if vesting has ended)
  /* const isFullyClaimed = selectedSummary ? 
    selectedSummary.balances.totalClaimed >= selectedSummary.userShare.totalEligible &&
    selectedSummary.vestingSchedule && 
    Date.now() / 1000 >= selectedSummary.vestingSchedule.endTime : false; */

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col bg-gradient-to-b from-[#0c0b25] via-[#0c0b25] to-[#08071a] px-4 py-12 text-white">
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
      
      {header}
      
      {pools.length === 0 && !loadingPools && wallet && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
          <p>No active vesting pools found for this wallet.</p>
        </div>
      )}
      
      {pools.length > 0 && (
        <div className="space-y-6">
          {/* Pool Selector */}
          {pools.length > 1 && (
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Available Vesting Pools</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {pools.map((pool) => {
                  const poolSummary = summaries.get(pool.poolId);
                  const isPoolFullyClaimed = poolSummary ? 
                    poolSummary.balances.totalClaimed >= poolSummary.userShare.totalEligible &&
                    poolSummary.vestingSchedule && 
                    Date.now() / 1000 >= poolSummary.vestingSchedule.endTime : false;
                  const isSelected = pool.poolId === selectedPoolId;
                  
                  return (
                    <button
                      key={pool.poolId}
                      onClick={() => setSelectedPoolId(pool.poolId)}
                      className={`relative rounded-2xl border p-4 text-left transition-all ${
                        isSelected
                          ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20'
                          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                      } ${isPoolFullyClaimed ? 'opacity-60' : ''}`}
                    >
                      {isPoolFullyClaimed && (
                        <div className="absolute -top-2 right-3 rounded-full bg-green-500 px-2 py-0.5 text-xs font-semibold text-white">
                          ✓ Fully Claimed
                        </div>
                      )}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-white">{pool.poolName}</p>
                          <p className="mt-1 text-xs text-white/50">
                            {pool.vestingMode === 'dynamic' ? '🔄 Dynamic' : '📸 Snapshot'}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-purple-500">
                            <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                      {poolSummary && (
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className="text-white/60">Claimable</span>
                          <span className="font-semibold text-white">
                            {poolSummary.balances.unlocked.toLocaleString()} $GARG
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Selected Pool Card */}
          {selectedPool && (
            <VestingRewardsCard
              wallet={wallet ?? ""}
              poolId={selectedPool.poolId}
              summary={selectedSummary}
              history={selectedHistory}
              loadingSummary={loadingPools}
              loadingHistory={loadingHistory}
              claimLoading={claimLoading === selectedPool.poolId}
              error={error}
              onClaim={handleClaim}
              footer={null}
            />
          )}
        </div>
      )}
      
      <div className="mt-8">{footer}</div>
    </div>
  );
}
