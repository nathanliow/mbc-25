import { Button } from "@/components/ui/button";
import { Send, QrCode, ArrowDownUp, Shield } from "lucide-react";

interface ActionButtonsProps {
  onSend?: () => void;
  onReceive?: () => void;
  onSwap?: () => void;
}

export function ActionButtons({ onSend, onReceive, onSwap }: ActionButtonsProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Button variant="outline" className="h-12 flex-col gap-1" onClick={onSend}>
        <Send className="h-4 w-4" />
        <span className="text-xs">Send</span>
      </Button>
      <Button variant="outline" className="h-12 flex-col gap-1" onClick={onReceive}>
        <QrCode className="h-4 w-4" />
        <span className="text-xs">Receive</span>
      </Button>
      <Button variant="outline" className="h-12 flex-col gap-1" onClick={onSwap}>
        <ArrowDownUp className="h-4 w-4" />
        <span className="text-xs">Swap</span>
      </Button>
    </div>
  );
}

