import { NextRequest, NextResponse } from "next/server";
import { DefiClient } from "encifher-swap-sdk";
import { PublicKey } from "@solana/web3.js";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";
const ENCIFHER_API_KEY = process.env.NEXT_PUBLIC_ENCIFHER_API_KEY || "";

export async function POST(request: NextRequest) {
  try {
    if (!ENCIFHER_API_KEY || ENCIFHER_API_KEY.trim() === "") {
      return NextResponse.json(
        { error: "Encifher API key not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { publicKey, signature, timestamp, tokenMints } = body;

    if (!publicKey || !signature || !timestamp || !tokenMints) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const mode = RPC_URL.includes("mainnet") ? "Mainnet" : "Mainnet";
    const client = new DefiClient({
      rpcUrl: RPC_URL,
      encifherKey: ENCIFHER_API_KEY,
      mode: mode as "Mainnet" | "Devnet",
    });

    const balances = await client.getBalance(
      new PublicKey(publicKey),
      {
        signature,
        timestamp,
      },
      tokenMints,
      ENCIFHER_API_KEY
    );

    // Convert BigInt values to strings for JSON serialization
    const serializedBalances = balances.map((balance: any) => {
      const serialized: any = {};
      for (const [key, value] of Object.entries(balance)) {
        if (typeof value === "bigint") {
          serialized[key] = value.toString();
        } else {
          serialized[key] = value;
        }
      }
      return serialized;
    });

    return NextResponse.json(serializedBalances);
  } catch (error: any) {
    console.error("[Encifher API] Failed to get balance:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get balance" },
      { status: 500 }
    );
  }
}

