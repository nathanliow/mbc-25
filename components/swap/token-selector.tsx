import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TokenIcon } from "@/components/tokens/token-icon";

interface TokenSelectorProps {
  token: {
    symbol: string;
    name: string;
    balance?: string;
  };
  label: string;
  onClick: () => void;
}

export function TokenSelector({ token, label, onClick }: TokenSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm text-gray-400">{label}</label>
      <Card className="hover:bg-muted transition-colors cursor-pointer" onClick={onClick}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TokenIcon symbol={token.symbol} className="h-10 w-10" />
              <div>
                <p className="font-semibold">{token.symbol}</p>
                <p className="text-xs text-gray-400">{token.name}</p>
              </div>
            </div>
            <ChevronDown className="h-5 w-5 text-gray-400" />
          </div>
          {token.balance && (
            <p className="text-xs text-gray-400 mt-2">Balance: {token.balance}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

