import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownLeft, Shield } from "lucide-react";

interface TransactionItemProps {
  type: "send" | "receive";
  amount: string;
  token: string;
  to?: string;
  from?: string;
  timestamp: string;
  isPrivate?: boolean;
}

export function TransactionItem({
  type,
  amount,
  token,
  to,
  from,
  timestamp,
  isPrivate = false,
}: TransactionItemProps) {
  const isSend = type === "send";
  
  return (
    <Card className="hover:bg-muted transition-colors">
      <CardContent className="py-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
              isSend ? "bg-red-500/20" : "bg-green-500/20"
            }`}>
              {isSend ? (
                <ArrowUpRight className="h-4 w-4 text-red-500" />
              ) : (
                <ArrowDownLeft className="h-4 w-4 text-green-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold">
                  {isSend ? "Sent" : "Received"} {amount} {token}
                </p>
                {isPrivate && (
                  <Shield className="h-3 w-3 text-primary flex-shrink-0" />
                )}
              </div>
              <p className="text-xs text-gray-400 truncate">
                {isSend ? `To: ${to?.slice(0, 8)}...${to?.slice(-6)}` : `From: ${from?.slice(0, 8)}...${from?.slice(-6)}`}
              </p>
              <p className="text-xs text-gray-500">{timestamp}</p>
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
}

