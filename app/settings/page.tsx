"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWallet, truncateAddress } from "@/lib/wallet-context";
import { ExportDrawer } from "@/components/wallet/export-drawer";
import { keypairToBase58 } from "@/lib/wallet";
import { Shield, Key, Bell, Globe, HelpCircle, LogOut, Copy, Check, Lock, ChevronDown, Download } from "lucide-react";

export default function SettingsPage() {
  const { publicKey, lockWallet, derivedWallets, activeWalletIndex, switchWallet, mnemonic, getActiveKeypair } = useWallet();
  const [copied, setCopied] = useState(false);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [exportDrawerOpen, setExportDrawerOpen] = useState(false);
  const [exportType, setExportType] = useState<"mnemonic" | "privateKey" | null>(null);

  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportMnemonic = () => {
    setExportType("mnemonic");
    setExportDrawerOpen(true);
  };

  const handleExportPrivateKey = () => {
    setExportType("privateKey");
    setExportDrawerOpen(true);
  };

  const getExportData = (): string => {
    if (exportType === "mnemonic" && mnemonic) {
      return mnemonic;
    }
    if (exportType === "privateKey") {
      const keypair = getActiveKeypair();
      if (keypair) {
        return keypairToBase58(keypair);
      }
    }
    return "";
  };

const settingsSections = [
  {
    title: "Privacy",
    icon: Shield,
    items: [
      { label: "Auto-shield transactions", value: "Enabled" },
      { label: "Stealth addresses", value: "Enabled" },
      { label: "Private swaps", value: "Enabled" },
    ],
  },
  {
    title: "Security",
    icon: Key,
    items: [
        { 
          label: "Wallet address", 
          value: publicKey || "Not connected",
          copyable: true
        },
      { label: "Network", value: "Mainnet" },
        { label: "Derived accounts", value: `${derivedWallets.length} accounts` },
    ],
  },
  {
    title: "Preferences",
    icon: Bell,
    items: [
      { label: "Notifications", value: "Enabled" },
      { label: "Language", value: "English" },
    ],
  },
];

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-md">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-gray-400">
          Manage your wallet preferences and privacy settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Active Wallet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <button
            onClick={() => setShowWalletSelector(!showWalletSelector)}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
          >
            <div className="text-left">
              <p className="text-sm font-medium">Account {activeWalletIndex + 1}</p>
              <p className="text-xs text-gray-400 font-mono">
                {publicKey ? truncateAddress(publicKey, 8) : "..."}
              </p>
            </div>
            <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${showWalletSelector ? "rotate-180" : ""}`} />
          </button>

          {showWalletSelector && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {derivedWallets.map((wallet, index) => (
                <button
                  key={index}
                  onClick={() => {
                    switchWallet(index);
                    setShowWalletSelector(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    index === activeWalletIndex ? "bg-primary/20 border border-primary" : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  <div className="text-left">
                    <p className="text-sm font-medium">Account {index + 1}</p>
                    <p className="text-xs text-gray-400 font-mono">
                      {truncateAddress(wallet.publicKey, 8)}
                    </p>
                  </div>
                  {index === activeWalletIndex && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {settingsSections.map((section) => {
        const Icon = section.icon;
        return (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {section.items.map((item, index) => {
                const isAddress = item.label === "Wallet address";
                const displayValue = isAddress && item.value.length > 20
                  ? truncateAddress(item.value, 8)
                  : item.value;
                
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <span className="text-sm text-gray-400">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${isAddress ? "font-mono" : ""}`}>
                        {displayValue}
                    </span>
                      {"copyable" in item && item.copyable && publicKey && (
                        <button
                          onClick={copyAddress}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          {copied ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Export Wallet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleExportMnemonic}
            disabled={!mnemonic}
          >
            <Key className="h-4 w-4 mr-2" />
            Export Seed Phrase
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleExportPrivateKey}
            disabled={!getActiveKeypair()}
          >
            <Key className="h-4 w-4 mr-2" />
            Export Private Key
          </Button>
          <p className="text-xs text-gray-500 mt-2">
            Export your seed phrase or private key to backup or import into another wallet
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Button variant="outline" className="w-full justify-start">
          <HelpCircle className="h-4 w-4 mr-2" />
          Help & Support
        </Button>
        <Button variant="outline" className="w-full justify-start">
          <Globe className="h-4 w-4 mr-2" />
          About ShadeWallet
        </Button>
        <Button 
          variant="outline" 
          className="w-full justify-start"
          onClick={lockWallet}
        >
          <Lock className="h-4 w-4 mr-2" />
          Lock Wallet
        </Button>
        <Button 
          variant="outline" 
          className="w-full justify-start text-red-500 hover:text-red-600"
          onClick={lockWallet}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Disconnect Wallet
        </Button>
      </div>

      {exportType && (
        <ExportDrawer
          isOpen={exportDrawerOpen}
          onClose={() => {
            setExportDrawerOpen(false);
            setExportType(null);
          }}
          type={exportType}
          data={getExportData()}
          title={exportType === "mnemonic" ? "Export Seed Phrase" : "Export Private Key"}
        />
      )}
    </div>
  );
}
