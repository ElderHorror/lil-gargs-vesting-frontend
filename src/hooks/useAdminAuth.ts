import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

/**
 * Hook to check if connected wallet is an admin
 * Redirects to home if not admin (but only after wallet is connected)
 */
export function useAdminAuth() {
  const { publicKey, connected } = useWallet();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAdmin() {
      if (!connected || !publicKey) {
        // Not connected yet, wait for wallet connection
        setIsLoading(false);
        setIsAdmin(false);
        return;
      }

      setIsLoading(true);

      try {
        // Check if wallet is admin
        const response = await api.get<{ success: boolean; isAdmin: boolean }>(`/config/check-admin?wallet=${publicKey.toBase58()}`);
        
        if (response.success && response.isAdmin) {
          setIsAdmin(true);
          setIsLoading(false);
        } else {
          // Not admin, redirect
          setIsAdmin(false);
          setIsLoading(false);
          router.push('/user/vesting');
        }
      } catch (error) {
        // API call failed, not admin
        console.error('Admin check failed:', error);
        setIsAdmin(false);
        setIsLoading(false);
        router.push('/user/vesting');
      }
    }

    checkAdmin();
  }, [connected, publicKey, router]);

  return { isAdmin, isLoading };
}
