"use client";

const MORALIS_API_KEY = process.env.NEXT_PUBLIC_MORALIS_API_KEY || "";
const MORALIS_BASE_URL = "https://solana-gateway.moralis.io";

export interface TokenPair {
  exchangeAddress: string;
  exchangeName: string;
  exchangeLogo: string;
  pairAddress: string;
  pairLabel: string;
  usdPrice: number;
  usdPrice24hrPercentChange: number;
  usdPrice24hrUsdChange: number;
  volume24hrNative: number;
  volume24hrUsd: number;
  liquidityUsd: number;
  baseToken: string;
  quoteToken: string;
  inactivePair: boolean;
  pair: Array<{
    tokenAddress: string;
    tokenName: string;
    tokenSymbol: string;
    tokenLogo: string;
    tokenDecimals: string;
    pairTokenType: "token0" | "token1";
    liquidityUsd: number;
  }>;
}

export interface TokenPairsResponse {
  pairs: TokenPair[];
  pageSize: number;
  page: number;
  cursor?: string;
}

export interface OHLCVData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OHLCVResponse {
  result: OHLCVData[];
}

/**
 * Get token pairs for a given token address
 * @param tokenAddress - The token mint address
 * @param network - Network (mainnet or devnet), defaults to mainnet
 * @param limit - Maximum number of pairs to return, defaults to 25
 * @returns Array of token pairs
 */
export async function getTokenPairs(
  tokenAddress: string,
  network: "mainnet" | "devnet" = "mainnet",
  limit: number = 25
): Promise<TokenPair[]> {
  console.log("[Moralis] getTokenPairs called", { tokenAddress, network, limit, hasApiKey: !!MORALIS_API_KEY });
  
  if (!MORALIS_API_KEY || MORALIS_API_KEY.trim() === "") {
    console.warn("[Moralis] API key not configured. Token pairs unavailable.");
    return [];
  }

  const url = `${MORALIS_BASE_URL}/token/${network}/${tokenAddress}/pairs?limit=${limit}`;
  console.log("[Moralis] Fetching token pairs from:", url);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "X-API-Key": MORALIS_API_KEY,
      },
    });

    console.log("[Moralis] Token pairs response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Moralis] Token pairs API error:", response.status, errorText);
      throw new Error(`Moralis API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("[Moralis] Token pairs data:", data);
    // Moralis returns { pairs: [...] } not { result: [...] }
    return data.pairs || [];
  } catch (error) {
    console.error("[Moralis] Failed to get token pairs:", error);
    return [];
  }
}

/**
 * Get OHLCV (Open, High, Low, Close, Volume) data for a token pair
 * @param pairAddress - The pair address
 * @param fromDate - Start date in ISO format (e.g., "2025-08-01T00:00:00Z")
 * @param toDate - End date in ISO format (e.g., "2025-08-10T00:00:00Z")
 * @param timeframe - Timeframe (1m, 5m, 15m, 30m, 1h, 4h, 1d), defaults to "1h"
 * @param currency - Currency for prices (usd, eur, etc.), defaults to "usd"
 * @param limit - Maximum number of data points, defaults to 100
 * @param network - Network (mainnet or devnet), defaults to mainnet
 * @returns Array of OHLCV data points
 */
export async function getOHLCVData(
  pairAddress: string,
  fromDate: string,
  toDate: string,
  timeframe: "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" = "1h",
  currency: string = "usd",
  limit: number = 100,
  network: "mainnet" | "devnet" = "mainnet"
): Promise<OHLCVData[]> {
  console.log("[Moralis] getOHLCVData called", { pairAddress, fromDate, toDate, timeframe, hasApiKey: !!MORALIS_API_KEY });
  
  if (!MORALIS_API_KEY || MORALIS_API_KEY.trim() === "") {
    console.warn("[Moralis] API key not configured. OHLCV data unavailable.");
    return [];
  }

  try {
    // URL encode the dates
    const encodedFromDate = encodeURIComponent(fromDate);
    const encodedToDate = encodeURIComponent(toDate);

    const url = `${MORALIS_BASE_URL}/token/${network}/pairs/${pairAddress}/ohlcv?fromDate=${encodedFromDate}&toDate=${encodedToDate}&timeframe=${timeframe}&currency=${currency}&limit=${limit}`;
    console.log("[Moralis] Fetching OHLCV data from:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "X-API-Key": MORALIS_API_KEY,
      },
    });

    console.log("[Moralis] OHLCV response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Moralis] OHLCV API error:", response.status, errorText);
      throw new Error(`Moralis API error: ${response.status} ${response.statusText}`);
    }

    const data: OHLCVResponse = await response.json();
    console.log("[Moralis] OHLCV data received:", data);
    return data.result || [];
  } catch (error) {
    console.error("[Moralis] Failed to get OHLCV data:", error);
    return [];
  }
}

/**
 * Get OHLCV data for the last N days
 * @param pairAddress - The pair address
 * @param days - Number of days to look back, defaults to 7
 * @param timeframe - Timeframe for data points, defaults to "1h"
 * @param currency - Currency for prices, defaults to "usd"
 * @param limit - Maximum number of data points, defaults to 100
 * @param network - Network (mainnet or devnet), defaults to mainnet
 * @returns Array of OHLCV data points
 */
export async function getOHLCVDataLastNDays(
  pairAddress: string,
  days: number = 7,
  timeframe: "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" = "1h",
  currency: string = "usd",
  limit: number = 100,
  network: "mainnet" | "devnet" = "mainnet"
): Promise<OHLCVData[]> {
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const fromDateISO = fromDate.toISOString();
  const toDateISO = toDate.toISOString();

  return getOHLCVData(
    pairAddress,
    fromDateISO,
    toDateISO,
    timeframe,
    currency,
    limit,
    network
  );
}

/**
 * Get the most liquid pair for a token (usually the main trading pair)
 * @param tokenAddress - The token mint address
 * @param network - Network (mainnet or devnet), defaults to mainnet
 * @returns The most liquid token pair, or null if none found
 */
export async function getMostLiquidPair(
  tokenAddress: string,
  network: "mainnet" | "devnet" = "mainnet"
): Promise<TokenPair | null> {
  console.log("[Moralis] getMostLiquidPair called", { tokenAddress, network });
  const pairs = await getTokenPairs(tokenAddress, network, 25);
  console.log("[Moralis] getMostLiquidPair - pairs received:", pairs.length);
  
  if (pairs.length === 0) {
    console.log("[Moralis] getMostLiquidPair - no pairs found");
    return null;
  }

  // Sort by liquidity (if available) or return the first pair
  const sortedPairs = pairs.sort((a, b) => {
    const liquidityA = a.liquidityUsd || 0;
    const liquidityB = b.liquidityUsd || 0;
    return liquidityB - liquidityA;
  });

  console.log("[Moralis] getMostLiquidPair - selected pair:", sortedPairs[0]);
  return sortedPairs[0];
}

