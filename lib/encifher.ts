"use client";

import {
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  VersionedTransaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { DefiClient } from "encifher-swap-sdk";
import { getConnection } from "./solana";
import { SOL_MINT, USDC_MINT, USDT_MINT } from "./const";
import bs58 from "bs58";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";
const ENCIFHER_API_KEY = process.env.NEXT_PUBLIC_ENCIFHER_API_KEY || "";

// Get or create Encifher client instance
let encifherClient: DefiClient | null = null;

function getEncifherClient(): DefiClient | null {
  if (!ENCIFHER_API_KEY || ENCIFHER_API_KEY.trim() === "") {
    return null;
  }
  if (!encifherClient) {
    const mode = RPC_URL.includes("mainnet") ? "Mainnet" : "Mainnet";
    encifherClient = new DefiClient({
      rpcUrl: RPC_URL,
      encifherKey: ENCIFHER_API_KEY,
      mode: mode as "Mainnet" | "Devnet",
    });
  }
  return encifherClient;
}

export function resetEncifherClient(): void {
  encifherClient = null;
}

export interface PrivateBalances {
  solBalance: number;
  balances: Record<string, number>; // mint -> balance in token units
}

export async function getPrivateBalance(keypair: Keypair): Promise<PrivateBalances> {
  try {
    if (!ENCIFHER_API_KEY || ENCIFHER_API_KEY.trim() === "") {
      console.warn("[Encifher] API key not configured. Private balance unavailable.");
      return {
        solBalance: 0,
        balances: {},
      };
    }
    
    // Use token config from localStorage instead of fetching from Encifher
    const { getPrivateTokenMints } = await import("./private-token-config");
    const tokenMints = getPrivateTokenMints();

    // console.log("[Encifher] Using token mints from config:", tokenMints);

    // console.log("[Encifher] Getting message to sign via API route...");
    
    // Get message to sign via API route (server-side to avoid CORS)
    const messageResponse = await fetch("/api/encifher/get-message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!messageResponse.ok) {
      const errorData = await messageResponse.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to get message to sign");
    }

    const authParams = await messageResponse.json();
    // console.log("[Encifher] Successfully got message to sign");
    
    const messageHash = Buffer.from(authParams.msgHash);
    const nacl = await import("tweetnacl");
    const sigBuff = nacl.sign.detached(messageHash, keypair.secretKey);
    // Convert signature to base64 to match Encifher's checkSignature(msg, base64Sig)
    const signature = Buffer.from(sigBuff).toString("base64");
    
    // console.log("[Encifher] Getting balance via API route...");
    // Get balance via API route
    const balanceResponse = await fetch("/api/encifher/get-balance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        publicKey: keypair.publicKey.toBase58(),
        signature,
        timestamp: authParams.timestamp,
        tokenMints,
      }),
    });

    if (!balanceResponse.ok) {
      const errorData = await balanceResponse.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to get balance");
    }

    const balances = await balanceResponse.json();
    // console.log("[Encifher] Raw balances received:", balances);
    // console.log("[Encifher] userBalance (all mints):", balances);

    // balances is an array of objects like [{ [mint]: string }] (BigInt → string)
    // Convert to a map of mint -> balance (in token units)
    const { getPrivateTokenDecimals } = await import("./private-token-config");
    const balanceMap: Record<string, number> = {};
    
    for (const balanceObj of balances) {
      for (const [mint, balanceStr] of Object.entries(balanceObj)) {
        const decimals = getPrivateTokenDecimals(mint);
        const balance = Number(balanceStr) / Math.pow(10, decimals);
        balanceMap[mint] = balance;
        // console.log(`[Encifher] Private balance for ${mint}: ${balance} (raw: ${balanceStr}, decimals: ${decimals})`);
      }
    }

    // For backward compatibility, also return SOL balance
    const solBalance = balanceMap[SOL_MINT] || 0;
    // console.log("[Encifher] Private SOL balance:", solBalance, "SOL");

    return {
      solBalance,
      balances: balanceMap,
    };
  } catch (error: any) {
    console.error("[Encifher] Failed to get private balance:", error);
    console.error("[Encifher] Error type:", error?.constructor?.name);
    console.error("[Encifher] Error message:", error?.message);
    if (error?.stack) {
      console.error("[Encifher] Stack trace:", error.stack);
    }
    return {
      solBalance: 0,
      balances: {},
    };
  }
}

