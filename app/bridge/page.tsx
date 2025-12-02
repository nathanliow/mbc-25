"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRightLeft, Shield } from "lucide-react";
import { TokenSelector } from "@/components/swap/token-selector";

const tokens = [
  { symbol: "SOL", name: "Solana", balance: "12.5" },
  { symbol: "ZEC", name: "Zcash", balance: "0.00" },
];

export default function BridgePage() {
  const [fromToken, setFromToken] = useState(tokens[0]);
  const [toToken, setToToken] = useState(tokens[1]);
  const [amount, setAmount] = useState("");
  const [zecAddress, setZecAddress] = useState("");

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-md">
      <Card className="bg-transparent border-0">
        <CardContent className="p-0">
          <div className="space-y-4">
            <TokenSelector
              token={fromToken}
              label="From"
              onClick={() => {}}
            />

            <div className="flex justify-center">
              <ArrowRightLeft className="h-6 w-6 text-gray-400" />
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
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            {toToken.symbol === "ZEC" && (
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Zcash Shielded Address</label>
                <Input
                  placeholder="zs1..."
                  value={zecAddress}
                  onChange={(e) => setZecAddress(e.target.value)}
                />
              </div>
            )}

            {amount && (
              <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Estimated output</span>
                  <span className="font-semibold">
                    {(parseFloat(amount) * 0.95).toFixed(4)} {toToken.symbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Bridge fee</span>
                  <span>5%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Estimated time</span>
                  <span>5-10 minutes</span>
                </div>
              </div>
            )}

            <Button className="w-full" size="lg" disabled={!amount}>
              <Shield className="h-4 w-4 mr-2" />
              Bridge Privately
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

