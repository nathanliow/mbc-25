"use client";

import { useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";
import { SOL_MINT, USDT_MINT, USDC_MINT } from "@/lib/const";
import { 
  Card,
  CardContent,
  Button,
  Skeleton,
  Input,
  TokenSelector,
  Card as TokenCard, 
  CardContent as TokenCardContent,
  TokenIcon
} from "@/components";
import { fetchAsset } from "@/lib/helius";
import { PublicKey } from "@solana/web3.js";
import { ArrowDownUp, Shield } from "lucide-react";
import { useWallet } from "@/lib/wallet-context";
import {
  swapFromTokenAtom,
  swapToTokenAtom,
  swapFromAmountAtom,
  swapToAmountAtom,
  swapIsPrivateAtom,
  swapLastEditedAtom,
} from "@/lib/atoms";

type SwapToken = {
  symbol: string;
  name: string;
  balance?: string;
  imageUrl?: string | null;
  mint: string;
  decimals: number;
};

const TOKEN_CONFIG: Record<
  string,
  { mint: string; decimals: number }
> = {
  SOL: {
    mint: SOL_MINT,
    decimals: 9,
  },
  USDC: {
    mint: USDC_MINT,
    decimals: 6,
  },
  USDT: {
    mint: USDT_MINT,
    decimals: 6,
  },
};

// Mock exchange rate - in production, this would come from Jupiter or another DEX aggregator
const getExchangeRate = (fromSymbol: string, toSymbol: string): number => {
  if (fromSymbol === "SOL" && toSymbol === "USDC") return 100;
  if (fromSymbol === "USDC" && toSymbol === "SOL") return 0.01;
  if (fromSymbol === "SOL" && toSymbol === "USDT") return 100;
  if (fromSymbol === "USDT" && toSymbol === "SOL") return 0.01;
  if (fromSymbol === "USDC" && toSymbol === "USDT") return 1;
  if (fromSymbol === "USDT" && toSymbol === "USDC") return 1;
  return 1;
};

export function SwapForm() {
  const [fromToken, setFromToken] = useAtom(swapFromTokenAtom);
  const [toToken, setToToken] = useAtom(swapToTokenAtom);
  const [fromAmount, setFromAmount] = useAtom(swapFromAmountAtom);
  const [toAmount, setToAmount] = useAtom(swapToAmountAtom);
  const [isPrivate, setIsPrivate] = useAtom(swapIsPrivateAtom);
  const [lastEdited, setLastEdited] = useAtom(swapLastEditedAtom);
  const wallet = useWallet();
  const { swapPrivately, swapPublic, publicBalance, splTokens, publicKey } = wallet;
  const [swapError, setSwapError] = useState<string>("");
  const [isSwapping, setIsSwapping] = useState(false);
  const [showFromList, setShowFromList] = useState(false);
  const [showToList, setShowToList] = useState(false);
  const [quoteRate, setQuoteRate] = useState<number | null>(null);
  const [quoteImpactPct, setQuoteImpactPct] = useState<number | null>(null);
  const [quoteFeeBps, setQuoteFeeBps] = useState<number | null>(null);
  const [quoteSlippageBps, setQuoteSlippageBps] = useState<number | null>(null);
  const [quoteInUsdValue, setQuoteInUsdValue] = useState<number | null>(null);
  const [quoteOutUsdValue, setQuoteOutUsdValue] = useState<number | null>(null);
  const [quoteTransaction, setQuoteTransaction] = useState<string | null>(null);
  const [quoteRequestId, setQuoteRequestId] = useState<string | null>(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [lastQuoteKey, setLastQuoteKey] = useState<string | null>(null);
  const [swapStatus, setSwapStatus] = useState<string | null>(null);
  const [pastedFromAddress, setPastedFromAddress] = useState<string>("");
  const [pastedToAddress, setPastedToAddress] = useState<string>("");
  const [isLoadingPastedToken, setIsLoadingPastedToken] = useState(false);
  const [pastedFromToken, setPastedFromToken] = useState<SwapToken | null>(null);
  const [pastedToToken, setPastedToToken] = useState<SwapToken | null>(null);

  const availableTokens: SwapToken[] = useMemo(() => {
    const base: SwapToken[] = [];
    base.push({
      symbol: "SOL",
      name: "Solana",
      balance: publicBalance.toFixed(4),
      mint: SOL_MINT,
      decimals: 9,
    });

    const spl = splTokens
      .filter((t) => t.uiAmount > 0)
      .map<SwapToken>((t) => ({
        symbol: t.symbol,
        name: t.name,
        balance: t.uiAmount.toFixed(4),
        imageUrl: t.imageUrl ?? null,
        mint: t.mint,
        decimals: t.decimals,
      }));

    const merged = [...base, ...spl];
    const priority = (sym: string) => {
      if (sym === "SOL") return 0;
      if (sym === "USDC") return 1;
      return 2;
    };
    merged.sort((a, b) => {
      const pa = priority(a.symbol);
      const pb = priority(b.symbol);
      if (pa !== pb) return pa - pb;
      return a.symbol.localeCompare(b.symbol);
    });
    return merged;
  }, [publicBalance, splTokens]);

  // Initialize tokens if not set
  useEffect(() => {
    if (!availableTokens.length) return;
    // Only initialize if tokens are null (not if they're already set)
    if (fromToken === null) {
      const solToken = availableTokens.find(t => t.symbol === "SOL") || availableTokens[0];
      setFromToken(solToken);
    }
    if (toToken === null) {
      const usdcToken = availableTokens.find(t => t.symbol === "USDC") || availableTokens[1] || availableTokens[0];
      setToToken(usdcToken);
    }
  }, [availableTokens, fromToken, toToken, setFromToken, setToToken]);

  // Fallbacks to avoid null access before atoms are initialized
  // Merge with availableTokens to get latest balance
  const getEffectiveToken = (token: SwapToken | null, fallbackIndex: number): SwapToken => {
    const fallback = availableTokens[fallbackIndex] ?? availableTokens[0] ?? {
      symbol: "SOL",
      name: "Solana",
      mint: SOL_MINT,
      decimals: 9,
    };
    
    if (!token) return fallback;
    
    // Find matching token in availableTokens to get latest balance
    const matchingToken = availableTokens.find(
      (t) => t.mint === token.mint || t.symbol === token.symbol
    );
    
    if (matchingToken) {
      // Merge token config with latest balance
      return {
        ...token,
        balance: matchingToken.balance,
        imageUrl: matchingToken.imageUrl ?? token.imageUrl,
      };
    }
    
    // If no match found, use the token as-is (might not have balance)
    return token;
  };

  const effectiveFromToken = getEffectiveToken(fromToken, 0);
  const effectiveToToken = getEffectiveToken(toToken, 1);

  // Fetch Jupiter quote for current pair/amount (debounced, once per unique combo)
  // Only fetch when "from" amount is edited, not when "to" amount is edited
  useEffect(() => {
    // Only fetch quote if "from" amount was edited or if it's the initial load
    if (lastEdited === "to") {
      console.log("[Swap] Skipping quote fetch - 'to' amount was edited");
      return;
    }

    // Use effective tokens with fallbacks
    const currentFromToken = fromToken ?? availableTokens[0] ?? { symbol: "SOL", name: "Solana" };
    const currentToToken = toToken ?? availableTokens[1] ?? availableTokens[0] ?? { symbol: "USDC", name: "USD Coin" };
    
    console.log("[Swap] useEffect triggered", { 
      fromToken: currentFromToken, 
      toToken: currentToToken, 
      fromAmount, 
      lastQuoteKey,
      lastEdited
    });
    
    const fetchQuote = async () => {
      console.log("[Swap] fetchQuote called", { 
        fromToken: currentFromToken, 
        toToken: currentToToken, 
        fromAmount 
      });

      if (!currentFromToken || !currentToToken) {
        console.log("[Swap] Missing tokens, skipping quote");
        return;
      }
      if (!fromAmount) {
        console.log("[Swap] Missing amount, skipping quote");
        return;
      }

      // Use token's own mint and decimals instead of TOKEN_CONFIG
      const fromMint = currentFromToken.mint;
      const toMint = currentToToken.mint;
      const fromDecimals = currentFromToken.decimals;
      const toDecimals = currentToToken.decimals;

      console.log("[Swap] Token configs", { 
        fromMint, 
        toMint, 
        fromDecimals,
        toDecimals,
        fromSymbol: currentFromToken.symbol, 
        toSymbol: currentToToken.symbol 
      });
      
      if (!fromMint || !toMint || !fromDecimals || !toDecimals) {
        console.log("[Swap] Missing mint or decimals, skipping quote");
        return;
      }

      // Don't fetch quote if swapping same token
      if (fromMint === toMint) {
        console.log("[Swap] Same token swap, skipping quote");
        return;
      }

      const amount = parseFloat(fromAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        console.log("[Swap] Invalid amount", amount);
        return;
      }

      const amountIn = Math.floor(
        amount * Math.pow(10, fromDecimals)
      );
      if (amountIn <= 0) {
        console.log("[Swap] amountIn too small", amountIn);
        return;
      }

      const key = `${fromMint}-${toMint}-${amountIn}`;
      if (key === lastQuoteKey) {
        console.log("[Swap] Already fetched for this combo", key);
        // Don't clear quote data if we already have it for this combo
        return;
      }

      // Set lastQuoteKey immediately to prevent duplicate fetches
      setLastQuoteKey(key);

      // Clear quote data only when we're actually going to fetch a new quote
      setQuoteRate(null);
      setQuoteImpactPct(null);
      setQuoteFeeBps(null);
      setQuoteSlippageBps(null);
      setQuoteInUsdValue(null);
      setQuoteOutUsdValue(null);
      setQuoteTransaction(null);
      setQuoteRequestId(null);

      // We need a taker address; prefer wallet public key, fallback to dummy
      const taker =
        publicKey || "11111111111111111111111111111111";

      try {
        setIsQuoteLoading(true);
        console.log("[Swap] Fetching Jupiter quote for", {
          inputMint: fromMint,
          outputMint: toMint,
          amountIn,
          taker,
        });
        const res = await fetch("/api/jupiter/quote", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputMint: fromMint,
            outputMint: toMint,
            amount: amountIn,
            taker,
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error("[Swap] Jupiter quote error:", res.status, errorText);
          // Reset lastQuoteKey on error so we can retry
          setLastQuoteKey(null);
          setIsQuoteLoading(false);
          return;
        }

        const data = await res.json();
        console.log("[Swap] Jupiter quote response:", data);

        // We already know the input amount (amountIn), we need the output amount from response
        // Jupiter Ultra API response format may vary
        // Try to extract output amount from various possible field names
        const outAmountRaw = Number(
          data.outAmount || 
          data.outputAmount || 
          data.amountOut || 
          data.expectedOutAmount ||
          data.quote?.outAmount ||
          data.quote?.outputAmount
        );

        if (amountIn > 0 && outAmountRaw > 0) {
          const inAmountUi = amountIn / Math.pow(10, fromDecimals);
          const outAmountUi = outAmountRaw / Math.pow(10, toDecimals);
          const rate = outAmountUi / inAmountUi;
          setQuoteRate(rate);
          
          // Update the "to" amount field with the quoted output amount
          setToAmount(outAmountUi.toFixed(6));
          setLastEdited(null); // Prevent the exchange rate useEffect from overriding
          
          console.log("[Swap] Quote rate calculated:", rate, "from", inAmountUi, "to", outAmountUi);
        } else {
          console.warn("[Swap] Could not extract output amount from Jupiter response. amountIn:", amountIn, "outAmountRaw:", outAmountRaw, "response:", data);
          // Reset lastQuoteKey if we couldn't get a valid quote
          setLastQuoteKey(null);
        }

        // Extract price impact - both priceImpactPct and priceImpact are already percentages
        const impact = typeof data.priceImpactPct === "number"
          ? data.priceImpactPct
          : typeof data.priceImpact === "number"
          ? data.priceImpact // priceImpact is already a percentage, not basis points
          : null;
        if (impact !== null) {
          setQuoteImpactPct(impact);
        }

        // Extract feeBps and slippageBps (both are in basis points, convert to percentage)
        if (typeof data.feeBps === "number") {
          setQuoteFeeBps(data.feeBps / 100); // Convert basis points to percentage
        }
        if (typeof data.slippageBps === "number") {
          setQuoteSlippageBps(data.slippageBps / 100); // Convert basis points to percentage
        }

        // Extract USD values
        if (typeof data.inUsdValue === "number") {
          setQuoteInUsdValue(data.inUsdValue);
        }
        if (typeof data.outUsdValue === "number") {
          setQuoteOutUsdValue(data.outUsdValue);
        }

        // Store transaction and requestId for Jupiter execute (public swap)
        if (data.transaction) {
          setQuoteTransaction(data.transaction);
        }
        if (data.requestId) {
          setQuoteRequestId(data.requestId);
        }
      } catch (err) {
        console.error("[Swap] Failed to fetch Jupiter quote:", err);
        // Reset lastQuoteKey on error so we can retry
        setLastQuoteKey(null);
      } finally {
        setIsQuoteLoading(false);
      }
    };

    const timeout = setTimeout(() => {
      fetchQuote();
    }, 500);

    return () => clearTimeout(timeout);
  }, [fromToken, toToken, fromAmount, lastQuoteKey, lastEdited, publicKey, availableTokens]);

  const exchangeRate = getExchangeRate(
    effectiveFromToken.symbol,
    effectiveToToken.symbol
  );

  useEffect(() => {
    // Only handle "to" amount editing - don't auto-calculate from "from" amount
    // The "to" amount will be set by the Jupiter quote response
    if (lastEdited === "to" && toAmount) {
      const amount = parseFloat(toAmount);
      if (!isNaN(amount) && amount > 0) {
        const calculated = amount / exchangeRate;
        setFromAmount(calculated.toFixed(6));
      } else {
        setFromAmount("");
      }
    }
  }, [fromAmount, toAmount, lastEdited, exchangeRate]);

  const handleFromAmountChange = (value: string) => {
    setFromAmount(value);
    setLastEdited("from");
    // Clear toAmount and quote data when user manually edits "from" amount
    setToAmount("");
    setQuoteRate(null);
    setQuoteImpactPct(null);
    setQuoteFeeBps(null);
    setQuoteSlippageBps(null);
    setQuoteInUsdValue(null);
    setQuoteOutUsdValue(null);
    setQuoteTransaction(null);
    setQuoteRequestId(null);
    setLastQuoteKey(null);
  };

  const handleToAmountChange = (value: string) => {
    setToAmount(value);
    setLastEdited("to");
    // Clear quote data when user manually edits
    setQuoteRate(null);
    setQuoteImpactPct(null);
    setQuoteFeeBps(null);
    setQuoteSlippageBps(null);
    setQuoteInUsdValue(null);
    setQuoteOutUsdValue(null);
    setQuoteTransaction(null);
    setQuoteRequestId(null);
    setLastQuoteKey(null);
  };

  // Fetch token metadata when address is 44 characters
  useEffect(() => {
    const fetchTokenMetadata = async (address: string, isFrom: boolean) => {
      const trimmedAddress = address.trim();
      
      // Validate 44 characters
      if (trimmedAddress.length !== 44) {
        if (isFrom) {
          setPastedFromToken(null);
        } else {
          setPastedToToken(null);
        }
        return;
      }

      // Validate it's a valid PublicKey
      try {
        new PublicKey(trimmedAddress);
      } catch {
        if (isFrom) {
          setPastedFromToken(null);
        } else {
          setPastedToToken(null);
        }
        return;
      }

      setIsLoadingPastedToken(true);
      setSwapError("");

      try {
        // Fetch token metadata using getAsset
        const asset = await fetchAsset(trimmedAddress);
        if (!asset) {
          setSwapError("Token not found");
          if (isFrom) {
            setPastedFromToken(null);
          } else {
            setPastedToToken(null);
          }
          setIsLoadingPastedToken(false);
          return;
        }

        const metadata = asset.content?.metadata;
        const links = asset.content?.links as { image?: string } | undefined;
        const imageUrl = links?.image ?? null;

        // Get token info for decimals
        const tokenInfo = asset.token_info;
        const decimals = tokenInfo?.decimals ?? 9; // Default to 9 if not found

        const symbol = metadata?.symbol || trimmedAddress.slice(0, 4).toUpperCase();
        const name = metadata?.name || `Token ${trimmedAddress.slice(0, 4)}`;

        const newToken: SwapToken = {
          symbol,
          name,
          mint: trimmedAddress,
          decimals,
          imageUrl,
          balance: "0", // Pasted tokens won't have balance
        };

        if (isFrom) {
          setPastedFromToken(newToken);
        } else {
          setPastedToToken(newToken);
        }
      } catch (err) {
        console.error("[Swap] Error fetching pasted token:", err);
        setSwapError("Failed to fetch token information");
        if (isFrom) {
          setPastedFromToken(null);
        } else {
          setPastedToToken(null);
        }
      } finally {
        setIsLoadingPastedToken(false);
      }
    };

    if (pastedFromAddress) {
      fetchTokenMetadata(pastedFromAddress, true);
    }
    if (pastedToAddress) {
      fetchTokenMetadata(pastedToAddress, false);
    }
  }, [pastedFromAddress, pastedToAddress]);

  const handleSwapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    // Swap amounts and reset
    const tempAmount = fromAmount;
    setFromAmount(toAmount);
    setToAmount(tempAmount);
    setLastEdited(null);
    // Clear quote data when tokens are swapped
    setQuoteRate(null);
    setQuoteImpactPct(null);
    setQuoteFeeBps(null);
    setQuoteSlippageBps(null);
    setQuoteInUsdValue(null);
    setQuoteOutUsdValue(null);
    setQuoteTransaction(null);
    setQuoteRequestId(null);
    setLastQuoteKey(null);
  };

  const handleSwap = async () => {
    setSwapError("");
    setSwapStatus(null);
    const currentFromToken = fromToken ?? effectiveFromToken;
    const currentToToken = toToken ?? effectiveToToken;
    
    if (!currentFromToken || !currentToToken) {
      setSwapError("Select both tokens");
      return;
    }

    if (!fromAmount) {
      setSwapError("Enter an amount to swap");
      return;
    }

    if (!currentFromToken.mint || !currentToToken.mint || !currentFromToken.decimals || !currentToToken.decimals) {
      setSwapError("Token information incomplete.");
      return;
    }

    const amount = parseFloat(fromAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setSwapError("Enter a valid amount to swap");
      return;
    }

    const amountIn = Math.floor(
      amount * Math.pow(10, currentFromToken.decimals)
    );

    if (amountIn <= 0) {
      setSwapError("Amount too small for selected token");
      return;
    }

    try {
      setIsSwapping(true);

      if (isPrivate) {
        // Private swap using Encifher SDK
        console.log("[Swap] Starting private swap via Encifher");
        setSwapStatus("Initiating private swap...");
        
        const sig = await swapPrivately(
          currentFromToken.mint,
          currentToToken.mint,
          amountIn,
          (status, attempt) => {
            // Update status during polling
            if (status === "pending") {
              setSwapStatus(`Waiting for swap to complete... (${attempt}/5)`);
            } else if (status === "completed") {
              setSwapStatus("Swap completed!");
            } else if (status === "swap_failed") {
              setSwapStatus("Swap failed - slippage too low");
            } else if (status === "withdrawal_fallback") {
              setSwapStatus("Swap reverted - please try again");
            } else if (status === "timeout") {
              setSwapStatus("Swap is taking longer than expected. Please check your wallet.");
            } else {
              setSwapStatus(`Status: ${status} (${attempt}/5)`);
            }
          }
        );
        console.log("[Swap] Private swap successful, signature:", sig);
        setSwapStatus("Swap completed!");
      } else {
        // Public swap using Jupiter Ultra API
        console.log("[Swap] Starting public swap via Jupiter");
        
        if (!quoteTransaction || !quoteRequestId) {
          setSwapError("No valid quote available. Please wait for the quote to load.");
          return;
        }

        setSwapStatus("Signing and executing swap...");

        const sig = await swapPublic(quoteTransaction, quoteRequestId);
        console.log("[Swap] Public swap successful, signature:", sig);
        setSwapStatus("Swap completed!");
      }

      // Reset form on success
      setFromAmount("");
      setToAmount("");
      setLastEdited(null);
      setQuoteRate(null);
      setQuoteImpactPct(null);
      setQuoteFeeBps(null);
      setQuoteSlippageBps(null);
      setQuoteTransaction(null);
      setQuoteRequestId(null);
      
      setTimeout(() => setSwapStatus(null), 3000);
    } catch (err: any) {
      console.error("[Swap] Swap failed:", err);
      setSwapError(
        err?.message || "Swap failed. Please try again."
      );
      setSwapStatus(null);
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <Card className="bg-transparent border-0">
      <CardContent className="p-0">
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Swap</h3>
            <div className="flex items-center gap-2">
              <Button
                variant={isPrivate ? "default" : "outline"}
                size="sm"
                onClick={() => setIsPrivate(!isPrivate)}
              >
                <Shield className="h-4 w-4 mr-1" />
                {isPrivate ? "Private" : "Public"}
              </Button>
            </div>
          </div>

          <div className="relative">
            <TokenSelector
              token={effectiveFromToken}
              label="From"
              amount={fromAmount}
              onAmountChange={handleFromAmountChange}
              onClick={() => {
                setShowFromList((prev) => !prev);
                setShowToList(false);
              }}
              usdValue={quoteInUsdValue}
            />

            {showFromList && (
              <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
                <div className="p-3 border-b border-border">
                  <Input
                    placeholder="Paste token address (44 characters)"
                    value={pastedFromAddress}
                    onChange={(e) => setPastedFromAddress(e.target.value)}
                    disabled={isLoadingPastedToken}
                    className="text-sm"
                  />
                </div>
                {pastedFromToken && (
                  <TokenCard
                    className="hover:bg-muted transition-colors cursor-pointer border-0 rounded-none border-b border-border"
                    onClick={() => {
                      setFromToken(pastedFromToken);
                      setShowFromList(false);
                      setPastedFromAddress("");
                      setPastedFromToken(null);
                    }}
                  >
                    <TokenCardContent className="py-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          {pastedFromToken.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={pastedFromToken.imageUrl}
                              alt={pastedFromToken.symbol}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <TokenIcon symbol={pastedFromToken.symbol} className="h-8 w-8" />
                          )}
                          <div>
                            <p className="text-sm font-semibold">
                              {pastedFromToken.symbol}
                            </p>
                            <p className="text-xs text-gray-400">
                              {pastedFromToken.name}
                            </p>
                          </div>
                        </div>
                      </div>
                    </TokenCardContent>
                  </TokenCard>
                )}
                {availableTokens.map((token) => (
                  <TokenCard
                    key={`from-${token.symbol}-${token.name}`}
                    className="hover:bg-muted transition-colors cursor-pointer border-0 rounded-none"
                    onClick={() => {
                      setFromToken(token);
                      setShowFromList(false);
                    }}
                  >
                    <TokenCardContent className="py-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          {token.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={token.imageUrl}
                              alt={token.symbol}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <TokenIcon symbol={token.symbol} className="h-8 w-8" />
                          )}
                          <div>
                            <p className="text-sm font-semibold">
                              {token.symbol}
                            </p>
                            <p className="text-xs text-gray-400">
                              {token.name}
                            </p>
                          </div>
                        </div>
                        {token.balance && (
                          <p className="text-xs text-gray-400">
                            Bal: {token.balance}
                          </p>
                        )}
                      </div>
                    </TokenCardContent>
                  </TokenCard>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex justify-center -my-2 relative z-10">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={handleSwapTokens}
            >
              <ArrowDownUp className="h-4 w-4" />
            </Button>
          </div>

          <div className="relative">
            <TokenSelector
              token={effectiveToToken}
              label="To"
              amount={toAmount}
              onAmountChange={handleToAmountChange}
              onClick={() => {
                setShowToList((prev) => !prev);
                setShowFromList(false);
              }}
              disabled={false}
              usdValue={quoteOutUsdValue}
            />

            {showToList && (
              <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
                <div className="p-3 border-b border-border">
                  <Input
                    placeholder="Paste token address (44 characters)"
                    value={pastedToAddress}
                    onChange={(e) => setPastedToAddress(e.target.value)}
                    disabled={isLoadingPastedToken}
                    className="text-sm"
                  />
                </div>
                {pastedToToken && (
                  <TokenCard
                    className="hover:bg-muted transition-colors cursor-pointer border-0 rounded-none border-b border-border"
                    onClick={() => {
                      setToToken(pastedToToken);
                      setShowToList(false);
                      setPastedToAddress("");
                      setPastedToToken(null);
                    }}
                  >
                    <TokenCardContent className="py-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          {pastedToToken.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={pastedToToken.imageUrl}
                              alt={pastedToToken.symbol}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <TokenIcon symbol={pastedToToken.symbol} className="h-8 w-8" />
                          )}
                          <div>
                            <p className="text-sm font-semibold">
                              {pastedToToken.symbol}
                            </p>
                            <p className="text-xs text-gray-400">
                              {pastedToToken.name}
                            </p>
                          </div>
                        </div>
                      </div>
                    </TokenCardContent>
                  </TokenCard>
                )}
                {availableTokens.map((token) => (
                  <TokenCard
                    key={`to-${token.symbol}-${token.name}`}
                    className="hover:bg-muted transition-colors cursor-pointer border-0 rounded-none"
                    onClick={() => {
                      setToToken(token);
                      setShowToList(false);
                    }}
                  >
                    <TokenCardContent className="py-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          {token.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={token.imageUrl}
                              alt={token.symbol}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <TokenIcon symbol={token.symbol} className="h-8 w-8" />
                          )}
                          <div>
                            <p className="text-sm font-semibold">
                              {token.symbol}
                            </p>
                            <p className="text-xs text-gray-400">
                              {token.name}
                            </p>
                          </div>
                        </div>
                        {token.balance && (
                          <p className="text-xs text-gray-400">
                            Bal: {token.balance}
                          </p>
                        )}
                      </div>
                    </TokenCardContent>
                  </TokenCard>
                ))}
              </div>
            )}
          </div>

          {(fromAmount || toAmount) && (
            <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Rate</span>
                {isQuoteLoading ? (
                  <Skeleton className="h-4 w-32" />
                ) : quoteRate !== null ? (
                  <span>
                    1 {effectiveFromToken.symbol} = {quoteRate.toFixed(6)}{" "}
                    {effectiveToToken.symbol}
                  </span>
                ) : null}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Price Impact</span>
                {isQuoteLoading ? (
                  <Skeleton className="h-4 w-20" />
                ) : quoteImpactPct !== null ? (
                  <span
                    className={
                      Math.abs(quoteImpactPct) > 5
                        ? "text-red-400"
                        : Math.abs(quoteImpactPct) >= 1
                        ? "text-yellow-400"
                        : "text-emerald-400"
                    }
                  >
                    {quoteImpactPct.toFixed(4)}%
                  </span>
                ) : null}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Fee</span>
                {isQuoteLoading ? (
                  <Skeleton className="h-4 w-16" />
                ) : quoteFeeBps !== null ? (
                  <span>{quoteFeeBps.toFixed(2)}%</span>
                ) : null}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Slippage</span>
                {isQuoteLoading ? (
                  <Skeleton className="h-4 w-16" />
                ) : quoteSlippageBps !== null ? (
                  <span>{quoteSlippageBps.toFixed(2)}%</span>
                ) : null}
              </div>
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleSwap}
            disabled={isSwapping}
          >
            {isPrivate ? (
              <>
                <Shield className="h-4 w-4 mr-2" />
                {isSwapping ? "Swapping..." : "Swap Privately"}
              </>
            ) : isSwapping ? (
              "Swapping..."
            ) : (
              "Swap"
            )}
          </Button>

          {swapError && (
            <p className="text-xs text-center text-red-500">{swapError}</p>
          )}

          {swapStatus && !swapError && (
            <p className="text-xs text-center text-emerald-400">{swapStatus}</p>
          )}

          {isPrivate && (
            <p className="text-xs text-center text-gray-400">
              This swap will be executed through a privacy layer to protect your identity
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

