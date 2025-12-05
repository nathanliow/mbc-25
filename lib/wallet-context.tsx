"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { 
  Keypair, 
  TransactionInstruction 
} from "@solana/web3.js";
import {
  generateMnemonic,
  validateMnemonic,
  mnemonicToSeed,
  deriveWalletsFromSeed,
  deriveStealthAddress,
  DerivedWallet,
  truncateAddress,
} from "./wallet";
import { 
  encryptSeed, 
  decryptSeed 
} from "./crypto";
import { 
  getBalance, 
  sendSol, 
  signAndSendTransaction, 
  requestAirdrop 
} from "./solana";
import {
  getPrivateBalance,
  depositToPrivate,
  withdrawFromPrivate,
  sendPrivate,
  swapPrivate,
  resetEncifherClient,
} from "./encifher";
import { 
  fetchSplTokensByOwner, 
  ParsedTokenAccount, 
  fetchTokenPriceData, 
  fetchAssetBatch, 
  HeliusAsset 
} from "./helius";
import { SOL_MINT, USDC_MINT, USDT_MINT } from "./const";

const STORAGE_KEY = "shade_wallet_encrypted";
const WALLET_INDEX_KEY = "shade_wallet_index";
const MNEMONIC_STORAGE_KEY = "shade_wallet_mnemonic_encrypted";

export interface WalletState {
  isUnlocked: boolean;
  isLoading: boolean;
  hasWallet: boolean;
  publicKey: string | null;
  publicBalance: number;
  privateBalance: number;
  privateBalances: Record<string, number>; // mint -> private balance
  tokens: WalletToken[];
  activeWalletIndex: number;
  derivedWallets: DerivedWallet[];
  mnemonic: string | null;
}

export interface WalletToken {
  mint: string;
  symbol: string;
  name: string;
  amount: string;
  decimals: number;
  uiAmount: number;
  privateBalance?: number; // Private balance in token units
  priceUsd: number | null;
  marketCapUsd: number | null;
  imageUrl?: string | null;
}

