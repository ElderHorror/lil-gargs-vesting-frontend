"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "@/components/wallet/WalletButton";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { DashboardView } from "@/components/dashboard/DashboardView";

export function AdminDashboard() {
  const { connected } = useWallet();
  const { isAdmin, isLoading } = useAdminAuth();

  // Show connect wallet if not connected
  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="text-white text-4xl font-bold tracking-tight">Admin Dashboard</div>
          <div className="text-white/50 text-lg text-center max-w-md">
            Connect your admin wallet to access the dashboard
          </div>
        </div>
        
        <div className="wallet-adapter-button-trigger-wrapper">
          <WalletButton 
            style={{
              backgroundColor: '#5b21b6',
              height: '48px',
              fontSize: '16px',
              fontWeight: '600',
              borderRadius: '12px',
              padding: '0 24px',
            }}
          />
        </div>

        <div className="text-white/30 text-sm text-center max-w-md mt-8">
          Only authorized admin wallets can access this dashboard. If you&apos;re not an admin, you&apos;ll be redirected to the user vesting page.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        <div className="text-white text-lg">Verifying admin access...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Will redirect to home
  }

  return (
    <DashboardView
      initialRules={[]}
      initialSummary={null}
      initialMetrics={null}
    />
  );
}
