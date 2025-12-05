"use client";

import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { 
  BalanceCard,
  TokenList,
  TransactionItem,
  ActionButtons,
  SendDrawer,
  DepositDrawer,
  TokenDetailDrawer,
  Tabs, 
  TabsList, 
  TabsTrigger, 
  TabsContent
 } from "@/components";
import { useWallet } from "@/lib/wallet-context";
import {
  activeTabAtom,
  isSendDrawerOpenAtom,
  isDepositDrawerOpenAtom,
  selectedTokenAtom,
  isTokenDetailOpenAtom,
  getCachedActivityTxAtom,
  setCachedActivityTxAtom,
  type ActivityTransaction,
  getCachedActivityTokenMetaAtom,
  setCachedActivityTokenMetaAtom,
  walletHoldingsAtom,
} from "@/lib/atoms";
import {
  getCachedTokenPriceAtom,
  setCachedTokenPriceAtom,
  getTokenPrice,
} from "@/lib/jupiter-price";
import {
  fetchSignaturesForAddress,
  fetchTransactionsBatch,
  fetchAssetBatch,
} from "@/lib/helius";
import { SOL_MINT } from "@/lib/const";

export default function WalletPage() {
  const { publicBalance, privateBalance, splTokens, publicKey } = useWallet();
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const [isSendDrawerOpen, setIsSendDrawerOpen] = useAtom(isSendDrawerOpenAtom);
  const [isDepositDrawerOpen, setIsDepositDrawerOpen] = useAtom(isDepositDrawerOpenAtom);
  const [selectedToken, setSelectedToken] = useAtom(selectedTokenAtom);
  const [isTokenDetailOpen, setIsTokenDetailOpen] = useAtom(isTokenDetailOpenAtom);
  
  const getCachedTokenPrice = useAtom(getCachedTokenPriceAtom)[0];
  const setCachedTokenPrice = useAtom(setCachedTokenPriceAtom)[1];
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const getCachedActivityTx = useAtom(getCachedActivityTxAtom)[0];
  const setCachedActivityTx = useAtom(setCachedActivityTxAtom)[1];
  const getCachedActivityTokenMeta = useAtom(getCachedActivityTokenMetaAtom)[0];
  const setCachedActivityTokenMeta = useAtom(setCachedActivityTokenMetaAtom)[1];
  const [, setWalletHoldings] = useAtom(walletHoldingsAtom);
  const [activityTxs, setActivityTxs] = useState<ActivityTransaction[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  const totalBalance = publicBalance + privateBalance;

  // Fetch SOL price on mount (uses Jotai cache internally)
  useEffect(() => {
    const fetchSolPrice = async () => {
      const price = await getTokenPrice(
        SOL_MINT,
        getCachedTokenPrice,
        setCachedTokenPrice
      );
      setSolPrice(price);
    };
    fetchSolPrice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch activity transactions when Activity tab is active
  useEffect(() => {
    if (activeTab !== "activity") {
      setIsLoadingActivity(false);
      return;
    }
    if (!publicKey) {
      setActivityTxs([]);
      setIsLoadingActivity(false);
      return;
    }

    let cancelled = false;

    const loadActivity = async () => {
      setIsLoadingActivity(true);
      try {
        const signatures = await fetchSignaturesForAddress(publicKey, 1000);
        console.log(
          "[Activity] Signatures for",
          publicKey,
          "count:",
          signatures.length,
          "first 5:",
          signatures.slice(0, 5).map((s) => s.signature)
        );
        if (!signatures.length) {
          if (!cancelled) setActivityTxs([]);
          return;
        }

        const summaries: ActivityTransaction[] = [];
        const mintsNeedingMeta = new Set<string>();

        // Separate cached and uncached signatures
        const uncachedSignatures = signatures.filter(sigInfo => {
          const cached = getCachedActivityTx(sigInfo.signature);
          if (cached) {
            summaries.push(cached);
            return false;
          }
          return true;
        });

        // Fetch all uncached transactions individually with delays
        if (uncachedSignatures.length > 0) {
          const signatureList = uncachedSignatures.map(s => s.signature);
          const txResults = await fetchTransactionsBatch(signatureList, 100); // 100ms delay between calls

          // Process each transaction result
          for (const sigInfo of uncachedSignatures) {
            const tx = txResults.get(sigInfo.signature);
            if (!tx || !tx.transaction?.message?.accountKeys || !tx.meta) {
              continue;
            }

            const { accountKeys } = tx.transaction.message;
            const { preBalances, postBalances, preTokenBalances, postTokenBalances } = tx.meta;

            const idx = accountKeys.indexOf(publicKey);
            if (idx === -1) continue;

            const pre = preBalances?.[idx] ?? 0;
            const post = postBalances?.[idx] ?? 0;
            const diffLamports = post - pre;

            // Only add a SOL entry if there's an actual SOL balance change,
            // but always continue to parse token balances even if SOL diff is 0.
            if (diffLamports !== 0) {
              const amountSol = Math.abs(diffLamports) / 1_000_000_000;
              const direction: ActivityTransaction["direction"] =
                diffLamports < 0 ? "send" : "receive";

              // Filter out spam receive txns with tiny SOL amounts (< 0.001 SOL)
              if (!(direction === "receive" && amountSol < 0.001)) {
                const from =
                  direction === "send" ? publicKey : accountKeys[idx];
                const to =
                  direction === "send"
                    ? accountKeys.find((k, i) => i !== idx) ?? ""
                    : publicKey;

                const summary: ActivityTransaction = {
                  signature: sigInfo.signature,
                  slot: sigInfo.slot,
                  blockTime: sigInfo.blockTime ?? null,
                  amount: amountSol,
                  direction,
                  token: "SOL",
                  mint: SOL_MINT,
                  tokenName: "Solana",
                  from,
                  to,
                  isPrivate: false,
                };

                setCachedActivityTx(sigInfo.signature, summary);
                summaries.push(summary);
              }
            }

            // Handle SPL token balance changes for this transaction
            if (preTokenBalances && postTokenBalances) {
              const tokenMap = new Map<
                string,
                { mint: string; owner: string; pre: number; post: number }
              >();

              const addSide = (
                arr: any[] | undefined,
                isPre: boolean
              ) => {
                if (!arr) return;
                for (const tb of arr) {
                  const mint: string | undefined = tb?.mint;
                  const owner: string | undefined = tb?.owner;
                  const uiAmount: number =
                    tb?.uiTokenAmount?.uiAmount ?? 0;
                  if (!mint || !owner) continue;
                  if (owner !== publicKey) continue;
                  const key = `${mint}:${owner}`;
                  const existing =
                    tokenMap.get(key) ?? {
                      mint,
                      owner,
                      pre: 0,
                      post: 0,
                    };
                  if (isPre) {
                    existing.pre = uiAmount;
                  } else {
                    existing.post = uiAmount;
                  }
                  tokenMap.set(key, existing);
                }
              };

              addSide(preTokenBalances as any[], true);
              addSide(postTokenBalances as any[], false);

              for (const t of tokenMap.values()) {
                const diff = t.post - t.pre;
                if (diff === 0) continue;

                const tokenDirection: ActivityTransaction["direction"] =
                  diff < 0 ? "send" : "receive";
                const amountTokens = Math.abs(diff);

                // Try to get cached token metadata
                const cachedMeta = getCachedActivityTokenMeta(t.mint);
                let symbol = cachedMeta?.symbol ?? t.mint.slice(0, 4);
                let name = cachedMeta?.name ?? t.mint.slice(0, 8);

                if (!cachedMeta) {
                  mintsNeedingMeta.add(t.mint);
                }

                const tokenSummary: ActivityTransaction = {
                  signature: sigInfo.signature,
                  slot: sigInfo.slot,
                  blockTime: sigInfo.blockTime ?? null,
                  amount: amountTokens,
                  direction: tokenDirection,
                  token: symbol,
                  mint: t.mint,
                  tokenName: name,
                  from:
                    tokenDirection === "send"
                      ? publicKey
                      : t.owner,
                  to:
                    tokenDirection === "send"
                      ? t.owner
                      : publicKey,
                  isPrivate: false,
                };

                setCachedActivityTx(
                  `${sigInfo.signature}:${t.mint}`,
                  tokenSummary
                );
                summaries.push(tokenSummary);
              }
            }
          }
        }

        // Fetch and cache token metadata for any new mints we saw
        if (mintsNeedingMeta.size > 0) {
          try {
            const mints = Array.from(mintsNeedingMeta);
            const assets = await fetchAssetBatch(mints);
            for (const asset of assets) {
              const mint = asset.id;
              const metadata = asset.content?.metadata;
              const symbol = metadata?.symbol || mint.slice(0, 4);
              const name = metadata?.name || mint.slice(0, 8);
              setCachedActivityTokenMeta(mint, {
                mint,
                symbol,
                name,
              });
            }

            // Update summaries with better names/symbols where applicable
            for (const s of summaries) {
              if (!s.mint) continue;
              const meta = getCachedActivityTokenMeta(s.mint);
              if (meta) {
                s.token = meta.symbol;
                s.tokenName = meta.name;
              }
            }
          } catch (e) {
            console.error(
              "Failed to fetch token metadata for activity mints:",
              e
            );
          }
        }
        if (cancelled) return;

        // Filter out tiny SOL sends that are just gas when there's also a token send
        const filteredSummaries = summaries.filter((s) => {
          if (
            s.token === "SOL" &&
            s.direction === "send" &&
            s.amount < 0.001
          ) {
            const hasTokenSend = summaries.some(
              (t) =>
                t.signature === s.signature &&
                t.direction === "send" &&
                t.token !== "SOL"
            );
            if (hasTokenSend) {
              return false;
            }
          }
          return true;
        });

        // Detect and combine swap transactions
        // Group by signature
        const txBySignature = new Map<string, ActivityTransaction[]>();
        for (const tx of filteredSummaries) {
          const existing = txBySignature.get(tx.signature) || [];
          existing.push(tx);
          txBySignature.set(tx.signature, existing);
        }

        const finalSummaries: ActivityTransaction[] = [];
        const processedSignatures = new Set<string>();

        for (const [signature, txs] of txBySignature.entries()) {
          if (processedSignatures.has(signature)) continue;

          // Check if this is a swap: one asset sent, another received
          const sends = txs.filter((t) => t.direction === "send");
          const receives = txs.filter((t) => t.direction === "receive");

          // Swap detection: one send and one receive of different assets
          if (sends.length === 1 && receives.length === 1) {
            const sendTx = sends[0];
            const receiveTx = receives[0];

            // Check if they're different assets
            const sendMint = sendTx.mint || sendTx.token;
            const receiveMint = receiveTx.mint || receiveTx.token;

            if (sendMint !== receiveMint) {
              // This is a swap!
              const swapTx: ActivityTransaction = {
                signature,
                slot: sendTx.slot,
                blockTime: sendTx.blockTime,
                amount: receiveTx.amount, // Show received amount
                direction: "swap",
                token: receiveTx.token, // Show received token
                mint: receiveTx.mint,
                tokenName: receiveTx.tokenName,
                from: sendTx.from,
                to: receiveTx.to,
                isPrivate: false,
                fromToken: sendTx.token,
                fromAmount: sendTx.amount,
                fromMint: sendTx.mint,
                toToken: receiveTx.token,
                toAmount: receiveTx.amount,
                toMint: receiveTx.mint,
              };
              finalSummaries.push(swapTx);
              processedSignatures.add(signature);
              continue;
            }
          }

          // Not a swap, add all transactions individually with unique keys
          for (let i = 0; i < txs.length; i++) {
            finalSummaries.push(txs[i]);
          }
          processedSignatures.add(signature);
        }

        // Sort newest first
        finalSummaries.sort((a, b) => {
          const ta = a.blockTime ?? 0;
          const tb = b.blockTime ?? 0;
          if (tb !== ta) return tb - ta;
          return b.slot - a.slot;
        });

        if (!cancelled) {
          setActivityTxs(finalSummaries);
        }
      } catch (error) {
        console.error("Failed to load activity transactions:", error);
        if (!cancelled) setActivityTxs([]);
      } finally {
        if (!cancelled) {
          setIsLoadingActivity(false);
        }
      }
    };

    loadActivity();

    return () => {
      cancelled = true;
      setIsLoadingActivity(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, publicKey]);

  // Calculate USD value using actual SOL price
  const solUsdValue = solPrice !== null && solPrice > 0 
    ? (totalBalance * solPrice).toFixed(2)
    : "0.00";

  // Get SOL private balance from privateBalances or use 0
  const solPrivateBal = privateBalance; // Already includes SOL private balance
  const solTotalBal = publicBalance + solPrivateBal;
  const solUsdValueTotal = solPrice !== null && solPrice > 0 
    ? (solTotalBal * solPrice).toFixed(2)
    : "0.00";

  const solToken = {
    symbol: "SOL",
    name: "Solana",
    balance: solTotalBal.toFixed(2),
    usdValue: solUsdValueTotal,
    isShielded: solPrivateBal > 0,
    publicBalance: publicBalance.toFixed(4),
    privateBalance: solPrivateBal.toFixed(4),
    mint: SOL_MINT,
    priceUsd: solPrice,
    decimals: 9,
  };

  // Filter out SOL from splTokens (it's handled separately) and deduplicate by mint
  const seenMints = new Set<string>([SOL_MINT]);
  const portfolioTokens = [
    solToken,
    ...splTokens
      .filter((t) => {
        // Exclude SOL and any duplicates
        if (t.mint === SOL_MINT || seenMints.has(t.mint)) {
          return false;
        }
        seenMints.add(t.mint);
        return true;
      })
      .map((t) => {
        const privateBal = t.privateBalance || 0;
        const totalBal = t.uiAmount + privateBal;
        const usdValue = t.priceUsd && t.priceUsd > 0
          ? (totalBal * t.priceUsd).toFixed(2)
          : "0.00";
        
        return {
          symbol: t.symbol,
          name: t.name,
          balance: totalBal.toFixed(2),
          usdValue,
          isShielded: privateBal > 0,
          publicBalance: t.uiAmount.toFixed(4),
          privateBalance: privateBal > 0 ? privateBal.toFixed(4) : undefined,
          priceUsd: t.priceUsd,
          imageUrl: t.imageUrl ?? null,
          mint: t.mint,
          decimals: t.decimals,
        };
      }),
];

  // Update global wallet holdings snapshot for use in other components (e.g. send drawer)
  useEffect(() => {
    setWalletHoldings(portfolioTokens);
  }, [setWalletHoldings, totalBalance, splTokens]);

  const handleTokenClick = (token: {
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
  }) => {
    setSelectedToken(token);
    setIsTokenDetailOpen(true);
  };

  const sendTokens = portfolioTokens;

  return (
    <>
      <div className="container mx-auto px-4 py-4 space-y-6 max-w-md">
        <div className="space-y-4">
          <BalanceCard
            balance={totalBalance.toFixed(4)}
            usdValue={solUsdValue}
            publicBalance={publicBalance.toFixed(4)}
            privateBalance={privateBalance.toFixed(4)}
          />
          <ActionButtons 
            onSend={() => setIsSendDrawerOpen(true)} 
            onDeposit={() => setIsDepositDrawerOpen(true)}
          />
        </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="tokens" className="flex-1">
            Tokens
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex-1">
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tokens" className="mt-4">
            <TokenList
              tokens={portfolioTokens}
              onTokenClick={handleTokenClick}
            />
        </TabsContent>

        <TabsContent value="activity" className="mt-4 space-y-2">
          {isLoadingActivity ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-sm text-gray-400">Loading activity...</p>
            </div>
          ) : activityTxs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">No recent activity</p>
              <p className="text-xs mt-1">Transactions will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activityTxs.map((tx, index) => (
                <TransactionItem
                  key={`${tx.signature}-${tx.mint || tx.token}-${index}`}
                  type={tx.direction === "send" ? "send" : tx.direction === "swap" ? "swap" : "receive"}
                  amount={tx.amount}
                  token={tx.token}
                  from={tx.from}
                  to={tx.to}
                  timestamp={
                    tx.blockTime
                      ? new Date(tx.blockTime * 1000).toLocaleString()
                      : ""
                  }
                  isPrivate={tx.isPrivate}
                  transactionUrl={`https://orb.helius.dev/tx/${tx.signature}?tab=summary`}
                  signature={tx.signature}
                  fromToken={tx.fromToken}
                  fromAmount={tx.fromAmount}
                  toToken={tx.toToken}
                  toAmount={tx.toAmount}
                />
          ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      </div>

      <SendDrawer
        isOpen={isSendDrawerOpen}
        onClose={() => setIsSendDrawerOpen(false)}
        tokens={sendTokens}
      />
      <DepositDrawer
        isOpen={isDepositDrawerOpen}
        onClose={() => setIsDepositDrawerOpen(false)}
      />
      <TokenDetailDrawer
        isOpen={isTokenDetailOpen}
        onClose={() => {
          setIsTokenDetailOpen(false);
          setSelectedToken(null);
        }}
        token={selectedToken}
      />
    </>
  );
}