export interface WalletContextType extends WalletState {
  createWallet: (password: string, mnemonicWords?: number) => Promise<string>;
  importWallet: (mnemonic: string, password: string) => Promise<void>;
  unlockWallet: (password: string) => Promise<void>;
  lockWallet: () => void;
  deleteWallet: () => void;
  switchWallet: (index: number) => void;
  refreshBalances: () => Promise<void>;
  sendPublic: (toAddress: string, amountSol: number) => Promise<string>;
  sendPrivately: (toAddress: string, amountSol: number) => Promise<{ depositSig: string; withdrawSig: string }>;
  deposit: (amount: number, tokenMint: string, decimals: number) => Promise<string>;
  withdraw: (toAddress: string, amount: number, tokenMint: string, decimals: number) => Promise<string>;
  swapPrivately: (fromMint: string, toMint: string, amountIn: number, onStatusUpdate?: (status: string, attempt: number) => void) => Promise<string>;
  swapPublic: (transaction: string, requestId: string) => Promise<string>;
  signTransaction: (instructions: TransactionInstruction[]) => Promise<string>;
  getStealthAddress: (index: number) => DerivedWallet | null;
  requestDevnetAirdrop: () => Promise<string>;
  getActiveKeypair: () => Keypair | null;
  splTokens: WalletToken[];
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasWallet, setHasWallet] = useState(false);
  const [seed, setSeed] = useState<Uint8Array | null>(null);
  const [derivedWallets, setDerivedWallets] = useState<DerivedWallet[]>([]);
  const [activeWalletIndex, setActiveWalletIndex] = useState(0);
  const [publicBalance, setPublicBalance] = useState(0);
  const [privateBalance, setPrivateBalance] = useState(0);
  const [privateBalances, setPrivateBalances] = useState<Record<string, number>>({}); // mint -> private balance
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [splTokens, setSplTokens] = useState<WalletToken[]>([]);

  const activeKeypair = derivedWallets[activeWalletIndex]?.keypair || null;
  const publicKey = activeKeypair?.publicKey.toBase58() || null;

  useEffect(() => {
    const checkExistingWallet = () => {
      if (typeof window !== "undefined") {
        const encrypted = localStorage.getItem(STORAGE_KEY);
        setHasWallet(!!encrypted);
        const savedIndex = localStorage.getItem(WALLET_INDEX_KEY);
        if (savedIndex) {
          setActiveWalletIndex(parseInt(savedIndex, 10));
        }
      }
      setIsLoading(false);
    };
    checkExistingWallet();
  }, []);

  const refreshBalances = useCallback(async () => {
    if (!activeKeypair) return;
    
    try {
      const [pubBal, privBalResult, tokens] = await Promise.all([
        getBalance(activeKeypair.publicKey),
        getPrivateBalance(activeKeypair).catch(() => ({ solBalance: 0, balances: {} })),
        fetchSplTokensByOwner(activeKeypair.publicKey.toBase58()).catch(() => [] as ParsedTokenAccount[]),
      ]);

      const privBal = privBalResult.solBalance || 0;
      const privBalancesMap: Record<string, number> = privBalResult.balances || {};

      const nonZeroTokens = tokens.filter((t) => t.uiAmount > 0);

      const uniqueMints = Array.from(new Set(nonZeroTokens.map((t) => t.mint)));

      // Fetch prices for each mint
      const priceMap = new Map<string, { priceUsd: number | null; marketCapUsd: number | null }>();
      await Promise.all(
        uniqueMints.map(async (mint) => {
          const price = await fetchTokenPriceData(mint).catch(() => ({
            priceUsd: null,
            marketCapUsd: null,
          }));
          priceMap.set(mint, price);
        })
      );

      // Fetch metadata (name, symbol, image) for each mint via getAssetBatch
      const assetBatch: HeliusAsset[] = await fetchAssetBatch(uniqueMints).catch(() => []);
      const metaMap = new Map<
        string,
        { name?: string; symbol?: string; imageUrl?: string | null }
      >();
      for (const asset of assetBatch) {
        const mint = asset.id;
        const metadata = asset.content?.metadata;
        const links = asset.content?.links as { image?: string } | undefined;
        const imageUrl = links?.image ?? null;
        metaMap.set(mint, {
          name: metadata?.name,
          symbol: metadata?.symbol,
          imageUrl,
        });
      }

      const mappedTokens: WalletToken[] = nonZeroTokens.map((t) => {
        const priceInfo = priceMap.get(t.mint);
        const meta = metaMap.get(t.mint);
        const privateBal = privBalancesMap[t.mint] || 0;

        let symbol = meta?.symbol || "TOKEN";
        let name = meta?.name || "Token";

        // Simple mapping for common tokens if metadata missing
        if (!meta?.symbol && !meta?.name) {
          switch (t.mint) {
            case SOL_MINT:
              symbol = "SOL";
              name = "Solana";
              break;
            case USDT_MINT:
              symbol = "USDT";
              name = "Tether USD";
              break;
            case USDC_MINT:
              symbol = "USDC";
              name = "USD Coin";
              break;
            default:
              symbol = t.mint.slice(0, 4);
              name = truncateAddress(t.mint, 4);
          }
        }

        return {
          mint: t.mint,
          symbol,
          name,
          amount: t.amount,
          decimals: t.decimals,
          uiAmount: t.uiAmount,
          privateBalance: privateBal > 0 ? privateBal : undefined,
          priceUsd: priceInfo?.priceUsd ?? null,
          marketCapUsd: priceInfo?.marketCapUsd ?? null,
          imageUrl: meta?.imageUrl ?? null,
        };
      });

      // Also add tokens that only exist in private balances (not in public)
      // Exclude SOL since it's handled separately in the wallet page
      const { getPrivateTokenDecimals } = await import("./private-token-config");
      
      for (const [mint, privateBal] of Object.entries(privBalancesMap)) {
        const privateBalNum = typeof privateBal === 'number' ? privateBal : 0;
        // Skip SOL - it's handled separately in the wallet page
        if (mint === SOL_MINT) continue;
        if (privateBalNum > 0 && !mappedTokens.find(t => t.mint === mint)) {
          // Token exists only in private balance, add it to the list
          const priceInfo = priceMap.get(mint);
          const meta = metaMap.get(mint);
          const decimals = getPrivateTokenDecimals(mint);
          
          let symbol = meta?.symbol || "TOKEN";
          let name = meta?.name || "Token";
          
          if (mint === SOL_MINT) {
            symbol = "SOL";
            name = "Solana";
          } else if (!meta?.symbol && !meta?.name) {
            symbol = mint.slice(0, 4);
            name = truncateAddress(mint, 4);
          }
          
          mappedTokens.push({
            mint,
            symbol,
            name,
            amount: "0",
            decimals,
            uiAmount: 0,
            privateBalance: privateBalNum,
            priceUsd: priceInfo?.priceUsd ?? null,
            marketCapUsd: priceInfo?.marketCapUsd ?? null,
            imageUrl: meta?.imageUrl ?? null,
          });
        }
      }

      setPublicBalance(pubBal);
      setPrivateBalance(privBal);
      setPrivateBalances(privBalancesMap);
      setSplTokens(mappedTokens);
    } catch (error) {
      console.error("Failed to refresh balances:", error);
    }
  }, [activeKeypair]);

  useEffect(() => {
    if (isUnlocked && activeKeypair) {
      refreshBalances();
      const interval = setInterval(refreshBalances, 30000);
      return () => clearInterval(interval);
    }
  }, [isUnlocked, activeKeypair, refreshBalances]);

  const createWallet = useCallback(
    async (password: string, mnemonicWords: number = 12): Promise<string> => {
      setIsLoading(true);
      try {
        const strength = mnemonicWords === 24 ? 256 : 128;
        const newMnemonic = generateMnemonic(strength as 128 | 256);
        const newSeed = await mnemonicToSeed(newMnemonic);
        const wallets = deriveWalletsFromSeed(newSeed, 5);

        const encrypted = await encryptSeed(newSeed, password);
        const encryptedMnemonic = await encryptSeed(
          new TextEncoder().encode(newMnemonic),
          password
        );
        localStorage.setItem(STORAGE_KEY, encrypted);
        localStorage.setItem(MNEMONIC_STORAGE_KEY, encryptedMnemonic);
        localStorage.setItem(WALLET_INDEX_KEY, "0");

        setSeed(newSeed);
        setDerivedWallets(wallets);
        setActiveWalletIndex(0);
        setIsUnlocked(true);
        setHasWallet(true);
        setMnemonic(newMnemonic);

        return newMnemonic;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const importWallet = useCallback(
    async (importMnemonic: string, password: string): Promise<void> => {
      setIsLoading(true);
      try {
        if (!validateMnemonic(importMnemonic)) {
          throw new Error("Invalid mnemonic phrase");
        }

        const newSeed = await mnemonicToSeed(importMnemonic);
        const wallets = deriveWalletsFromSeed(newSeed, 5);

        const encrypted = await encryptSeed(newSeed, password);
        const encryptedMnemonic = await encryptSeed(
          new TextEncoder().encode(importMnemonic),
          password
        );
        localStorage.setItem(STORAGE_KEY, encrypted);
        localStorage.setItem(MNEMONIC_STORAGE_KEY, encryptedMnemonic);
        localStorage.setItem(WALLET_INDEX_KEY, "0");

        setSeed(newSeed);
        setDerivedWallets(wallets);
        setActiveWalletIndex(0);
        setIsUnlocked(true);
        setHasWallet(true);
        setMnemonic(importMnemonic);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const unlockWallet = useCallback(async (password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const encrypted = localStorage.getItem(STORAGE_KEY);
      if (!encrypted) {
        throw new Error("No wallet found");
      }

      const decryptedSeed = await decryptSeed(encrypted, password);
      const wallets = deriveWalletsFromSeed(decryptedSeed, 5);

      // Try to restore mnemonic if available
      const encryptedMnemonic = localStorage.getItem(MNEMONIC_STORAGE_KEY);
      let restoredMnemonic: string | null = null;
      if (encryptedMnemonic) {
        try {
          const decryptedMnemonicBytes = await decryptSeed(
            encryptedMnemonic,
            password
          );
          restoredMnemonic = new TextDecoder().decode(decryptedMnemonicBytes);
        } catch (e) {
          console.warn("Failed to decrypt mnemonic:", e);
        }
      }

      const savedIndex = localStorage.getItem(WALLET_INDEX_KEY);
      const index = savedIndex ? parseInt(savedIndex, 10) : 0;

      setSeed(decryptedSeed);
      setDerivedWallets(wallets);
      setActiveWalletIndex(index);
      setMnemonic(restoredMnemonic);
      setIsUnlocked(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const lockWallet = useCallback(() => {
    setSeed(null);
    setDerivedWallets([]);
    setIsUnlocked(false);
    setPublicBalance(0);
    setPrivateBalance(0);
    setPrivateBalances({});
    setMnemonic(null);
    setSplTokens([]);
    resetEncifherClient();
  }, []);

  const deleteWallet = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(MNEMONIC_STORAGE_KEY);
    localStorage.removeItem(WALLET_INDEX_KEY);
    setSeed(null);
    setDerivedWallets([]);
    setActiveWalletIndex(0);
    setIsUnlocked(false);
    setHasWallet(false);
    setPublicBalance(0);
    setPrivateBalance(0);
    setPrivateBalances({});
    setMnemonic(null);
    setSplTokens([]);
    resetEncifherClient();
  }, []);

  const switchWallet = useCallback(
    (index: number) => {
      if (index >= 0 && index < derivedWallets.length) {
        setActiveWalletIndex(index);
        localStorage.setItem(WALLET_INDEX_KEY, index.toString());
        resetEncifherClient();
      }
    },
    [derivedWallets.length]
  );

  const sendPublic = useCallback(
    async (toAddress: string, amountSol: number): Promise<string> => {
      if (!activeKeypair) throw new Error("Wallet not unlocked");
      const signature = await sendSol(activeKeypair, toAddress, amountSol);
      await refreshBalances();
      return signature;
    },
    [activeKeypair, refreshBalances]
  );

  const sendPrivately = useCallback(
    async (
      toAddress: string,
      amountSol: number
    ): Promise<{ depositSig: string; withdrawSig: string }> => {
      if (!activeKeypair) throw new Error("Wallet not unlocked");
      const result = await sendPrivate(activeKeypair, toAddress, amountSol);
      await refreshBalances();
      return result;
    },
    [activeKeypair, refreshBalances]
  );

  const deposit = useCallback(
    async (amount: number, tokenMint: string, decimals: number): Promise<string> => {
      if (!activeKeypair) throw new Error("Wallet not unlocked");
      const signature = await depositToPrivate(activeKeypair, amount, tokenMint, decimals);
      await refreshBalances();
      return signature;
    },
    [activeKeypair, refreshBalances]
  );

  const withdraw = useCallback(
    async (toAddress: string, amount: number, tokenMint: string, decimals: number): Promise<string> => {
      if (!activeKeypair) throw new Error("Wallet not unlocked");
      const signature = await withdrawFromPrivate(
        activeKeypair,
        toAddress,
        amount,
        tokenMint,
        decimals
      );
      await refreshBalances();
      return signature;
    },
    [activeKeypair, refreshBalances]
  );

  const swapPrivately = useCallback(
    async (
      fromMint: string,
      toMint: string,
      amountIn: number,
      onStatusUpdate?: (status: string, attempt: number) => void
    ): Promise<string> => {
      if (!activeKeypair) throw new Error("Wallet not unlocked");
      const signature = await swapPrivate(
        activeKeypair,
        fromMint,
        toMint,
        amountIn,
        onStatusUpdate
      );
      await refreshBalances();
      return signature;
    },
    [activeKeypair, refreshBalances]
  );

  const swapPublic = useCallback(
    async (transaction: string, requestId: string): Promise<string> => {
      if (!activeKeypair) throw new Error("Wallet not unlocked");
      
      // console.log("[Wallet] Starting public swap via Jupiter");
      
      // Deserialize the transaction
      const { VersionedTransaction, Transaction } = await import("@solana/web3.js");
      const txBuffer = Buffer.from(transaction, "base64");
      
      let signedTxBase64: string;
      
      try {
        // Try VersionedTransaction first
        const versionedTx = VersionedTransaction.deserialize(txBuffer);
        versionedTx.sign([activeKeypair]);
        signedTxBase64 = Buffer.from(versionedTx.serialize()).toString("base64");
        // console.log("[Wallet] Signed versioned transaction");
      } catch (e) {
        // Try legacy Transaction
        const legacyTx = Transaction.from(txBuffer);
        legacyTx.partialSign(activeKeypair);
        signedTxBase64 = legacyTx.serialize().toString("base64");
        // console.log("[Wallet] Signed legacy transaction");
      }
      
      // Execute via Jupiter
      const executeResponse = await fetch("/api/jupiter/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedTransaction: signedTxBase64,
          requestId,
        }),
      });
      
      if (!executeResponse.ok) {
        const errorData = await executeResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to execute Jupiter swap");
      }
      
      const result = await executeResponse.json();
      // console.log("[Wallet] Jupiter swap result:", result);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      await refreshBalances();
      return result.signature || "swap_completed";
    },
    [activeKeypair, refreshBalances]
  );

  const signTransaction = useCallback(
    async (instructions: TransactionInstruction[]): Promise<string> => {
      if (!activeKeypair) throw new Error("Wallet not unlocked");
      return signAndSendTransaction(activeKeypair, instructions);
    },
    [activeKeypair]
  );

  const getStealthAddress = useCallback(
    (index: number): DerivedWallet | null => {
      if (!seed) return null;
      return deriveStealthAddress(seed, index);
    },
    [seed]
  );

  const requestDevnetAirdrop = useCallback(async (): Promise<string> => {
    if (!activeKeypair) throw new Error("Wallet not unlocked");
    const signature = await requestAirdrop(activeKeypair.publicKey, 1);
    await refreshBalances();
    return signature;
  }, [activeKeypair, refreshBalances]);

  const getActiveKeypair = useCallback((): Keypair | null => {
    return activeKeypair;
  }, [activeKeypair]);

  const value: WalletContextType = {
    isUnlocked,
    isLoading,
    hasWallet,
    publicKey,
    publicBalance,
    privateBalance,
    privateBalances,
    activeWalletIndex,
    derivedWallets,
    mnemonic,
    tokens: splTokens,
    createWallet,
    importWallet,
    unlockWallet,
    lockWallet,
    deleteWallet,
    switchWallet,
    refreshBalances,
    sendPublic,
    sendPrivately,
    deposit,
    withdraw,
    swapPrivately,
    swapPublic,
    signTransaction,
    getStealthAddress,
    requestDevnetAirdrop,
    getActiveKeypair,
    splTokens,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet(): WalletContextType {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}

export { truncateAddress };

