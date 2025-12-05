"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { 
  Drawer,
  Button,
  Input,
  Card,
  CardContent,
  TokenIcon
 } from "@/components";
import { useWallet } from "@/lib/wallet-context";
import { Shield, Send, Copy, Check, X } from "lucide-react";
import { XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line } from "recharts";
import { truncateAddress } from "@/lib/wallet-context";
import { getMostLiquidPair, getOHLCVDataLastNDays, type OHLCVData } from "@/lib/moralis";
import {
  getCachedPriceDataAtom,
  setCachedPriceDataAtom,
  tokenDetailCopiedAtom,
  tokenDetailIsPrivateAtom,
  tokenDetailRecipientAddressAtom,
  tokenDetailAmountAtom,
  tokenDetailIsLoadingAtom,
  tokenDetailErrorAtom,
  tokenDetailHoveredPriceAtom,
  tokenDetailChartDataAtom,
  tokenDetailIsLoadingChartAtom,
} from "@/lib/atoms";
import {
  getCachedTokenPriceAtom,
  setCachedTokenPriceAtom,
  getTokenPrice,
} from "@/lib/jupiter-price";
import { formatPrice } from "@/lib/format-price";
import { SOL_MINT } from "@/lib/const";

interface TokenDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  token: {
    symbol: string;
    name: string;
    balance: string;
    usdValue: string;
    isShielded?: boolean;
    publicBalance?: string;
    privateBalance?: string;
    priceUsd?: number | null;
    imageUrl?: string | null;
    mint?: string;
  } | null;
}

interface ChartDataPoint {
  date: string;
  price: number;
}

const formatDate = (timestamp: string): string => {
  const date = new Date(timestamp);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[date.getDay()];
};

const processOHLCVData = (ohlcvData: OHLCVData[]): ChartDataPoint[] => {
  if (!ohlcvData || ohlcvData.length === 0) {
    return [];
  }

  // Calculate midpoint (average of high and low) for each data point
  return ohlcvData.map((point) => {
    const midpoint = (point.high + point.low) / 2;
    return {
      date: formatDate(point.timestamp),
      price: midpoint,
    };
  });
};

/**
 * Calculate optimal Y-axis domain with padding
 * Adds percentage padding above max and below min to make price changes more visible
 */
const calculateYAxisDomain = (data: ChartDataPoint[], paddingPercent: number = 8): [number, number] => {
  if (!data || data.length === 0) {
    return [0, 100];
  }

  const prices = data.map((d) => d.price).filter((p) => p > 0);
  if (prices.length === 0) {
    return [0, 100];
  }

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;

  // If all prices are the same, add a small range
  if (priceRange === 0) {
    const padding = minPrice * (paddingPercent / 100);
    return [minPrice - padding, minPrice + padding];
  }

  // Add percentage padding above and below
  const padding = priceRange * (paddingPercent / 100);
  const domainMin = Math.max(0, minPrice - padding); // Don't go below 0
  const domainMax = maxPrice + padding;

  return [domainMin, domainMax];
};

