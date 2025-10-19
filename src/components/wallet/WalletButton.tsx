"use client";

import dynamic from 'next/dynamic';
import { ComponentProps } from 'react';

// Dynamically import WalletMultiButton with no SSR
const WalletMultiButtonDynamic = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

export function WalletButton(props: ComponentProps<typeof WalletMultiButtonDynamic>) {
  return <WalletMultiButtonDynamic {...props} />;
}
