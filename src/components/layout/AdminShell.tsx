"use client";

import { PropsWithChildren, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { AdminTopBar } from "@/components/layout/AdminTopBar";
import { cn } from "@/lib/utils";

import "@solana/wallet-adapter-react-ui/styles.css";

type AdminShellProps = PropsWithChildren<{
  className?: string;
}>;

export function AdminShell({ children, className }: AdminShellProps) {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="min-h-screen w-full overflow-x-hidden text-[var(--foreground)]">
            <div className="relative">
              <div className="absolute inset-0 -z-10 opacity-50 blur-[120px]">
                <div className="absolute left-1/4 top-[-10%] h-72 w-72 rounded-full bg-[var(--accent)]/40" />
                <div className="absolute bottom-[-10%] left-1/3 h-96 w-96 rounded-full bg-[#e44fff]/20" />
              </div>
            </div>
            <div className="relative z-10 flex min-h-screen flex-col px-4 pb-10 pt-6 sm:px-6 sm:pt-8 lg:px-12">
              <AdminTopBar />
              <main className={cn("mt-6 flex min-w-0 flex-1 flex-col gap-6", className)}>{children}</main>
            </div>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