export async function depositToPrivate(
  keypair: Keypair,
  amount: number,
  tokenMint: string,
  decimals: number
): Promise<string> {
  try {
    if (!ENCIFHER_API_KEY || ENCIFHER_API_KEY.trim() === "") {
      throw new Error("Encifher API key not configured. Please set NEXT_PUBLIC_ENCIFHER_API_KEY");
    }
    const amountInSmallestUnit = Math.floor(amount * Math.pow(10, decimals));

    // Get deposit transaction via API route (server-side to avoid CORS)
    const response = await fetch("/api/encifher/get-deposit-tx", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        depositor: keypair.publicKey.toBase58(),
        amountLamports: amountInSmallestUnit,
        tokenMint,
        decimals,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to get deposit transaction");
    }

    const { transaction } = await response.json();
    if (!transaction || typeof transaction !== "string") {
      throw new Error("Invalid deposit transaction payload from API");
    }

    const raw = Buffer.from(transaction, "base64");

    // Handle both legacy and v0 (versioned) transactions
    let depositTxn: Transaction | VersionedTransaction;
    try {
      depositTxn = VersionedTransaction.deserialize(raw);
      console.log("[Encifher] Deserialized deposit transaction as VersionedTransaction");
    } catch {
      depositTxn = Transaction.from(raw);
      console.log("[Encifher] Deserialized deposit transaction as legacy Transaction");
    }

    const connection = getConnection();

    let signature: string;
    if (depositTxn instanceof VersionedTransaction) {
      // VersionedTransaction uses sign() method
      depositTxn.sign([keypair]);
      const {
        context: { slot: minContextSlot },
      } = await connection.getLatestBlockhashAndContext();
      signature = await connection.sendTransaction(depositTxn, {
        minContextSlot,
        preflightCommitment: "confirmed",
        skipPreflight: false,
      });
      await connection.confirmTransaction(signature, "confirmed");
      // console.log("[Encifher] Versioned deposit transaction sent. Signature:", signature);
    } else {
      // Regular Transaction uses partialSign() (matches example)
      depositTxn.partialSign(keypair);
      const {
        context: { slot: minContextSlot },
      } = await connection.getLatestBlockhashAndContext();
      signature = await sendAndConfirmTransaction(
        connection,
        depositTxn,
        [keypair],
        {
          minContextSlot,
          preflightCommitment: "confirmed",
          commitment: "confirmed",
        }
      );
      // console.log("[Encifher] Legacy deposit transaction sent. Signature:", signature);
    }

    // Add token to private token config on successful deposit
    const { addPrivateToken } = await import("./private-token-config");
    addPrivateToken(tokenMint, decimals);
    // console.log(`[Encifher] Added token ${tokenMint} to private token config after successful deposit`);

    return signature;
  } catch (error: any) {
    console.error("[Encifher] Deposit error:", error);
    throw new Error(error.message || "Failed to deposit to Encifher");
  }
}

