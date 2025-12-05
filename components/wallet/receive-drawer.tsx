"use client";

import { useEffect } from "react";
import { useAtom } from "jotai";
import { 
  Drawer,
  Button,
  Card,
  CardContent
 } from "@/components";
import { useWallet } from "@/lib/wallet-context";
import { Copy, Check, Shield, QrCode, X } from "lucide-react";
import QRCode from "qrcode";
import {
  receiveCopiedAtom,
  receiveStealthIndexAtom,
  receiveShowQRCodeAtom,
  receiveQRCodeDataUrlAtom,
} from "@/lib/atoms";

interface ReceiveDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReceiveDrawer({ isOpen, onClose }: ReceiveDrawerProps) {
  const { publicKey, getStealthAddress } = useWallet();
  const [copied, setCopied] = useAtom(receiveCopiedAtom);
  const [stealthIndex, setStealthIndex] = useAtom(receiveStealthIndexAtom);
  const [showQRCode, setShowQRCode] = useAtom(receiveShowQRCodeAtom);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useAtom(receiveQRCodeDataUrlAtom);

  const stealthWallet = getStealthAddress(stealthIndex);
  const stealthAddress = stealthWallet?.publicKey || null;

  useEffect(() => {
    if (showQRCode && publicKey) {
      QRCode.toDataURL(publicKey, {
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      })
        .then((url) => {
          setQrCodeDataUrl(url);
        })
        .catch((err) => {
          console.error("Error generating QR code:", err);
        });
    }
  }, [showQRCode, publicKey]);

  const copyAddress = (address: string, type: "public" | "stealth") => {
    navigator.clipboard.writeText(address);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const generateNewStealth = () => {
    setStealthIndex((prev) => prev + 1);
  };

  const toggleQRCode = () => {
    setShowQRCode(!showQRCode);
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Receive">
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-center space-y-3">
              <p className="text-sm text-gray-400">Public Address</p>
              <p className="font-mono text-sm break-all">{publicKey}</p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => publicKey && copyAddress(publicKey, "public")}
                >
                  {copied === "public" ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Address
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleQRCode}
                  disabled={!publicKey}
                >
                  {showQRCode ? (
                    <>
                      <X className="h-4 w-4 mr-2" />
                      Hide QR
                    </>
                  ) : (
                    <>
                      <QrCode className="h-4 w-4 mr-2" />
                      Show QR
                    </>
                  )}
                </Button>
              </div>
              {showQRCode && qrCodeDataUrl && (
                <div className="flex justify-center pt-2">
                  <img
                    src={qrCodeDataUrl}
                    alt="Wallet Address QR Code"
                    className="border rounded-lg p-2 bg-white"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/50">
          <CardContent className="pt-4 pb-4">
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <p className="text-sm text-gray-400">Stealth Address</p>
              </div>
              <p className="font-mono text-sm break-all text-primary">
                {stealthAddress || "Generate a stealth address"}
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => stealthAddress && copyAddress(stealthAddress, "stealth")}
                  disabled={!stealthAddress}
                >
                  {copied === "stealth" ? (
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
                <Button variant="outline" size="sm" onClick={generateNewStealth}>
                  New Address
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-gray-500 pt-2">
          Use stealth addresses for enhanced privacy. Each address is unique and unlinkable.
        </p>
      </div>
    </Drawer>
  );
}

