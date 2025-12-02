"use client";

import { useState } from "react";
import { BalanceCard } from "@/components/wallet/balance-card";
import { TokenList } from "@/components/wallet/token-list";
import { TransactionItem } from "@/components/wallet/transaction-item";
import { ActionButtons } from "@/components/wallet/action-buttons";
import { SendDrawer } from "@/components/wallet/send-drawer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const mockTokens = [
  {
    symbol: "SOL",
    name: "Solana",
    balance: "12.5",
    usdValue: "1,250.00",
    isShielded: true,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    balance: "1,250.00",
    usdValue: "1,250.00",
    isShielded: false,
  },
  {
    symbol: "USDT",
    name: "Tether",
    balance: "0.00",
    usdValue: "0.00",
    isShielded: false,
  },
];

const mockTransactions = [
  {
    type: "receive" as const,
    amount: "5.0",
    token: "SOL",
    from: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    timestamp: "2 hours ago",
    isPrivate: true,
  },
  {
    type: "send" as const,
    amount: "100.00",
    token: "USDC",
    to: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    timestamp: "1 day ago",
    isPrivate: true,
  },
  {
    type: "receive" as const,
    amount: "2.5",
    token: "SOL",
    from: "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
    timestamp: "3 days ago",
    isPrivate: false,
  },
];

export default function WalletPage() {
  const [activeTab, setActiveTab] = useState("tokens");
  const [isSendDrawerOpen, setIsSendDrawerOpen] = useState(false);

  return (
    <>
      <div className="container mx-auto px-4 py-4 space-y-6 max-w-md">
        <div className="space-y-4">
          <BalanceCard
            balance="12.5"
            token="SOL"
            isShielded={true}
            usdValue="1,250.00"
            publicBalance="2.5"
            privateBalance="10.0"
          />
          <ActionButtons onSend={() => setIsSendDrawerOpen(true)} />
        </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="tokens" className="flex-1">
            Tokens
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex-1">
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tokens" className="mt-4">
          <TokenList tokens={mockTokens} />
        </TabsContent>

        <TabsContent value="activity" className="mt-4 space-y-2">
          {mockTransactions.map((tx, index) => (
            <TransactionItem key={index} {...tx} />
          ))}
        </TabsContent>
      </Tabs>
      </div>

      <SendDrawer
        isOpen={isSendDrawerOpen}
        onClose={() => setIsSendDrawerOpen(false)}
        tokens={mockTokens}
      />
    </>
  );
}

