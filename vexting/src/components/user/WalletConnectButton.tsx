"use client";

import { useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "@/components/wallet/WalletButton";

export type WalletConnectButtonProps = {
  onWalletChange: (wallet: string | null) => void;
};

export function WalletConnectButton({ onWalletChange }: WalletConnectButtonProps) {
  const { publicKey, connected } = useWallet();

  useEffect(() => {
    if (connected && publicKey) {
      onWalletChange(publicKey.toBase58());
    } else {
      onWalletChange(null);
    }
  }, [connected, publicKey, onWalletChange]);

  return (
    <div className="wallet-adapter-button-wrapper">
      <WalletButton />
    </div>
  );
}
