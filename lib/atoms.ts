"use client";

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { OHLCVData } from "./moralis";

// ============================================================================
// Price Data Cache Configuration
// ============================================================================
// Cache TTL in milliseconds (24 hours by default)
export const PRICE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
// Change this to adjust cache duration:
// export const PRICE_CACHE_TTL_MS = 1 * 60 * 60 * 1000; // 1 hour
// export const PRICE_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// ============================================================================
// Price Data Cache Atoms
// ============================================================================

interface CachedPriceData {
  data: OHLCVData[];
  timestamp: number;
  pairAddress: string;
}

// Atom to store cached price data by token mint address (persisted in localStorage)
const priceCacheAtom = atomWithStorage<Record<string, CachedPriceData>>(
  "ohlcv_price_cache",
  {},
  {
    getItem: (key, initialValue) => {
      if (typeof window === "undefined") return initialValue;
      try {
        const item = localStorage.getItem(key);
        if (!item) return initialValue;
        const parsed = JSON.parse(item) as Record<string, CachedPriceData>;
        // Clean expired entries on load
        const now = Date.now();
        const cleaned: Record<string, CachedPriceData> = {};
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

// Helper function to check if cached data is still valid
const isCacheValid = (cached: CachedPriceData | undefined): boolean => {
  if (!cached) return false;
  const now = Date.now();
  return (now - cached.timestamp) < PRICE_CACHE_TTL_MS;
};

// Atom to get cached price data for a token
export const getCachedPriceDataAtom = atom(
  (get) => (mintAddress: string): CachedPriceData | null => {
    const cache = get(priceCacheAtom);
    const cached: CachedPriceData | undefined = cache[mintAddress];
    if (cached && isCacheValid(cached)) {
      return cached;
    }
    return null;
  }
);

// Atom to set cached price data for a token
export const setCachedPriceDataAtom = atom(
  null,
  (get, set, mintAddress: string, data: OHLCVData[], pairAddress: string) => {
    const cache = get(priceCacheAtom);
    const newCache = { ...cache };
    newCache[mintAddress] = {
      data,
      timestamp: Date.now(),
      pairAddress,
    };
    set(priceCacheAtom, newCache);
  }
);

// Atom to clear expired cache entries
export const clearExpiredCacheAtom = atom(null, (get, set) => {
  const cache = get(priceCacheAtom);
  const newCache: Record<string, CachedPriceData> = {};
  const now = Date.now();
  
  for (const [key, value] of Object.entries(cache)) {
    if ((now - value.timestamp) < PRICE_CACHE_TTL_MS) {
      newCache[key] = value;
    }
  }
  
  set(priceCacheAtom, newCache);
});

// ============================================================================
// UI State Atoms
// ============================================================================

// Wallet page state
export const activeTabAtom = atom<string>("tokens");
export const isSendDrawerOpenAtom = atom<boolean>(false);
export const isDepositDrawerOpenAtom = atom<boolean>(false);
export const isTokenDetailOpenAtom = atom<boolean>(false);
export const selectedTokenAtom = atom<{
  symbol: string;
  name: string;
  balance: string;
  usdValue: string;
  isShielded?: boolean;
  priceUsd?: number | null;
  imageUrl?: string | null;
  mint?: string;
} | null>(null);

// Swap form state
export const swapFromTokenAtom = atom<any>(null);
export const swapToTokenAtom = atom<any>(null);
export const swapFromAmountAtom = atom<string>("");
export const swapToAmountAtom = atom<string>("");
export const swapIsPrivateAtom = atom<boolean>(true);
export const swapLastEditedAtom = atom<"from" | "to" | null>(null);

// Send drawer state
export const sendSelectedTokenAtom = atom<any>(null);
export const sendShowTokenListAtom = atom<boolean>(false);
export const sendRecipientAddressAtom = atom<string>("");
export const sendAmountAtom = atom<string>("");
export const sendIsPrivateAtom = atom<boolean>(true);
export const sendIsLoadingAtom = atom<boolean>(false);
export const sendErrorAtom = atom<string>("");

// Token detail drawer state
export const tokenDetailCopiedAtom = atom<boolean>(false);
export const tokenDetailIsPrivateAtom = atom<boolean>(true);
export const tokenDetailRecipientAddressAtom = atom<string>("");
export const tokenDetailAmountAtom = atom<string>("");
export const tokenDetailIsLoadingAtom = atom<boolean>(false);
export const tokenDetailErrorAtom = atom<string>("");
export const tokenDetailHoveredPriceAtom = atom<number | null>(null);
export const tokenDetailChartDataAtom = atom<any[]>([]);
export const tokenDetailIsLoadingChartAtom = atom<boolean>(false);

// Receive drawer state
export const receiveCopiedAtom = atom<"public" | "stealth" | null>(null);
export const receiveStealthIndexAtom = atom<number>(0);
export const receiveShowQRCodeAtom = atom<boolean>(false);
export const receiveQRCodeDataUrlAtom = atom<string | null>(null);

// Deposit drawer state
export const depositAmountAtom = atom<string>("");
export const depositIsLoadingAtom = atom<boolean>(false);
export const depositErrorAtom = atom<string>("");

// Export drawer state
export const exportShowPrivateKeyAtom = atom<boolean>(false);
export const exportPasswordAtom = atom<string>("");
export const exportErrorAtom = atom<string>("");
export const exportIsLoadingAtom = atom<boolean>(false);

// Wallet setup state (persisted in localStorage)
export const walletSetupStepAtom = atomWithStorage<"choice" | "create" | "import" | "backup" | "confirm">(
  "wallet_setup_step",
  "choice"
);
export const walletSetupPasswordAtom = atom<string>("");
export const walletSetupConfirmPasswordAtom = atom<string>("");
export const walletSetupShowPasswordAtom = atom<boolean>(false);
export const walletSetupMnemonicAtom = atom<string>("");
export const walletSetupImportMnemonicAtom = atom<string>("");
export const walletSetupErrorAtom = atom<string>("");
export const walletSetupIsLoadingAtom = atom<boolean>(false);
export const walletSetupCopiedAtom = atom<boolean>(false);
export const walletSetupBackupConfirmedAtom = atom<boolean>(false);

// Wallet unlock state
export const walletUnlockPasswordAtom = atom<string>("");
export const walletUnlockShowPasswordAtom = atom<boolean>(false);
export const walletUnlockErrorAtom = atom<string>("");
export const walletUnlockIsLoadingAtom = atom<boolean>(false);

// ============================================================================
// Wallet holdings (SOL + SPL) snapshot for UI
// ============================================================================

export interface WalletHolding {
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
}

export const walletHoldingsAtom = atom<WalletHolding[]>([]);

export interface ActivityTransaction {
  signature: string;
  slot: number;
  blockTime: number | null;
  amount: number;
  direction: "send" | "receive" | "swap";
  token: string;
  mint?: string;
  tokenName?: string;
  from: string;
  to: string;
  isPrivate?: boolean;
  // For swap transactions
  fromToken?: string;
  fromAmount?: number;
  fromMint?: string;
  toToken?: string;
  toAmount?: number;
  toMint?: string;
}

interface CachedActivityTransaction {
  tx: ActivityTransaction;
  timestamp: number;
}

const ACTIVITY_TX_TTL_MS = 10 * 60 * 1000; // 10 minutes

const activityTxCacheAtom = atomWithStorage<Record<string, CachedActivityTransaction>>(
  "activity_tx_cache",
  {},
  {
    getItem: (key, initialValue) => {
      if (typeof window === "undefined") return initialValue;
      try {
        const item = localStorage.getItem(key);
        if (!item) return initialValue;
        const parsed = JSON.parse(item) as Record<string, CachedActivityTransaction>;
        const now = Date.now();
        const cleaned: Record<string, CachedActivityTransaction> = {};
        for (const [sig, cached] of Object.entries(parsed)) {
          if (
            cached &&
            typeof cached === "object" &&
            "timestamp" in cached &&
            (now - cached.timestamp) < ACTIVITY_TX_TTL_MS
          ) {
            cleaned[sig] = cached;
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
        console.error("[ActivityCache] Failed to save to localStorage:", error);
      }
    },
    removeItem: (key) => {
      if (typeof window === "undefined") return;
      localStorage.removeItem(key);
    },
  }
);

export const getCachedActivityTxAtom = atom(
  (get) => (signature: string): ActivityTransaction | null => {
    const cache = get(activityTxCacheAtom);
    const cached = cache[signature];
    if (!cached) return null;
    const now = Date.now();
    if ((now - cached.timestamp) >= ACTIVITY_TX_TTL_MS) {
      return null;
    }
    return cached.tx;
  }
);

export const setCachedActivityTxAtom = atom(
  null,
  (get, set, signature: string, tx: ActivityTransaction) => {
    const cache = get(activityTxCacheAtom);
    const newCache: Record<string, CachedActivityTransaction> = {
      ...cache,
      [signature]: {
        tx,
        timestamp: Date.now(),
      },
    };
    set(activityTxCacheAtom, newCache);
  }
);

// Simple token metadata cache for activity view
export interface ActivityTokenMeta {
  mint: string;
  symbol: string;
  name: string;
}

interface CachedActivityTokenMeta {
  meta: ActivityTokenMeta;
  timestamp: number;
}

const ACTIVITY_TOKEN_META_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const activityTokenMetaCacheAtom = atomWithStorage<Record<string, CachedActivityTokenMeta>>(
  "activity_token_meta_cache",
  {},
  {
    getItem: (key, initialValue) => {
      if (typeof window === "undefined") return initialValue;
      try {
        const item = localStorage.getItem(key);
        if (!item) return initialValue;
        const parsed = JSON.parse(item) as Record<string, CachedActivityTokenMeta>;
        const now = Date.now();
        const cleaned: Record<string, CachedActivityTokenMeta> = {};
        for (const [mint, cached] of Object.entries(parsed)) {
          if (
            cached &&
            typeof cached === "object" &&
            "timestamp" in cached &&
            (now - cached.timestamp) < ACTIVITY_TOKEN_META_TTL_MS
          ) {
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
        console.error("[ActivityTokenMetaCache] Failed to save to localStorage:", error);
      }
    },
    removeItem: (key) => {
      if (typeof window === "undefined") return;
      localStorage.removeItem(key);
    },
  }
);

export const getCachedActivityTokenMetaAtom = atom(
  (get) => (mint: string): ActivityTokenMeta | null => {
    const cache = get(activityTokenMetaCacheAtom);
    const cached = cache[mint];
    if (!cached) return null;
    const now = Date.now();
    if ((now - cached.timestamp) >= ACTIVITY_TOKEN_META_TTL_MS) {
      return null;
    }
    return cached.meta;
  }
);

export const setCachedActivityTokenMetaAtom = atom(
  null,
  (get, set, mint: string, meta: ActivityTokenMeta) => {
    const cache = get(activityTokenMetaCacheAtom);
    const newCache: Record<string, CachedActivityTokenMeta> = {
      ...cache,
      [mint]: {
        meta,
        timestamp: Date.now(),
      },
    };
    set(activityTokenMetaCacheAtom, newCache);
  }
);

