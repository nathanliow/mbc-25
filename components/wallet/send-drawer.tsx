"use client";

import { useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TokenIcon } from "@/components/tokens/token-icon";
import { Shield, ChevronDown } from "lucide-react";

interface Token {
  symbol: string;
  name: string;
  balance: string;
  usdValue: string;
  isShielded?: boolean;
}

interface SendDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tokens: Token[];
}

export function SendDrawer({ isOpen, onClose, tokens }: SendDrawerProps) {
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [showTokenList, setShowTokenList] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");

  const handleTokenSelect = (token: Token) => {
    setSelectedToken(token);
    setShowTokenList(false);
  };

  const handleSend = () => {
    // Handle send logic here
    console.log("Send", { selectedToken, recipientAddress, amount });
    onClose();
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Send">
      <div className="space-y-4">
        {/* Recipient Address */}
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Recipient Address</label>
          <Input
            type="text"
            placeholder="Enter Solana address"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
          />
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-400">Amount</label>
            {selectedToken && (
              <button
                onClick={() => setAmount(selectedToken.balance.replace(/,/g, ""))}
                className="text-xs text-primary hover:underline"
              >
                Max: {selectedToken.balance}
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

        {/* Token Selection */}
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
                      <TokenIcon
                        symbol={selectedToken.symbol}
                        className="h-10 w-10"
                      />
                      <div>
                        <p className="font-semibold">{selectedToken.symbol}</p>
                        <p className="text-xs text-gray-400">
                          Balance: {selectedToken.balance}
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
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
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
                          <TokenIcon symbol={token.symbol} className="h-8 w-8" />
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

        {/* Send Button */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleSend}
          disabled={!selectedToken || !recipientAddress || !amount}
        >
          <Shield className="h-4 w-4 mr-2" />
          Send Privately
        </Button>
      </div>
    </Drawer>
  );
}

