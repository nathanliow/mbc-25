"use client";

import { useEffect, useState, useMemo } from "react";
import { useAtom } from "jotai";
import { 
  Drawer,
  Button, 
  Input, 
  Card, 
  CardContent,
  TokenIcon
} from "@/components";
import { useWallet } from "@/lib/wallet-context";
import { 
  Shield, 
  ArrowDown, 
  ArrowUp, 
  ChevronDown 
} from "lucide-react";
import {
  depositAmountAtom,
  depositIsLoadingAtom,
  depositErrorAtom,
} from "@/lib/atoms";
import { SOL_MINT } from "@/lib/const";

interface DepositDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DepositDrawer({ isOpen, onClose }: DepositDrawerProps) {
  const { 
    publicBalance, 
    privateBalance, 
    privateBalances,
    deposit, 
    withdraw, 
    publicKey, 
    refreshBalances,
    splTokens 
  } = useWallet();
  const [amount, setAmount] = useAtom(depositAmountAtom);
  const [isDepositing, setIsDepositing] = useState(true);
  const [isLoading, setIsLoading] = useAtom(depositIsLoadingAtom);
  const [error, setError] = useAtom(depositErrorAtom);
  const [showTokenList, setShowTokenList] = useState(false);
  const [selectedToken, setSelectedToken] = useState<{
    mint: string;
    symbol: string;
    name: string;
    decimals: number;
    publicBalance: number;
    privateBalance: number;
    imageUrl?: string | null;
  } | null>(null);

  // Get available tokens for deposit (public balance > 0)
  const availableDepositTokens = useMemo(() => {
    const tokens: NonNullable<typeof selectedToken>[] = [];
    
    // Add SOL if has public balance
    if (publicBalance > 0) {
      tokens.push({
        mint: SOL_MINT,
        symbol: "SOL",
        name: "Solana",
        decimals: 9,
        publicBalance,
        privateBalance: privateBalances?.[SOL_MINT] || 0,
      });
    }
    
    // Add SPL tokens with public balance
    splTokens.forEach(t => {
      if (t.uiAmount > 0) {
        tokens.push({
          mint: t.mint,
          symbol: t.symbol,
          name: t.name,
          decimals: t.decimals,
          publicBalance: t.uiAmount,
          privateBalance: t.privateBalance || 0,
          imageUrl: t.imageUrl,
        });
      }
    });
    
    return tokens;
  }, [publicBalance, privateBalances, splTokens]);

  // Get available tokens for withdraw (private balance > 0)
  const availableWithdrawTokens = useMemo(() => {
    const tokens: NonNullable<typeof selectedToken>[] = [];
    
    // Add SOL if has private balance
    if (privateBalance > 0) {
      tokens.push({
        mint: SOL_MINT,
        symbol: "SOL",
        name: "Solana",
        decimals: 9,
        publicBalance,
        privateBalance,
      });
    }
    
    // Add SPL tokens with private balance
    splTokens.forEach(t => {
      const privBal = t.privateBalance || 0;
      if (privBal > 0) {
        tokens.push({
          mint: t.mint,
          symbol: t.symbol,
          name: t.name,
          decimals: t.decimals,
          publicBalance: t.uiAmount,
          privateBalance: privBal,
          imageUrl: t.imageUrl,
        });
      }
    });
    
    return tokens;
  }, [publicBalance, privateBalance, privateBalances, splTokens]);

  // Set default token when mode changes
  useEffect(() => {
    const availableTokens = isDepositing ? availableDepositTokens : availableWithdrawTokens;
    if (availableTokens.length > 0 && (!selectedToken || !availableTokens.find(t => t.mint === selectedToken?.mint))) {
      setSelectedToken(availableTokens[0]);
      setAmount("");
    }
  }, [isDepositing, availableDepositTokens, availableWithdrawTokens, selectedToken]);

  // Update selected token when balances change (after deposit/withdraw)
  useEffect(() => {
    if (selectedToken) {
      const availableTokens = isDepositing ? availableDepositTokens : availableWithdrawTokens;
      const updatedToken = availableTokens.find(t => t.mint === selectedToken.mint);
      if (updatedToken) {
        // Update selected token with latest balances
        setSelectedToken(updatedToken);
      }
    }
  }, [availableDepositTokens, availableWithdrawTokens, isDepositing]);

