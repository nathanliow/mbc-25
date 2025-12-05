import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { WalletProvider } from "@/lib/wallet-context";
import { WalletGuard } from "@/components/wallet/wallet-guard";
import { Provider as JotaiProvider } from "jotai";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ShadeWallet - Privacy-Enhanced Solana Wallet",
  description: "Privacy-first Solana wallet with automatic shielding, stealth addresses, and private DeFi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <JotaiProvider>
          <WalletProvider>
            <WalletGuard>
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1 pb-20">
            {children}
          </main>
          <BottomNav />
        </div>
            </WalletGuard>
          </WalletProvider>
        </JotaiProvider>
      </body>
    </html>
  );
}
