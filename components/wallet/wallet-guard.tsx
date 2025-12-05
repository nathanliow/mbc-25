"use client";

import { ReactNode } from "react";
import { useWallet } from "@/lib/wallet-context";
import { WalletSetup } from "./wallet-setup";
import { WalletUnlock } from "./wallet-unlock";

interface WalletGuardProps {
  children: ReactNode;
}

export function WalletGuard({ children }: WalletGuardProps) {
  const { isUnlocked, isLoading, hasWallet } = useWallet();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-gray-400">Loading wallet...</p>
        </div>
      </div>
    );
  }

  if (!hasWallet) {
    return <WalletSetup />;
  }

  if (!isUnlocked) {
    return <WalletUnlock />;
  }

  return <>{children}</>;
}

