import { Card, CardContent } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { TokenIcon } from "@/components/tokens/token-icon";

interface Token {
  symbol: string;
  name: string;
  balance: string;
  usdValue: string;
  isShielded?: boolean;
}

interface TokenListProps {
  tokens: Token[];
}

export function TokenList({ tokens }: TokenListProps) {
  return (
    <div className="space-y-1.5">
      {tokens.map((token) => (
        <Card key={token.symbol} className="hover:bg-muted transition-colors">
          <CardContent className="py-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <TokenIcon symbol={token.symbol} className="h-8 w-8" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold">{token.symbol}</p>
                    {token.isShielded && (
                      <Shield className="h-3 w-3 text-primary" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{token.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{token.balance}</p>
                <p className="text-xs text-gray-400">${token.usdValue}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

