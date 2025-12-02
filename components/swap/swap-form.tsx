"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TokenSelector } from "./token-selector";
import { ArrowDownUp, Shield } from "lucide-react";

const tokens = [
  { symbol: "SOL", name: "Solana", balance: "12.5" },
  { symbol: "USDC", name: "USD Coin", balance: "1,250.00" },
  { symbol: "USDT", name: "Tether", balance: "0.00" },
];

export function SwapForm() {
  const [fromToken, setFromToken] = useState(tokens[0]);
  const [toToken, setToToken] = useState(tokens[1]);
  const [fromAmount, setFromAmount] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);

  const handleSwapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
  };

  return (
    <Card className="bg-transparent border-0">
      <CardContent className="p-0">
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Swap</h3>
            <div className="flex items-center gap-2">
              <Button
                variant={isPrivate ? "default" : "outline"}
                size="sm"
                onClick={() => setIsPrivate(!isPrivate)}
              >
                <Shield className="h-4 w-4 mr-1" />
                {isPrivate ? "Private" : "Public"}
              </Button>
            </div>
          </div>

          <TokenSelector
            token={fromToken}
            label="From"
            onClick={() => {}}
          />
          
          <div className="flex justify-center -my-2 relative z-10">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={handleSwapTokens}
            >
              <ArrowDownUp className="h-4 w-4" />
            </Button>
          </div>

          <TokenSelector
            token={toToken}
            label="To"
            onClick={() => {}}
          />

          <div className="space-y-2">
            <label className="text-sm text-gray-400">Amount</label>
            <Input
              type="number"
              placeholder="0.00"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
            />
          </div>

          {fromAmount && (
            <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Rate</span>
                <span>1 SOL = 100 USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Estimated output</span>
                <span className="font-semibold">
                  {(parseFloat(fromAmount) * 100).toFixed(2)} {toToken.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Fee</span>
                <span>0.1%</span>
              </div>
            </div>
          )}

          <Button className="w-full" size="lg">
            {isPrivate ? (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Swap Privately
              </>
            ) : (
              "Swap"
            )}
          </Button>

          {isPrivate && (
            <p className="text-xs text-center text-gray-400">
              This swap will be executed through a privacy layer to protect your identity
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