export function TokenDetailDrawer({
  isOpen,
  onClose,
  token,
}: TokenDetailDrawerProps) {
  const { sendPublic, sendPrivately, refreshBalances } = useWallet();
  const [copied, setCopied] = useAtom(tokenDetailCopiedAtom);
  const [isPrivate, setIsPrivate] = useAtom(tokenDetailIsPrivateAtom);
  const [recipientAddress, setRecipientAddress] = useAtom(tokenDetailRecipientAddressAtom);
  const [amount, setAmount] = useAtom(tokenDetailAmountAtom);
  const [isLoading, setIsLoading] = useAtom(tokenDetailIsLoadingAtom);
  const [error, setError] = useAtom(tokenDetailErrorAtom);
  const [hoveredPrice, setHoveredPrice] = useAtom(tokenDetailHoveredPriceAtom);
  const [chartData, setChartData] = useAtom(tokenDetailChartDataAtom);
  const [isLoadingChart, setIsLoadingChart] = useAtom(tokenDetailIsLoadingChartAtom);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  
  const getCachedPriceData = useAtomValue(getCachedPriceDataAtom);
  const setCachedPriceData = useSetAtom(setCachedPriceDataAtom);
  const getCachedTokenPrice = useAtomValue(getCachedTokenPriceAtom);
  const setCachedTokenPrice = useSetAtom(setCachedTokenPriceAtom);

  const displayPrice = hoveredPrice ?? currentPrice ?? token?.priceUsd ?? 0;

  // Calculate actual USD value from balance and price (to avoid rounding issues)
  const actualUsdValue = useMemo(() => {
    if (!token) return 0;
    const balanceNum = parseFloat(token.balance.replace(/,/g, ""));
    const price = displayPrice;
    return balanceNum * price;
  }, [token, displayPrice]);

  // Memoize Y-axis domain calculation
  const yAxisDomain = useMemo(() => {
    return calculateYAxisDomain(chartData);
  }, [chartData]);

  // Memoize mouse leave handler
  const handleMouseLeave = useCallback(() => {
    setHoveredPrice(null);
  }, [setHoveredPrice]);

  // Fetch OHLCV data when token changes (with caching)
  useEffect(() => {
    const fetchChartData = async () => {
      // console.log("[TokenDetailDrawer] fetchChartData called", { 
      //   hasToken: !!token, 
      //   symbol: token?.symbol,
      //   mint: token?.mint, 
      //   isOpen 
      // });
      
      const mintAddress = token?.symbol === "SOL" ? SOL_MINT : token?.mint;
      
      if (!mintAddress || !isOpen) {
        // console.log("[TokenDetailDrawer] Skipping fetch - no mint address or drawer closed", { mintAddress, isOpen });
        setChartData([]);
        return;
      }

      // Check cache first
      const cached = getCachedPriceData(mintAddress);
      if (cached) {
        // console.log("[TokenDetailDrawer] Using cached price data");
        const processedData = processOHLCVData(cached.data);
        setChartData(processedData);
        return;
      }

      // console.log("[TokenDetailDrawer] Starting to fetch chart data for mint:", mintAddress);
      setIsLoadingChart(true);
      try {
        // Get the most liquid pair for the token
        // console.log("[TokenDetailDrawer] Fetching most liquid pair...");
        const pair = await getMostLiquidPair(mintAddress, "mainnet");
        // console.log("[TokenDetailDrawer] Pair result:", pair);
        
        if (!pair || !pair.pairAddress) {
          // console.log("[TokenDetailDrawer] No pair found, using empty data");
          setChartData([]);
          return;
        }

        // console.log("[TokenDetailDrawer] Fetching OHLCV data for pair:", pair.pairAddress);
        // Get OHLCV data for the last 7 days with 4 hour timeframe (6 data points per day = 42 total)
        const ohlcvData = await getOHLCVDataLastNDays(
          pair.pairAddress,
          7,
          "4h",
          "usd",
          42,
          "mainnet"
        );
        // console.log("[TokenDetailDrawer] OHLCV data received:", ohlcvData);

        if (ohlcvData && ohlcvData.length > 0) {
          // Cache the data
          setCachedPriceData(mintAddress, ohlcvData, pair.pairAddress);
          
          const processedData = processOHLCVData(ohlcvData);
          // console.log("[TokenDetailDrawer] Processed chart data:", processedData);
          setChartData(processedData);
        } else {
          // console.log("[TokenDetailDrawer] No OHLCV data, using empty chart");
          setChartData([]);
        }
      } catch (err) {
        // console.error("[TokenDetailDrawer] Failed to fetch OHLCV data:", err);
        setChartData([]);
      } finally {
        setIsLoadingChart(false);
      }
    };

    fetchChartData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token?.mint, token?.symbol, isOpen]);

  // Fetch current price from Jupiter when token changes
  useEffect(() => {
    const fetchCurrentPrice = async () => {
      if (!token?.mint || !isOpen) {
        setCurrentPrice(null);
        return;
      }

      const mintAddress = token?.symbol === "SOL" ? SOL_MINT : token?.mint;

      if (!mintAddress) {
        setCurrentPrice(null);
        return;
      }

      const price = await getTokenPrice(mintAddress, getCachedTokenPrice, setCachedTokenPrice);
      setCurrentPrice(price);
    };

    fetchCurrentPrice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token?.mint, token?.symbol, isOpen]);

  const CustomTooltip = ({ active, payload }: any) => {
    useEffect(() => {
      if (active && payload && payload.length) {
        setHoveredPrice(payload[0].payload.price);
      } else {
        setHoveredPrice(null);
      }
    }, [active, payload]);

    return null;
  };

  const copyMint = () => {
    if (token?.mint) {
      navigator.clipboard.writeText(token.mint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Reset state when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setRecipientAddress("");
      setAmount("");
      setError("");
      setHoveredPrice(null);
    }
  }, [isOpen, setRecipientAddress, setAmount, setError, setHoveredPrice]);

  const handleSend = async () => {
    if (!token) return;
    if (!recipientAddress) {
      setError("Please enter a recipient address");
      return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    const maxBalance = parseFloat(token.balance.replace(/,/g, ""));
    if (amountNum > maxBalance) {
      setError("Insufficient balance");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      if (isPrivate) {
        await sendPrivately(recipientAddress, amountNum);
      } else {
        await sendPublic(recipientAddress, amountNum);
      }
      await refreshBalances();
      setRecipientAddress("");
      setAmount("");
      onClose();
    } catch (err) {
      setError("Transaction failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Drawer isOpen={isOpen && !!token} onClose={onClose}>
      {token && (
        <>
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-secondary border-b border-border pb-3 -mx-4 -mt-4 px-4 pt-4 mb-4">
            <div className="flex items-center gap-3">
              {token.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={token.imageUrl}
                  alt={token.symbol}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <TokenIcon symbol={token.symbol} className="h-12 w-12" />
              )}
              <div className="flex-1">
                <h2 className="text-lg font-bold">{token.name}</h2>
                <p className="text-sm text-gray-400">{token.symbol}</p>
                {token.mint && (
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs font-mono text-gray-500">
                      {truncateAddress(token.mint, 6)}
                    </p>
                    <button
                      onClick={copyMint}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-muted rounded-lg transition-colors flex-shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="space-y-4">

        <Card className="bg-secondary border-0 -mt-1">
          <CardContent className="">
            <div className="space-y-1 mb-4 text-center">
              <p className="text-3xl font-bold">
                ${formatPrice(displayPrice)}
              </p>
              <p className="text-xs text-gray-400">Price per token</p>
            </div>
            <div className="h-32 -mb-8 flex justify-center">
              {isLoadingChart ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-gray-400">Loading chart...</p>
                </div>
              ) : chartData.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-gray-400">No chart data available</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    onMouseLeave={handleMouseLeave}
                  >
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#9ca3af", fontSize: 10 }}
                    />
                    <YAxis
                      domain={yAxisDomain}
                      axisLine={false}
                      tickLine={false}
                      tick={false}
                      width={0}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#ff6b35"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: "#ff6b35" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="p-3 rounded-lg bg-muted/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Total Balance</span>
            <div className="text-right">
              <p className="text-sm font-semibold">{token.balance}</p>
              <p className="text-xs text-gray-400">${formatPrice(actualUsdValue)}</p>
            </div>
          </div>
          {(token.publicBalance || token.privateBalance) && (
            <div className="space-y-1 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Public</span>
                <p className="text-xs text-gray-400">{token.publicBalance || "0.0000"}</p>
              </div>
              {token.privateBalance && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Shield className="h-3 w-3 text-primary" />
                    <span className="text-xs text-gray-500">Private</span>
                  </div>
                  <p className="text-xs text-gray-400">{token.privateBalance}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4 pt-2">
          <div className="flex rounded-lg overflow-hidden border border-border">
            <button
              className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                isPrivate ? "bg-primary text-white" : "bg-muted text-gray-400"
              }`}
              onClick={() => setIsPrivate(true)}
            >
              <Shield className="h-4 w-4" />
              Private
            </button>
            <button
              className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                !isPrivate ? "bg-primary text-white" : "bg-muted text-gray-400"
              }`}
              onClick={() => setIsPrivate(false)}
            >
              <Send className="h-4 w-4" />
              Public
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400">Recipient Address</label>
            <Input
              type="text"
              placeholder="Enter Solana address"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-400">Amount</label>
              <button
                onClick={() =>
                  setAmount(token.balance.replace(/,/g, ""))
                }
                className="text-xs text-primary hover:underline"
              >
                Max: {token.balance}
              </button>
            </div>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleSend}
            disabled={!recipientAddress || !amount || isLoading}
          >
            {isPrivate ? (
              <Shield className="h-4 w-4 mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {isLoading
              ? "Sending..."
              : isPrivate
              ? "Send Privately"
              : "Send Publicly"}
          </Button>
        </div>
          </div>
        </>
      )}
    </Drawer>
  );
}

