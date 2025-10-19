import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Admin Vesting Console",
  description: "Control panel for Solana NFT vesting operations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#0c0b25] antialiased">
        {children}
      </body>
    </html>
  );
}
