"use client";

import { useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, Check, AlertTriangle, Eye, EyeOff } from "lucide-react";

interface ExportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  type: "mnemonic" | "privateKey";
  data: string;
  title: string;
}

export function ExportDrawer({
  isOpen,
  onClose,
  type,
  data,
  title,
}: ExportDrawerProps) {
  const [copied, setCopied] = useState(false);
  const [showData, setShowData] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(data);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadAsFile = () => {
    const blob = new Blob([data], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = type === "mnemonic" ? "seed-phrase.txt" : "private-key.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!confirmed) {
    return (
      <Drawer isOpen={isOpen} onClose={onClose} title={title}>
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-yellow-500">
                  Security Warning
                </p>
                <p className="text-xs text-gray-400">
                  {type === "mnemonic"
                    ? "Your seed phrase gives full access to your wallet and all derived accounts. Never share it with anyone. Anyone with this phrase can steal your funds."
                    : "Your private key gives full access to this specific account. Never share it with anyone. Anyone with this key can steal your funds."}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-muted"
              />
              <span className="text-sm text-gray-400">
                I understand the risks and want to proceed
              </span>
            </label>

            <Button
              className="w-full"
              onClick={() => setConfirmed(true)}
              disabled={!confirmed}
            >
              Show {type === "mnemonic" ? "Seed Phrase" : "Private Key"}
            </Button>
          </div>
        </div>
      </Drawer>
    );
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-red-500">
                Keep This Secret
              </p>
              <p className="text-xs text-gray-400">
                Never share this information. Store it securely offline.
              </p>
            </div>
          </div>
        </div>

        <Card className="bg-muted/50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-400">
                {type === "mnemonic" ? "Seed Phrase" : "Private Key"}
              </p>
              <button
                onClick={() => setShowData(!showData)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                {showData ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {type === "mnemonic" ? (
              <div className="grid grid-cols-3 gap-2">
                {data.split(" ").map((word, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 rounded bg-background"
                  >
                    <span className="text-xs text-gray-500 w-4">
                      {index + 1}.
                    </span>
                    <span className="text-sm font-mono">
                      {showData ? word : "••••"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded bg-background">
                <p className="text-sm font-mono break-all">
                  {showData ? data : "••••••••••••••••••••••••••••••••"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={copyToClipboard}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </>
            )}
          </Button>
          <Button variant="outline" className="flex-1" onClick={downloadAsFile}>
            Download
          </Button>
        </div>

        <p className="text-xs text-center text-gray-500">
          {type === "mnemonic"
            ? "Write down these words in order and store them securely offline"
            : "Save this private key securely. You can use it to import this account in other wallets."}
        </p>
      </div>
    </Drawer>
  );
}

