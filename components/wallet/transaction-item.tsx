import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownLeft, Shield, ArrowLeftRight } from "lucide-react";
import { truncateAddress } from "@/lib/wallet-context";
import { formatNumber } from "@/lib/format-number";

interface TransactionItemProps {
  type: "send" | "receive" | "swap";
  amount: number;
  token: string;
  to?: string;
  from?: string;
  timestamp: string;
  isPrivate?: boolean;
  transactionUrl?: string;
  signature: string;
  fromToken?: string;
  fromAmount?: number;
  toToken?: string;
  toAmount?: number;
}

export function TransactionItem({
  type,
  amount,
  token,
  to,
  from,
  timestamp,
  isPrivate = false,
  transactionUrl,
  signature,
  fromToken,
  fromAmount,
  toToken,
  toAmount,
}: TransactionItemProps) {
  const isSend = type === "send";
  const isSwap = type === "swap";
  
  const content = (
    <Card className="hover:bg-muted transition-colors">
      <CardContent className="py-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center ${
              isSwap ? "bg-blue-500/20" : isSend ? "bg-red-500/20" : "bg-green-500/20"
            }`}>
              {isSwap ? (
                <ArrowLeftRight className="h-4 w-4 text-blue-500" />
              ) : isSend ? (
                <ArrowUpRight className="h-4 w-4 text-red-500" />
              ) : (
                <ArrowDownLeft className="h-4 w-4 text-green-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold">
                  {isSwap ? (
                    <>
                      Swap {formatNumber(fromAmount || 0)} {fromToken || ""} to {formatNumber(toAmount || amount)} {toToken || token}
                    </>
                  ) : (
                    <>
                      {isSend ? "Sent" : "Received"} {formatNumber(amount)} {token}
                    </>
                  )}
                </p>
                {isPrivate && (
                  <Shield className="h-3 w-3 text-primary flex-shrink-0" />
                )}
              </div>
              {!isSwap && (
                <p className="text-[11px] text-gray-400 truncate">
                  {isSend ? `To: ${to?.slice(0, 8)}...${to?.slice(-6)}` : `From: ${from?.slice(0, 8)}...${from?.slice(-6)}`}
                </p>
              )}
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] text-gray-500 truncate">
                  {timestamp}
                </p>
                <p className="text-[10px] text-gray-500 font-mono flex-shrink-0">
                  {truncateAddress(signature, 4)}
                </p>
              </div>
            </div>
          </div>
          {isPrivate && (
            <Badge variant="default" className="ml-2 flex-shrink-0">
              Private
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (transactionUrl) {
    return (
      <a
        href={transactionUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {content}
      </a>
    );
  }

  return content;
}