export async function withdrawFromPrivate(
  keypair: Keypair,
  recipientAddress: string,
  amount: number,
  tokenMint: string,
  decimals: number
): Promise<string> {
  try {
    if (!ENCIFHER_API_KEY || ENCIFHER_API_KEY.trim() === "") {
      throw new Error("Encifher API key not configured. Please set NEXT_PUBLIC_ENCIFHER_API_KEY");
    }
    const amountInSmallestUnit = Math.floor(amount * Math.pow(10, decimals));

    // Get withdraw transaction via API route (server-side to avoid CORS / Node-only deps)
    const response = await fetch("/api/encifher/get-withdraw-tx", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        withdrawer: keypair.publicKey.toBase58(),
        amountLamports: amountInSmallestUnit,
        receiver: recipientAddress || null,
        tokenMint,
        decimals,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to get withdraw transaction");
    }

    const { transaction } = await response.json();
    if (!transaction || typeof transaction !== "string") {
      throw new Error("Invalid withdraw transaction payload from API");
    }

    const raw = Buffer.from(transaction, "base64");

    // Handle both legacy and v0 (versioned) transactions
    let withdrawTxn: Transaction | VersionedTransaction;
    try {
      withdrawTxn = VersionedTransaction.deserialize(raw);
      // console.log("[Encifher] Deserialized withdraw transaction as VersionedTransaction");
    } catch {
      withdrawTxn = Transaction.from(raw);
      // console.log("[Encifher] Deserialized withdraw transaction as legacy Transaction");
    }

    const connection = getConnection();

    if (withdrawTxn instanceof VersionedTransaction) {
      // VersionedTransaction uses sign() method
      withdrawTxn.sign([keypair]);
      const {
        context: { slot: minContextSlot },
      } = await connection.getLatestBlockhashAndContext();
      const signature = await connection.sendTransaction(withdrawTxn, {
        minContextSlot,
        preflightCommitment: "confirmed",
        skipPreflight: false,
      });
      await connection.confirmTransaction(signature, "confirmed");
      // console.log("[Encifher] Versioned withdraw transaction sent. Signature:", signature);
      return signature;
    } else {
      // Regular Transaction uses partialSign() (matches example)
      withdrawTxn.partialSign(keypair);
      const {
        context: { slot: minContextSlot },
      } = await connection.getLatestBlockhashAndContext();
      const signature = await sendAndConfirmTransaction(
        connection,
        withdrawTxn,
        [keypair],
        {
          minContextSlot,
          preflightCommitment: "confirmed",
          commitment: "confirmed",
        }
      );
      // console.log("[Encifher] Legacy withdraw transaction sent. Signature:", signature);
      return signature;
    }
  } catch (error: any) {
    console.error("[Encifher] Withdraw error:", error);
    throw new Error(error.message || "Failed to withdraw from Encifher");
  }
}

export async function sendPrivate(
  keypair: Keypair,
  recipientAddress: string,
  amountSol: number
): Promise<{ depositSig: string; withdrawSig: string }> {
  try {
    const client = getEncifherClient();
    if (!client) {
      throw new Error("Encifher API key not configured. Please set NEXT_PUBLIC_ENCIFHER_API_KEY");
    }
    const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
    
    // Get anon transfer message to sign via API route (server-side to avoid CORS)
    const messageResponse = await fetch("/api/encifher/get-anon-transfer-message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: keypair.publicKey.toBase58(),
        receiver: recipientAddress,
        amount: amountLamports.toString(),
        tokenMint: SOL_MINT,
      }),
    });

    if (!messageResponse.ok) {
      const errorData = await messageResponse.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to get anon transfer message");
    }

    const anonTransferMsg = await messageResponse.json();
    
    const messageHash = Buffer.from(anonTransferMsg.msgHash);
    const nacl = await import("tweetnacl");
    const sigBuff = nacl.sign.detached(messageHash, keypair.secretKey);
    const signatureString = bs58.encode(sigBuff);
    
    // Send signed anon transfer via API route
    const sendResponse = await fetch("/api/encifher/send-anon-transfer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        extendedAnonTransferParams: anonTransferMsg.extendedAnonTransferParams,
        signature: signatureString,
      }),
    });

    if (!sendResponse.ok) {
      const errorData = await sendResponse.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to send anon transfer");
    }

    const result = await sendResponse.json();
    
    return {
      depositSig: result.signature,
      withdrawSig: result.signature,
    };
  } catch (error: any) {
    console.error("[Encifher] Send private error:", error);
    throw new Error(error.message || "Failed to send privately");
  }
}

