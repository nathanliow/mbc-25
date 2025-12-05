const HELIUS_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "";

export interface ParsedTokenAccount {
  mint: string;
  owner: string;
  amount: string;
  decimals: number;
  uiAmount: number;
  uiAmountString: string;
}

interface HeliusTokenAmount {
  amount: string;
  decimals: number;
  uiAmount: number;
  uiAmountString: string;
}

interface HeliusParsedInfo {
  mint: string;
  owner: string;
  tokenAmount: HeliusTokenAmount;
}

interface HeliusTokenAccountResponse {
  result: {
    value:
      | Array<{
          account: {
            data: {
              parsed: {
                info: HeliusParsedInfo;
              };
            };
          };
        }>
      | {
          accounts: Array<{
            pubkey: string;
            account: {
              data: {
                program?: string;
                parsed: {
                  info: HeliusParsedInfo;
                };
              };
            };
          }>;
          paginationKey?: string | null;
          count?: number;
        };
  };
}

interface HeliusGetAssetResponse {
  result?: {
    token_info?: {
      price_info?: {
        price_per_token: number;
      };
      supply: number;
      decimals: number;
    };
  };
}

interface HeliusGetAssetBatchResponse {
  result?: HeliusAsset[];
}

export interface HeliusAsset {
  id: string;
  content?: {
    metadata?: {
      name?: string;
      symbol?: string;
      description?: string;
      [key: string]: unknown;
    };
    links?: {
      image?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  token_info?: {
    supply: number;
    decimals: number;
    price_info?: {
      price_per_token: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export async function fetchSplTokensByOwner(
  ownerAddress: string,
  opts?: { changedSinceSlot?: number }
): Promise<ParsedTokenAccount[]> {
  const all: ParsedTokenAccount[] = [];
  let paginationKey: string | null | undefined = undefined;

  if (!HELIUS_RPC_URL) {
    console.warn(
      "[Helius] NEXT_PUBLIC_RPC_URL is not set. Skipping SPL token fetch and returning empty list."
    );
    return all;
  }

  if (!ownerAddress) {
    console.warn("[Helius] fetchSplTokensByOwner called without ownerAddress");
    return all;
  }

  console.log("[Helius] Fetching SPL token accounts for", ownerAddress, "with opts:", opts);

  do {
    const body: any = {
      jsonrpc: "2.0",
      id: "1",
      method: "getTokenAccountsByOwnerV2",
      params: [
        ownerAddress,
        { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        {
          encoding: "jsonParsed",
          limit: 1000,
        },
      ],
    };

    if (paginationKey) {
      body.params[2].paginationKey = paginationKey;
    }

    if (opts?.changedSinceSlot !== undefined) {
      body.params[2].changedSinceSlot = opts.changedSinceSlot;
    }

    let data: HeliusTokenAccountResponse;
    try {
      const res = await fetch(HELIUS_RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        console.error(
          "[Helius] SPL token fetch error:",
          res.status,
          res.statusText
        );
        break;
      }

      data = (await res.json()) as HeliusTokenAccountResponse;
    } catch (e) {
      console.error("[Helius] Error fetching SPL token accounts:", e);
      break;
    }

    const rawValue = data.result?.value as
      | Array<{
          account: { data: { parsed: { info: HeliusParsedInfo } } };
        }>
      | {
          accounts: Array<{
            pubkey: string;
            account: { data: { parsed: { info: HeliusParsedInfo } } };
          }>;
          paginationKey?: string | null;
          count?: number;
        }
      | undefined;

    let accountsArray: Array<{
      account: { data: { parsed: { info: HeliusParsedInfo } } };
    }> = [];

    if (Array.isArray(rawValue)) {
      // Older style: value is an array of accounts
      accountsArray = rawValue;
      paginationKey = undefined;
    } else if (rawValue && Array.isArray((rawValue as any).accounts)) {
      // New style: value.accounts holds the array
      accountsArray = (rawValue as any).accounts;
      paginationKey = (rawValue as any).paginationKey ?? null;
    } else {
      console.warn("[Helius] Unexpected token accounts response shape:", rawValue);
      paginationKey = null;
      break;
    }

    console.log("[Helius] Received", accountsArray.length, "token accounts in page");

    for (const item of accountsArray) {
      const info = item.account?.data?.parsed?.info;
      if (!info || !info.tokenAmount) continue;

      const tokenAmount = info.tokenAmount;

      all.push({
        mint: info.mint,
        owner: info.owner,
        amount: tokenAmount.amount,
        decimals: tokenAmount.decimals,
        uiAmount: tokenAmount.uiAmount,
        uiAmountString: tokenAmount.uiAmountString,
      });
    }

  } while (paginationKey);

  console.log("[Helius] Total SPL token accounts fetched:", all.length);
  return all;
}

export async function fetchTokenPriceData(mint: string): Promise<{
  priceUsd: number | null;
  marketCapUsd: number | null;
}> {
  if (!mint) {
    return { priceUsd: null, marketCapUsd: null };
  }

  const body = {
    jsonrpc: "2.0",
    id: "1",
    method: "getAsset",
    params: {
      id: mint,
      displayOptions: {
        showFungibleTokens: true,
      },
    },
  };

  console.log("[Helius] Fetching price data for mint:", mint);

  let data: HeliusGetAssetResponse;
  try {
    const res = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("[Helius] getAsset error:", res.status, res.statusText);
      return { priceUsd: null, marketCapUsd: null };
    }

    data = (await res.json()) as HeliusGetAssetResponse;
  } catch (e) {
    console.error("[Helius] Network/parse error in getAsset for", mint, e);
    return { priceUsd: null, marketCapUsd: null };
  }
  const priceInfo = data.result?.token_info?.price_info;
  const tokenInfo = data.result?.token_info;

  if (!priceInfo || !tokenInfo) {
    console.warn("[Helius] No price_info/token_info for mint", mint);
    return { priceUsd: null, marketCapUsd: null };
  }

  const price = priceInfo.price_per_token;
  const supply = tokenInfo.supply;
  const decimals = tokenInfo.decimals;

  const adjustedSupply = supply / Math.pow(10, decimals);
  const marketCap = price * adjustedSupply;

  console.log("[Helius] Price data for", mint, {
    priceUsd: price,
    adjustedSupply,
    marketCapUsd: marketCap,
  });

  return {
    priceUsd: price,
    marketCapUsd: marketCap,
  };
}

export async function fetchAssetBatch(ids: string[]): Promise<HeliusAsset[]> {
  if (!ids.length) {
    console.warn("[Helius] fetchAssetBatch called with empty ids array");
    return [];
  }

  console.log("[Helius] Fetching asset batch for ids:", ids);

  const body = {
    jsonrpc: "2.0",
    id: "get-asset-batch",
    method: "getAssetBatch",
    params: {
      ids,
    },
  };

  try {
    const res = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("[Helius] getAssetBatch error:", res.status, res.statusText);
      return [];
    }

    const data = (await res.json()) as HeliusGetAssetBatchResponse;
    const result = data.result ?? [];

    console.log("[Helius] getAssetBatch returned", result.length, "assets");
    return result;
  } catch (e) {
    console.error("[Helius] Network/parse error in getAssetBatch:", e);
    return [];
  }
}

export async function fetchAsset(id: string): Promise<HeliusAsset | null> {
  if (!id) {
    console.warn("[Helius] fetchAsset called without id");
    return null;
  }

  console.log("[Helius] Fetching asset for id:", id);

  const body = {
    jsonrpc: "2.0",
    id: "get-asset",
    method: "getAsset",
    params: {
      id,
      displayOptions: {
        showFungibleTokens: true,
      },
    },
  };

  try {
    const res = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("[Helius] getAsset error:", res.status, res.statusText);
      return null;
    }

    const data = (await res.json()) as { result?: HeliusAsset };
    const result = data.result ?? null;

    console.log("[Helius] getAsset returned asset:", result ? "found" : "not found");
    return result;
  } catch (e) {
    console.error("[Helius] Network/parse error in getAsset:", e);
    return null;
  }
}


interface HeliusSignatureInfo {
  signature: string;
  slot: number;
  blockTime?: number | null;
  err: unknown;
}

interface HeliusGetSignaturesResponse {
  result: HeliusSignatureInfo[];
}

interface HeliusTokenBalanceChange {
  mint: string;
  owner?: string;
  uiTokenAmount: HeliusTokenAmount;
}

interface HeliusTransactionMeta {
  preBalances: number[];
  postBalances: number[];
  preTokenBalances?: HeliusTokenBalanceChange[];
  postTokenBalances?: HeliusTokenBalanceChange[];
  err: unknown;
}

interface HeliusTransactionMessage {
  accountKeys: string[];
}

interface HeliusTransactionResult {
  slot: number;
  blockTime?: number | null;
  meta?: HeliusTransactionMeta | null;
  transaction: {
    message: HeliusTransactionMessage;
  };
}

interface HeliusGetTransactionResponse {
  result: HeliusTransactionResult | null;
}

/**
 * Fetch signatures for an address using Helius (up to `limit`, max 1000)
 */
export async function fetchSignaturesForAddress(
  address: string,
  limit: number = 100
): Promise<HeliusSignatureInfo[]> {
  if (!HELIUS_RPC_URL) {
    console.warn(
      "[Helius] NEXT_PUBLIC_RPC_URL is not set. Skipping fetchSignaturesForAddress."
    );
    return [];
  }

  if (!address) {
    console.warn("[Helius] fetchSignaturesForAddress called without address");
    return [];
  }

  const cappedLimit = Math.min(Math.max(limit, 1), 1000);

  const body = {
    jsonrpc: "2.0",
    id: "get-signatures",
    method: "getSignaturesForAddress",
    params: [
      address,
      {
        limit: cappedLimit,
      },
    ],
  };

  try {
    console.log(
      "[Helius] Fetching signatures for address",
      address,
      "limit",
      cappedLimit
    );
    const res = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error(
        "[Helius] getSignaturesForAddress error:",
        res.status,
        res.statusText
      );
      return [];
    }

    const data = (await res.json()) as HeliusGetSignaturesResponse;
    const result = data.result ?? [];
    console.log(
      "[Helius] getSignaturesForAddress returned",
      result.length,
      "signatures"
    );
    return result;
  } catch (e) {
    console.error("[Helius] Network/parse error in getSignaturesForAddress:", e);
    return [];
  }
}

/**
 * Fetch a full transaction for a given signature using Helius
 */
export async function fetchTransaction(
  signature: string
): Promise<HeliusTransactionResult | null> {
  if (!HELIUS_RPC_URL) {
    console.warn(
      "[Helius] NEXT_PUBLIC_RPC_URL is not set. Skipping fetchTransaction."
    );
    return null;
  }

  if (!signature) {
    console.warn("[Helius] fetchTransaction called without signature");
    return null;
  }

  const body = {
    jsonrpc: "2.0",
    id: "get-transaction",
    method: "getTransaction",
    params: [
      signature,
      {
        maxSupportedTransactionVersion: 0,
      },
    ],
  };

  try {
    console.log("[Helius] Fetching transaction for signature", signature);
    const res = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error(
        "[Helius] getTransaction error:",
        res.status,
        res.statusText
      );
      return null;
    }

    const data = (await res.json()) as HeliusGetTransactionResponse;
    const result = data.result ?? null;
    console.log("[Helius] getTransaction result for", signature, ":", result);
    return result;
  } catch (e) {
    console.error("[Helius] Network/parse error in getTransaction:", e);
    return null;
  }
}

/**
 * Fetch transactions individually with delays between calls to avoid rate limiting
 */
export async function fetchTransactionsBatch(
  signatures: string[],
  delayBetweenCalls: number = 100 // ms delay between individual calls
): Promise<Map<string, HeliusTransactionResult | null>> {
  if (!HELIUS_RPC_URL) {
    console.warn(
      "[Helius] NEXT_PUBLIC_RPC_URL is not set. Skipping fetchTransactionsBatch."
    );
    return new Map();
  }

  if (!signatures || signatures.length === 0) {
    return new Map();
  }

  const results = new Map<string, HeliusTransactionResult | null>();

  console.log(`[Helius] Fetching ${signatures.length} transactions individually with ${delayBetweenCalls}ms delay`);

  // Fetch each transaction individually with delay
  for (let i = 0; i < signatures.length; i++) {
    const signature = signatures[i];
    
    try {
      if (i > 0) {
        // Add delay before each call (except the first one)
        await new Promise((resolve) => setTimeout(resolve, delayBetweenCalls));
      }

      const body = {
        jsonrpc: "2.0",
        id: `get-transaction-${i}`,
        method: "getTransaction",
        params: [
          signature,
          {
            maxSupportedTransactionVersion: 0,
          },
        ],
      };

      const res = await fetch(HELIUS_RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        console.error(
          `[Helius] getTransaction error for ${signature}:`,
          res.status,
          res.statusText
        );
        results.set(signature, null);
        continue;
      }

      const data = (await res.json()) as HeliusGetTransactionResponse;
      const result = data.result ?? null;
      results.set(signature, result);
    } catch (e) {
      console.error(`[Helius] Network/parse error for ${signature}:`, e);
      results.set(signature, null);
    }
  }

  console.log(`[Helius] Completed fetching ${results.size} transactions`);
  return results;
}

