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

export function useClaimWithFee() {
  const { publicKey, signTransaction, sendTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

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
        
        const feeSignature = await connection.sendRawTransaction(signedFeeTx.serialize());
        console.log('[CLAIM] Fee payment sent:', feeSignature);
        
        // Wait for fee transaction confirmation
        console.log('[CLAIM] Waiting for fee payment confirmation...');
        await connection.confirmTransaction(feeSignature, 'confirmed');
        console.log('[CLAIM] Fee payment confirmed!');

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

        console.log('[CLAIM] Claim completed successfully:', completeResponse);
        return completeResponse;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to execute claim');
        console.error('[CLAIM] Error:', error);
        setError(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, signTransaction, sendTransaction]
  );

  return {
    executeClaim,
    loading,
    error,
  };
}
