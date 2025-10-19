import { Suspense } from "react";
import { VestingRewardsPage } from "@/components/user/VestingRewardsPage";
import { WalletProvider } from "@/components/providers/WalletProvider";

export default function UserVestingPage() {
  return (
    <WalletProvider>
      <Suspense fallback={<div className="min-h-screen bg-[#0c0b25]" />}>
        <VestingRewardsPage />
      </Suspense>
    </WalletProvider>
  );
}
