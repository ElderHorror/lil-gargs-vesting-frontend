import { Suspense } from "react";
import { VestingDashboard } from "@/components/user/VestingDashboard";
import { WalletProvider } from "@/components/providers/WalletProvider";

export default function UserVestingPage() {
  return (
    <WalletProvider>
      <Suspense fallback={<div className="min-h-screen bg-[#0c0b25]" />}>
        <VestingDashboard />
      </Suspense>
    </WalletProvider>
  );
}
