"use client";

import { Button } from "@/components";
import { 
  Send, 
  QrCode, 
  Shield 
} from "lucide-react";
import { useState } from "react";
import { ReceiveDrawer } from "./receive-drawer";

interface ActionButtonsProps {
  onSend?: () => void;
  onDeposit?: () => void;
  onSwap?: () => void;
}

export function ActionButtons({ onSend, onDeposit, onSwap }: ActionButtonsProps) {
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);

  return (
    <>
    <div className="grid grid-cols-3 gap-2">
      <Button variant="outline" className="h-12 flex-col gap-1" onClick={onSend}>
        <Send className="h-4 w-4" />
        <span className="text-xs">Send</span>
      </Button>
        <Button variant="outline" className="h-12 flex-col gap-1" onClick={() => setIsReceiveOpen(true)}>
        <QrCode className="h-4 w-4" />
        <span className="text-xs">Receive</span>
      </Button>
        <Button variant="outline" className="h-12 flex-col gap-1" onClick={onDeposit}>
          <Shield className="h-4 w-4" />
          <span className="text-xs">Shield</span>
      </Button>
    </div>
      <ReceiveDrawer isOpen={isReceiveOpen} onClose={() => setIsReceiveOpen(false)} />
    </>
  );
}