export async function swapPrivate(
  keypair: Keypair,
  fromTokenMint: string,
  toTokenMint: string,
  amount: number,
  onStatusUpdate?: (status: string, attempt: number) => void
): Promise<string> {
  try {
    // console.log("[Encifher] Starting private swap:", { fromTokenMint, toTokenMint, amount });

    // Get swap transaction via API route
    const txResponse = await fetch("/api/encifher/get-swap-tx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inMint: fromTokenMint,
        outMint: toTokenMint,
        amountIn: amount.toString(),
        senderPubkey: keypair.publicKey.toBase58(),
        receiverPubkey: keypair.publicKey.toBase58(),
      }),
    });

    if (!txResponse.ok) {
      const errorData = await txResponse.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to get swap transaction");
    }

    const { transaction: serializedTxn } = await txResponse.json();
    // console.log("[Encifher] Received swap transaction");

    // Deserialize and sign the transaction locally
    const { Transaction } = await import("@solana/web3.js");
    const txBuffer = Buffer.from(serializedTxn, "base64");
    const swapTxn = Transaction.from(txBuffer);
    
    // Sign transaction locally
    swapTxn.partialSign(keypair);
    // console.log("[Encifher] Transaction signed locally");
    
    // Serialize signed transaction
    const signedSerializedTxn = swapTxn.serialize().toString("base64");

    // Execute swap via API route
    const executeResponse = await fetch("/api/encifher/execute-swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serializedTxn: signedSerializedTxn,
        orderDetails: {
          inMint: fromTokenMint,
          outMint: toTokenMint,
          amountIn: amount.toString(),
          senderPubkey: keypair.publicKey.toBase58(),
          receiverPubkey: keypair.publicKey.toBase58(),
        },
      }),
    });

    if (!executeResponse.ok) {
      const errorData = await executeResponse.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to execute swap");
    }

    const executeResult = await executeResponse.json();
    // console.log("[Encifher] Swap executed:", executeResult);

    // Poll for order status
    const MAX_TRIES = 5;
    const orderStatusIdentifier = executeResult.orderStatusIdentifier;

    if (orderStatusIdentifier) {
      for (let i = 0; i < MAX_TRIES; i++) {
        try {
          const statusResponse = await fetch("/api/encifher/get-order-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderStatusIdentifier }),
          });

          if (statusResponse.ok) {
            const { status } = await statusResponse.json();
            // console.log(`[Encifher] Attempt ${i + 1}/${MAX_TRIES}, status: ${status}`);
            
            if (onStatusUpdate) {
              onStatusUpdate(status, i + 1);
            }

            if (status === "completed") {
              // console.log("[Encifher] Swap completed");
              
              // Add both tokens to private token config on successful swap
              const { addPrivateToken, getPrivateTokenDecimals } = await import("./private-token-config");
              
              // Get decimals - use common defaults or lookup from config
              const getTokenDecimals = (mint: string): number => {
                if (mint === SOL_MINT) return 9;
                if (mint === USDC_MINT) return 6;
                if (mint === USDT_MINT) return 6;
                return getPrivateTokenDecimals(mint);
              };
              
              addPrivateToken(fromTokenMint, getTokenDecimals(fromTokenMint));
              addPrivateToken(toTokenMint, getTokenDecimals(toTokenMint));
              // console.log("[Encifher] Added swap tokens to private token config:", { fromTokenMint, toTokenMint });
              
              return executeResult.txHash || "swap_completed";
            } else if (status === "swap_failed") {
              throw new Error("Swap failed - slippage too low");
            } else if (status === "withdrawal_fallback") {
              throw new Error("Swap reverted - please try again");
            }
          }

          // Wait 3 seconds before next poll (except on last attempt)
          if (i < MAX_TRIES - 1) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
        } catch (statusError: any) {
          console.error(`[Encifher] Attempt ${i + 1}, status fetch error:`, statusError);
          // If it's a swap failure error, throw it immediately
          if (statusError.message?.includes("Swap failed") || statusError.message?.includes("Swap reverted")) {
            throw statusError;
          }
        }
      }
      
      // If we've exhausted all retries and still pending, return a timeout message
      console.warn(`[Encifher] Polling timeout after ${MAX_TRIES} attempts`);
      if (onStatusUpdate) {
        onStatusUpdate("timeout", MAX_TRIES);
      }
      return executeResult.txHash || "swap_pending_timeout";
    }

    return executeResult.txHash || "swap_submitted";
  } catch (error: any) {
    console.error("[Encifher] Swap error:", error);
    throw new Error(error.message || "Failed to swap");
  }
}

