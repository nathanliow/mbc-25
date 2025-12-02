import { Shield } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-secondary/95 backdrop-blur supports-[backdrop-filter]:bg-secondary/80">
      <div className="container flex h-14 items-center px-4">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">ShadeWallet</span>
        </div>
      </div>
    </header>
  );
}

