import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import { apiClient } from '../lib/apiClient';

interface ClaimInitResponse {
  success: boolean;
  step: string;
  feeTransaction: string; // base64 encoded fee payment transaction
  feeDetails: {
    amountUsd: number;
    amountSol: number;
    amountLamports: number;
    feeWallet: string;
  };
  claimDetails: {
    amountToClaim: number;
    totalAvailable: number;
    poolBreakdown: Array<{
      poolId: string;
      poolName: string;
      amountToClaim: number;
      availableFromPool: number;
      vestingId: string;
    }>;
  };
}

interface PoolBreakdownItem {
  poolId: string;
  poolName: string;
  amountToClaim: number;
  availableFromPool: number;
  vestingId: string;
}

interface ClaimResult {
  totalAmountClaimed: number;
  poolBreakdown: PoolBreakdownItem[];
  feePaid: number;
  feeTransactionSignature: string;
  tokenTransactionSignature: string;
}

export type ClaimStatus = 
  | 'idle'
  | 'preparing'
  | 'signing_fee'
  | 'confirming_fee'
  | 'processing_claim'
  | 'confirming_claim'
  | 'success'
  | 'error';

interface TransactionStatusResponse {
  success: boolean;
  status: 'pending' | 'confirmed' | 'failed';
  message: string;
  signature: string;
  confirmations?: number;
  slot?: number;
  recordedInDatabase?: boolean;
  error?: string;
}

export function useClaimWithFee() {
  const { publicKey, signTransaction, sendTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<ClaimStatus>('idle');
  const [progress, setProgress] = useState(0);

  const executeClaim = useCallback(
    async (amountToClaim?: number): Promise<ClaimResult | null> => {
      if (!publicKey || !signTransaction || !sendTransaction) {
        const error = new Error('Wallet not connected or does not support signing');
        setError(error);
        console.error('[CLAIM] Error:', error);
        return null;
      }

      setLoading(true);
      setError(null);
      setStatus('preparing');
      setProgress(10);

      try {
        console.log('[CLAIM] Step 1: Initiating claim...');
        
        // Step 1: Call /claim endpoint to get fee transaction
        const initResponse = await apiClient.post<ClaimInitResponse>(
          '/user/vesting/claim',
          {
            userWallet: publicKey.toString(),
            amountToClaim,
          }
        );

        if (!initResponse || !initResponse.feeTransaction) {
          throw new Error('Invalid response from claim endpoint');
        }

        console.log('[CLAIM] Claim initiated:', {
          amountToClaim: initResponse.claimDetails.amountToClaim,
          feeInSOL: initResponse.feeDetails.amountSol,
          feeInUSD: initResponse.feeDetails.amountUsd,
          pools: initResponse.claimDetails.poolBreakdown,
        });

        setProgress(25);
        setStatus('signing_fee');

        // Step 2: Sign and send fee payment transaction
        console.log('[CLAIM] Step 2: Signing fee payment transaction...');
        
        // Create connection using Helius RPC
        const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=17f39a5b-e46f-42f7-a4e3-3ece44a6426a';
        const connection = new Connection(rpcUrl, 'confirmed');
        
        // Deserialize the versioned transaction from the backend
        const feeTransactionBuffer = Buffer.from(initResponse.feeTransaction, 'base64');
        const feeTransaction = VersionedTransaction.deserialize(feeTransactionBuffer);
        
        console.log('[CLAIM] Fee transaction details:', {
          from: publicKey.toString(),
          to: initResponse.feeDetails.feeWallet,
          amount: `${initResponse.feeDetails.amountSol} SOL ($${initResponse.feeDetails.amountUsd})`,
          lamports: initResponse.feeDetails.amountLamports,
          instructions: feeTransaction.message.compiledInstructions.length,
          blockhash: feeTransaction.message.recentBlockhash.substring(0, 8) + '...',
        });
        
        const signedFeeTx = await signTransaction(feeTransaction);
        console.log('[CLAIM] Fee transaction signed, sending...');
        
        setProgress(40);
        setStatus('confirming_fee');
        
        const feeSignature = await connection.sendRawTransaction(signedFeeTx.serialize());
        console.log('[CLAIM] Fee payment sent:', feeSignature);
        
        // Wait for fee transaction confirmation with polling
        console.log('[CLAIM] Waiting for fee payment confirmation...');
        await connection.confirmTransaction(feeSignature, 'confirmed');
        console.log('[CLAIM] Fee payment confirmed!');
        
        setProgress(60);
        setStatus('processing_claim');

        // Step 3: Call /complete-claim with fee signature
        console.log('[CLAIM] Step 3: Completing claim...');
        const completeResponse = await apiClient.post<ClaimResult>(
          '/user/vesting/complete-claim',
          {
            userWallet: publicKey.toString(),
            feeSignature,
            poolBreakdown: initResponse.claimDetails.poolBreakdown,
          }
        );

        console.log('[CLAIM] Complete response:', completeResponse);

        if (!completeResponse || !completeResponse.totalAmountClaimed) {
          throw new Error('Invalid response from complete-claim endpoint');
        }

        setProgress(80);
        setStatus('confirming_claim');

        // Poll transaction status until confirmed
        const tokenSignature = completeResponse.tokenTransactionSignature;
        await pollTransactionStatus(tokenSignature);

        setProgress(100);
        setStatus('success');
        console.log('[CLAIM] Claim completed successfully:', completeResponse);
        return completeResponse;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to execute claim');
        console.error('[CLAIM] Error:', error);
        setError(error);
        setStatus('error');
        setProgress(0);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, signTransaction, sendTransaction]
  );

  // Poll transaction status endpoint
  const pollTransactionStatus = async (signature: string, maxAttempts = 10): Promise<void> => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const statusResponse = await apiClient.get<TransactionStatusResponse>(
          `/user/vesting/claim-status/${signature}`
        );

        console.log(`[CLAIM-STATUS] Attempt ${attempt + 1}/${maxAttempts}:`, statusResponse.status);

        if (statusResponse.status === 'confirmed') {
          console.log('[CLAIM-STATUS] Transaction confirmed!');
          return;
        }

        if (statusResponse.status === 'failed') {
          throw new Error(statusResponse.error || 'Transaction failed on-chain');
        }

        // Wait 3 seconds before next poll
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } catch (err) {
        console.error('[CLAIM-STATUS] Polling error:', err);
        // Continue polling even if status check fails
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }

    // If we reach here, transaction might still be pending
    console.warn('[CLAIM-STATUS] Max polling attempts reached, transaction may still be processing');
  };

  return {
    executeClaim,
    loading,
    error,
    status,
    progress,
  };
}
