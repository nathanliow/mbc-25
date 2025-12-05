import { SolLogo } from "./sol-logo";
import { UsdcLogo } from "./usdc-logo";
import { UsdtLogo } from "./usdt-logo";
import { ZecLogo } from "./zec-logo";
import { BaseLogo } from "./base-logo";

interface TokenIconProps {
  symbol: string;
  className?: string;
}

export function TokenIcon({ symbol, className }: TokenIconProps) {
  const iconClass = className || "h-10 w-10 flex-shrink-0";

  switch (symbol.toUpperCase()) {
    case "SOL":
      return <SolLogo className={iconClass} />;
    case "USDC":
      return <UsdcLogo className={iconClass} />;
    case "USDT":
      return <UsdtLogo className={iconClass} />;
    case "ZEC":
      return <ZecLogo className={iconClass} />;
    case "BASE":
      return <BaseLogo className={iconClass} />;
    default:
      return (
        <div className={`${iconClass} rounded-full bg-primary/20 flex items-center justify-center`}>
          <span className="text-sm font-bold">{symbol[0]}</span>
        </div>
      );
  }
}