  // Reset state when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setAmount("");
      setError("");
      setShowTokenList(false);
    }
  }, [isOpen, setAmount, setError]);

  const handleAction = async () => {
    if (!selectedToken) {
      setError("Please select a token");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    const maxAmount = isDepositing 
      ? selectedToken.publicBalance 
      : selectedToken.privateBalance;

    if (amountNum > maxAmount) {
      setError(`Insufficient ${isDepositing ? "public" : "private"} balance`);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      if (isDepositing) {
        await deposit(amountNum, selectedToken.mint, selectedToken.decimals);
      } else {
        if (!publicKey) throw new Error("No wallet");
        await withdraw(publicKey, amountNum, selectedToken.mint, selectedToken.decimals);
      }
      
      // Wait a bit for transaction to be processed on-chain
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      // Refresh balances to update UI (this will trigger the useEffect to update selectedToken)
      await refreshBalances();
      
      setAmount("");
      // Keep drawer open briefly to show updated balance, then close
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || (isDepositing ? "Failed to shield funds" : "Failed to unshield funds"));
    } finally {
      setIsLoading(false);
    }
  };

  const availableTokens = isDepositing ? availableDepositTokens : availableWithdrawTokens;
  const maxAmount = selectedToken 
    ? (isDepositing ? selectedToken.publicBalance : selectedToken.privateBalance)
    : 0;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={isDepositing ? "Shield Funds" : "Unshield Funds"}>
      <div className="space-y-4">
        <div className="flex rounded-lg overflow-hidden border border-border">
          <button
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              isDepositing ? "bg-primary text-white" : "bg-muted text-gray-400"
            }`}
            onClick={() => setIsDepositing(true)}
          >
            <ArrowDown className="h-4 w-4 inline mr-2" />
            Shield
          </button>
          <button
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              !isDepositing ? "bg-primary text-white" : "bg-muted text-gray-400"
            }`}
            onClick={() => setIsDepositing(false)}
          >
            <ArrowUp className="h-4 w-4 inline mr-2" />
            Unshield
          </button>
        </div>

        {/* Token Selector */}
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Token</label>
          <div className="relative">
            <Card 
              className="hover:bg-muted transition-colors cursor-pointer"
              onClick={() => setShowTokenList(!showTokenList)}
            >
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {selectedToken?.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedToken.imageUrl}
                        alt={selectedToken.symbol}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <TokenIcon symbol={selectedToken?.symbol || "SOL"} className="h-8 w-8" />
                    )}
                    <div>
                      <p className="text-sm font-semibold">{selectedToken?.symbol || "Select token"}</p>
                      <p className="text-xs text-gray-400">{selectedToken?.name || ""}</p>
                    </div>
                  </div>
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            {showTokenList && (
              <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
                {availableTokens.map((token) => (
                  <Card
                    key={token.mint}
                    className="hover:bg-muted transition-colors cursor-pointer border-0 rounded-none"
                    onClick={() => {
                      setSelectedToken(token);
                      setShowTokenList(false);
                      setAmount("");
                    }}
                  >
                    <CardContent className="py-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          {token.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={token.imageUrl}
                              alt={token.symbol}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <TokenIcon symbol={token.symbol} className="h-8 w-8" />
                          )}
                          <div>
                            <p className="text-sm font-semibold">{token.symbol}</p>
                            <p className="text-xs text-gray-400">{token.name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">
                            {isDepositing 
                              ? `Bal: ${token.publicBalance.toFixed(4)}`
                              : `Bal: ${token.privateBalance.toFixed(4)}`}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Balance Display */}
        {selectedToken && (
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Public Balance</span>
              <span>{selectedToken.publicBalance.toFixed(4)} {selectedToken.symbol}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400 flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Private Balance
              </span>
              <span className="text-primary">{selectedToken.privateBalance.toFixed(4)} {selectedToken.symbol}</span>
            </div>
          </div>
        )}

        {/* Amount Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-400">Amount</label>
            <button
              onClick={() => setAmount(maxAmount.toString())}
              className="text-xs text-primary hover:underline"
            >
              Max: {maxAmount.toFixed(4)} {selectedToken?.symbol || ""}
            </button>
          </div>
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        <Button
          className="w-full"
          size="lg"
          onClick={handleAction}
          disabled={isLoading || !amount || !selectedToken}
        >
          <Shield className="h-4 w-4 mr-2" />
          {isLoading
            ? "Processing..."
            : isDepositing
            ? "Shield to Private"
            : "Unshield to Public"}
        </Button>

        <p className="text-xs text-center text-gray-500">
          {isDepositing
            ? "Shielding moves funds to Encifher for private transactions"
            : "Unshielding moves funds back to your public balance"}
        </p>
      </div>
    </Drawer>
  );
}
