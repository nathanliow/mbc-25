"use client";

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

// ============================================================================
// Price Cache Configuration
// ============================================================================
// Cache TTL in milliseconds (1 minute by default)
export const PRICE_CACHE_TTL_MS = 60 * 1000; // 1 minute
// Change this to adjust cache duration:
// export const PRICE_CACHE_TTL_MS = 30 * 1000; // 30 seconds
// export const PRICE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// Price Cache Atoms
// ============================================================================

interface CachedTokenPrice {
  price: number;
  timestamp: number;
}

// Atom to store cached token prices by mint address (persisted in localStorage)
const tokenPriceCacheAtom = atomWithStorage<Record<string, CachedTokenPrice>>(
  "jupiter_price_cache",
  {},
  {
    getItem: (key, initialValue) => {
      if (typeof window === "undefined") return initialValue;
      try {
        const item = localStorage.getItem(key);
        if (!item) return initialValue;
        const parsed = JSON.parse(item) as Record<string, CachedTokenPrice>;
        // Clean expired entries on load
        const now = Date.now();
        const cleaned: Record<string, CachedTokenPrice> = {};
        for (const [mint, cached] of Object.entries(parsed)) {
          if (cached && typeof cached === "object" && "timestamp" in cached && (now - cached.timestamp) < PRICE_CACHE_TTL_MS) {
            cleaned[mint] = cached;
          }
        }
        return cleaned;
      } catch {
        return initialValue;
      }
    },
    setItem: (key, value) => {
      if (typeof window === "undefined") return;
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.error("[Cache] Failed to save to localStorage:", error);
      }
    },
    removeItem: (key) => {
      if (typeof window === "undefined") return;
      localStorage.removeItem(key);
    },
  }
);

// Helper function to check if cached price is still valid
const isPriceCacheValid = (cached: CachedTokenPrice | undefined): boolean => {
  if (!cached) return false;
  const now = Date.now();
  return (now - cached.timestamp) < PRICE_CACHE_TTL_MS;
};

// Atom to get cached price for a token
export const getCachedTokenPriceAtom = atom(
  (get) => (mintAddress: string): number | null => {
    const cache = get(tokenPriceCacheAtom);
    const cached: CachedTokenPrice | undefined = cache[mintAddress];
    if (cached && isPriceCacheValid(cached)) {
      return cached.price;
    }
    return null;
  }
);

// Atom to set cached price for a token
export const setCachedTokenPriceAtom = atom(
  null,
  (get, set, mintAddress: string, price: number) => {
    const cache = get(tokenPriceCacheAtom);
    const newCache = { ...cache };
    newCache[mintAddress] = {
      price,
      timestamp: Date.now(),
    };
    set(tokenPriceCacheAtom, newCache);
  }
);

// ============================================================================
// Jupiter Lite API Integration
// ============================================================================

const JUPITER_LITE_API_URL = "https://lite-api.jup.ag/price/v3";

/**
 * Fetch token price from Jupiter Lite API
 * @param mintAddress - The token mint address
 * @returns Price in USD, or null if not found
 */
export async function fetchTokenPriceFromJupiter(
  mintAddress: string
): Promise<number | null> {
  try {
    const response = await fetch(`${JUPITER_LITE_API_URL}?ids=${mintAddress}`);
    
    if (!response.ok) {
      console.error("[Jupiter] Price API error:", response.status, response.statusText);
      return null;
    }

    const priceData = await response.json();
    
    // Extract price (Jupiter returns { [mint]: { usdPrice: number } })
    const tokenData = priceData[mintAddress];
    if (!tokenData || typeof tokenData.usdPrice !== "number") {
      console.warn("[Jupiter] No price data for mint:", mintAddress);
      return null;
    }

    return tokenData.usdPrice;
  } catch (error) {
    console.error("[Jupiter] Failed to fetch token price:", error);
    return null;
  }
}

/**
 * Get token price with caching
 * Checks cache first, then fetches from Jupiter if needed
 * @param mintAddress - The token mint address
 * @param getCachedPrice - Function to get cached price
 * @param setCachedPrice - Function to set cached price
 * @returns Price in USD, or null if not found
 */
export async function getTokenPrice(
  mintAddress: string,
  getCachedPrice: (mint: string) => number | null,
  setCachedPrice: (mint: string, price: number) => void
): Promise<number | null> {
  // Check cache first
  const cachedPrice = getCachedPrice(mintAddress);
  if (cachedPrice !== null) {
    console.log("[Jupiter] Using cached price for", mintAddress, ":", cachedPrice);
    return cachedPrice;
  }

  // Fetch from Jupiter
  console.log("[Jupiter] Fetching price for", mintAddress);
  const price = await fetchTokenPriceFromJupiter(mintAddress);
  
  if (price !== null) {
    // Cache the price
    setCachedPrice(mintAddress, price);
    console.log("[Jupiter] Cached price for", mintAddress, ":", price);
  }

  return price;
}

/**
 * Fetch prices for multiple tokens at once
 * @param mintAddresses - Array of token mint addresses
 * @returns Map of mint address to price
 */
export async function fetchMultipleTokenPrices(
  mintAddresses: string[]
): Promise<Map<string, number>> {
  if (mintAddresses.length === 0) {
    return new Map();
  }

  try {
    const ids = mintAddresses.join(",");
    const response = await fetch(`${JUPITER_LITE_API_URL}?ids=${ids}`);
    
    if (!response.ok) {
      console.error("[Jupiter] Price API error:", response.status, response.statusText);
      return new Map();
    }

    const priceData = await response.json();
    const priceMap = new Map<string, number>();

    for (const mintAddress of mintAddresses) {
      const tokenData = priceData[mintAddress];
      if (tokenData && typeof tokenData.usdPrice === "number") {
        priceMap.set(mintAddress, tokenData.usdPrice);
      }
    }

    return priceMap;
  } catch (error) {
    console.error("[Jupiter] Failed to fetch token prices:", error);
    return new Map();
  }
}

