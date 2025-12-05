"use client";

import { useEffect } from "react";
import { useAtom } from "jotai";
import { 
  Drawer,
  Button,
  Card,
  CardContent,
  Input,
  TokenIcon
 } from "@/components";
import { useWallet } from "@/lib/wallet-context";
import { sendSplToken } from "@/lib/solana";
import { Shield, ChevronDown, Send } from "lucide-react";
import {
  sendSelectedTokenAtom,
  sendShowTokenListAtom,
  sendRecipientAddressAtom,
  sendAmountAtom,
  sendIsPrivateAtom,
  sendIsLoadingAtom,
  sendErrorAtom,
} from "@/lib/atoms";

interface Token {
  symbol: string;
  name: string;
  balance: string;
  usdValue: string;
  isShielded?: boolean;
  publicBalance?: string;
  privateBalance?: string;
  imageUrl?: string | null;
  mint?: string;
  decimals?: number;
}

interface SendDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tokens: Token[];
}

export function SendDrawer({ isOpen, onClose, tokens }: SendDrawerProps) {
  const { sendPublic, sendPrivately, privateBalance, refreshBalances, getActiveKeypair } =
    useWallet();
  const [selectedToken, setSelectedToken] = useAtom(sendSelectedTokenAtom);
  const [showTokenList, setShowTokenList] = useAtom(sendShowTokenListAtom);
  const [recipientAddress, setRecipientAddress] = useAtom(sendRecipientAddressAtom);
  const [amount, setAmount] = useAtom(sendAmountAtom);
  const [isPrivate, setIsPrivate] = useAtom(sendIsPrivateAtom);
  const [isLoading, setIsLoading] = useAtom(sendIsLoadingAtom);
  const [error, setError] = useAtom(sendErrorAtom);

  // Reset state when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setRecipientAddress("");
      setAmount("");
      setError("");
      setSelectedToken(null);
      setShowTokenList(false);
    }
  }, [isOpen, setRecipientAddress, setAmount, setError, setSelectedToken, setShowTokenList]);

  const handleTokenSelect = (token: Token) => {
    setSelectedToken(token);
    setShowTokenList(false);
  };

  const handleSend = async () => {
    if (!selectedToken) {
      setError("Please select a token");
      return;
    }
    if (!recipientAddress) {
      setError("Please enter a recipient address");
      return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    const maxBalance = isPrivate 
      ? parseFloat(selectedToken.privateBalance || "0")
      : parseFloat(selectedToken.publicBalance || selectedToken.balance.replace(/,/g, ""));

    if (amountNum > maxBalance) {
      setError(`Insufficient ${isPrivate ? "private" : "public"} balance`);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      if (isPrivate) {
        await sendPrivately(recipientAddress, amountNum);
      } else {
        if (selectedToken.symbol === "SOL") {
          await sendPublic(recipientAddress, amountNum);
        } else {
          const keypair = getActiveKeypair();
          if (!keypair) throw new Error("Wallet not unlocked");
          if (!selectedToken.mint || selectedToken.decimals === undefined) {
            throw new Error("Token metadata missing mint/decimals");
          }
          await sendSplToken(
            keypair,
            selectedToken.mint,
            recipientAddress,
            amountNum,
            selectedToken.decimals
          );
        }
      }
      await refreshBalances();
      setRecipientAddress("");
      setAmount("");
      setSelectedToken(null);
    onClose();
    } catch (err: any) {
      console.error("[SendDrawer] Transaction failed:", err);
      const msg =
        typeof err?.message === "string" && err.message.trim().length > 0
          ? err.message
          : "Transaction failed. Please try again.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const availableBalance = selectedToken
    ? isPrivate
      ? parseFloat(selectedToken.privateBalance || "0")
      : parseFloat(selectedToken.publicBalance || selectedToken.balance.replace(/,/g, ""))
    : 0;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Send">
      <div className="space-y-4 pb-4">
        <div className="flex rounded-lg overflow-hidden border border-border">
          <button
            className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              isPrivate ? "bg-primary text-white" : "bg-muted text-gray-400"
            }`}
            onClick={() => setIsPrivate(true)}
          >
            <Shield className="h-4 w-4" />
            Private
          </button>
          <button
            className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              !isPrivate ? "bg-primary text-white" : "bg-muted text-gray-400"
            }`}
            onClick={() => setIsPrivate(false)}
          >
            <Send className="h-4 w-4" />
            Public
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-400">Recipient Address</label>
          <Input
            type="text"
            placeholder="Enter Solana address"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-400">Amount</label>
            {selectedToken && (
              <button
                onClick={() => setAmount(availableBalance.toString())}
                className="text-xs text-primary hover:underline"
              >
                Max: {availableBalance.toFixed(4)}
              </button>
            )}
          </div>
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-400">Select Token</label>
          {!showTokenList ? (
            <Card
              className="hover:bg-muted transition-colors cursor-pointer"
              onClick={() => setShowTokenList(true)}
            >
              <CardContent className="py-3">
                {selectedToken ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {selectedToken.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedToken.imageUrl}
                          alt={selectedToken.symbol}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                      <TokenIcon
                        symbol={selectedToken.symbol}
                        className="h-10 w-10"
                      />
                      )}
                      <div>
                        <p className="font-semibold">{selectedToken.symbol}</p>
                        <p className="text-xs text-gray-400">
                          {isPrivate ? "Private" : "Public"}:{" "}
                          {availableBalance.toFixed(4)}
                        </p>
                      </div>
                    </div>
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Select a token</span>
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {tokens
                .filter((token) => parseFloat(token.balance.replace(/,/g, "")) > 0)
                .map((token) => (
                  <Card
                    key={token.symbol}
                    className="hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => handleTokenSelect(token)}
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
                            <TokenIcon
                              symbol={token.symbol}
                              className="h-8 w-8"
                            />
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold">
                                {token.symbol}
                              </p>
                              {token.isShielded && (
                                <Shield className="h-3 w-3 text-primary" />
                              )}
                            </div>
                            <p className="text-xs text-gray-400">
                              {token.name}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            {token.balance}
                          </p>
                          <p className="text-xs text-gray-400">
                            ${token.usdValue}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        <Button
          className="w-full"
          size="lg"
          onClick={handleSend}
          disabled={!selectedToken || !recipientAddress || !amount || isLoading}
        >
          {isPrivate ? <Shield className="h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />}
          {isLoading ? "Sending..." : isPrivate ? "Send Privately" : "Send Publicly"}
        </Button>

        <p className="text-xs text-center text-gray-500">
          {isPrivate
            ? "Private sends use Encifher for unlinkable transactions"
            : "Public sends are visible on the blockchain"}
        </p>
      </div>
    </Drawer>
  );
}
