import { 
  TokenIcon,
  Card, 
  CardContent,
  Input
} from "@/components";
import { ChevronDown } from "lucide-react";

interface TokenSelectorProps {
  token: {
    symbol: string;
    name: string;
    balance?: string;
  };
  label: string;
  amount?: string;
  onAmountChange?: (value: string) => void;
  onClick: () => void;
  disabled?: boolean;
  usdValue?: number | null;
}

export function TokenSelector({
  token,
  label,
  amount = "",
  onAmountChange,
  onClick,
  disabled = false,
  usdValue,
}: TokenSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm text-gray-400">{label}</label>
      <Card className="hover:bg-muted transition-colors">
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-3">
            <div
              className="flex items-center gap-3 cursor-pointer flex-1"
              onClick={onClick}
            >
              <TokenIcon symbol={token.symbol} className="h-10 w-10" />
              <div>
                <p className="font-semibold">{token.symbol}</p>
                <p className="text-xs text-gray-400">{token.name}</p>
              </div>
            </div>
            <button
              onClick={onClick}
              className="p-1 hover:bg-muted/80 rounded-lg transition-colors"
            >
            <ChevronDown className="h-5 w-5 text-gray-400" />
            </button>
          </div>
          <div className="space-y-1">
            {token.balance && (
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-400">Balance: {token.balance}</p>
                {token.balance && !disabled && (
                  <button
                    onClick={() =>
                      onAmountChange?.(token.balance?.replace(/,/g, "") || "")
                    }
                    className="text-xs text-primary hover:underline"
                  >
                    Max
                  </button>
                )}
              </div>
            )}
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => onAmountChange?.(e.target.value)}
              disabled={disabled}
              className="text-base font-medium"
            />
            {usdValue !== null && usdValue !== undefined && (
              <p className="text-xs text-gray-400 text-right">${usdValue.toFixed(2)}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

