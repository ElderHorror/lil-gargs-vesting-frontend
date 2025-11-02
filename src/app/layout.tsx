import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lil Gargs Vesting",
  description: "Claim your $GARG token rewards from Lil Gargs vesting pools",
  icons: {
    icon: "/favicon.ico",
  },
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
