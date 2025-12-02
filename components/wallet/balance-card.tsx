"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from "recharts";

interface BalanceCardProps {
  balance: string;
  token: string;
  isShielded?: boolean;
  usdValue?: string;
  publicBalance?: string;
  privateBalance?: string;
  chartData?: Array<{ date: string; value: number; publicBalance?: number; privateBalance?: number }>;
}

const defaultChartData = [
  { date: "Mon", value: 10.2, publicBalance: 2.0, privateBalance: 8.2 },
  { date: "Tue", value: 11.5, publicBalance: 2.2, privateBalance: 9.3 },
  { date: "Wed", value: 10.8, publicBalance: 2.1, privateBalance: 8.7 },
  { date: "Thu", value: 12.1, publicBalance: 2.3, privateBalance: 9.8 },
  { date: "Fri", value: 11.9, publicBalance: 2.3, privateBalance: 9.6 },
  { date: "Sat", value: 12.3, publicBalance: 2.4, privateBalance: 9.9 },
  { date: "Sun", value: 12.5, publicBalance: 2.5, privateBalance: 10.0 },
];

export function BalanceCard({ 
  balance, 
  token, 
  isShielded = false, 
  usdValue,
  publicBalance,
  privateBalance,
  chartData = defaultChartData 
}: BalanceCardProps) {
  // Get the latest value from chart data
  const latestValue = chartData[chartData.length - 1]?.value || 0;
  const latestPublic = chartData[chartData.length - 1]?.publicBalance ?? parseFloat(publicBalance?.replace(/,/g, "") || "0");
  const latestPrivate = chartData[chartData.length - 1]?.privateBalance ?? parseFloat(privateBalance?.replace(/,/g, "") || "0");
  
  const [hoveredValue, setHoveredValue] = useState<number | null>(null);
  const [hoveredPublic, setHoveredPublic] = useState<number | null>(null);
  const [hoveredPrivate, setHoveredPrivate] = useState<number | null>(null);
  
  // Use hovered value if available, otherwise use latest value
  const displayValue = hoveredValue ?? latestValue;
  const displayPublic = hoveredPublic ?? latestPublic;
  const displayPrivate = hoveredPrivate ?? latestPrivate;
  
  // Convert to USD (assuming 1 SOL = $100 for mock data)
  const displayUsdValue = (displayValue * 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const displayPublicUsd = (displayPublic * 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const displayPrivateUsd = (displayPrivate * 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const CustomTooltip = ({ active, payload }: any) => {
    useEffect(() => {
      if (active && payload && payload.length) {
        const data = payload[0].payload;
        setHoveredValue(data.value);
        setHoveredPublic(data.publicBalance ?? null);
        setHoveredPrivate(data.privateBalance ?? null);
      } else {
        setHoveredValue(null);
        setHoveredPublic(null);
        setHoveredPrivate(null);
      }
    }, [active, payload]);
    
    return null;
  };

  return (
    <Card className="bg-background border-0">
      <CardContent className="">
        {/* <div className="flex items-center justify-between mb-2">
          {isShielded && (
            <div className="flex items-center gap-1 text-primary">
              <Shield className="h-4 w-4" />
              <span className="text-xs font-medium">Shielded</span>
            </div>
          )}
        </div> */}
        <div className="space-y-1 mb-4 text-center">
          <p className="text-3xl font-bold">${displayUsdValue}</p>
          {(publicBalance !== undefined || privateBalance !== undefined || hoveredPublic !== null || hoveredPrivate !== null) && (
            <div className="flex items-center justify-center gap-3 text-xs text-gray-400">
              {(hoveredPublic !== null || publicBalance !== undefined) && (
                <span>Public: ${displayPublicUsd}</span>
              )}
              {(hoveredPrivate !== null || privateBalance !== undefined) && (
                <span>Private: ${displayPrivateUsd}</span>
              )}
            </div>
          )}
        </div>
        <div className="h-32 -mb-6 flex justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={chartData}
              onMouseLeave={() => {
                setHoveredValue(null);
                setHoveredPublic(null);
                setHoveredPrivate(null);
              }}
            >
              <defs>
                <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff6b35" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#ff6b35" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#9ca3af', fontSize: 10 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#ff6b35"
                strokeWidth={2}
                fill="url(#balanceGradient)"
                dot={false}
                activeDot={{ r: 4, fill: '#ff6b35' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

