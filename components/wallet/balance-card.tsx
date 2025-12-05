"use client";

import { 
  Card,
  CardContent,
} from "@/components";

interface BalanceCardProps {
  balance: string;
  usdValue?: string;
  publicBalance?: string;
  privateBalance?: string;
}

export function BalanceCard({ 
  balance, 
  usdValue,
  publicBalance,
  privateBalance,
}: BalanceCardProps) {
  // Calculate USD values for public/private balances if needed
  const totalBalance = parseFloat(balance.replace(/,/g, "") || "0");
  const totalUsd = parseFloat(usdValue?.replace(/,/g, "") || "0");
  const pricePerToken = totalBalance > 0 ? totalUsd / totalBalance : 0;
  
  const displayPublic = parseFloat(publicBalance?.replace(/,/g, "") || "0");
  const displayPrivate = parseFloat(privateBalance?.replace(/,/g, "") || "0");
  
  const displayPublicUsd = (displayPublic * pricePerToken).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const displayPrivateUsd = (displayPrivate * pricePerToken).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <Card className="bg-background border-0">
      <CardContent className="">
        <div className="space-y-1 text-center">
          <p className="text-3xl font-bold">{usdValue ? `$${usdValue}` : `$${balance}`}</p>
          {(publicBalance !== undefined || privateBalance !== undefined) && (
            <div className="flex items-center justify-center gap-3 text-xs text-gray-400">
              {publicBalance !== undefined && (
                <span>Public: ${displayPublicUsd}</span>
              )}
              {privateBalance !== undefined && (
                <span>Private: ${displayPrivateUsd}</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

