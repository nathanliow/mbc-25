"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Key, Bell, Globe, HelpCircle, LogOut } from "lucide-react";

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
      { label: "Wallet address", value: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" },
      { label: "Network", value: "Devnet" },
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

export default function SettingsPage() {
  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-md">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-gray-400">
          Manage your wallet preferences and privacy settings
        </p>
      </div>

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
                const truncatedValue = isAddress && item.value.length > 20
                  ? `${item.value.slice(0, 8)}...${item.value.slice(-6)}`
                  : item.value;
                
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <span className="text-sm text-gray-400">{item.label}</span>
                    <span className={`text-sm font-medium ${isAddress ? "truncate max-w-[140px] ml-2" : ""}`}>
                      {truncatedValue}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      <div className="space-y-3">
        <Button variant="outline" className="w-full justify-start">
          <HelpCircle className="h-4 w-4 mr-2" />
          Help & Support
        </Button>
        <Button variant="outline" className="w-full justify-start">
          <Globe className="h-4 w-4 mr-2" />
          About ShadeWallet
        </Button>
        <Button variant="outline" className="w-full justify-start text-red-500 hover:text-red-600">
          <LogOut className="h-4 w-4 mr-2" />
          Disconnect Wallet
        </Button>
      </div>
    </div>
  );
}

