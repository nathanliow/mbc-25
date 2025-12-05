"use client";

import { Shield, Copy, Check } from "lucide-react";
import { useWallet, truncateAddress } from "@/lib/wallet-context";
import { useState } from "react";

export function Header() {
  const { publicKey, isUnlocked } = useWallet();
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-secondary/95 backdrop-blur supports-[backdrop-filter]:bg-secondary/80">
      <div className="container flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">ShadeWallet</span>
        </div>
        {isUnlocked && publicKey && (
          <button
            onClick={copyAddress}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
          >
            <span className="text-xs font-mono text-gray-400">
              {truncateAddress(publicKey, 4)}
            </span>
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3 text-gray-400" />
            )}
          </button>
        )}
      </div>
    </header>
  );
}
