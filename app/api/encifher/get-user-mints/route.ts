import { NextRequest, NextResponse } from "next/server";
import { DefiClient } from "encifher-swap-sdk";
import { PublicKey } from "@solana/web3.js";

const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";
const ENCIFHER_API_KEY =
  process.env.NEXT_PUBLIC_ENCIFHER_API_KEY || "";

export async function POST(request: NextRequest) {
  try {
    if (!ENCIFHER_API_KEY || ENCIFHER_API_KEY.trim() === "") {
      return NextResponse.json(
        { error: "Encifher API key not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { publicKey } = body;

    if (!publicKey) {
      return NextResponse.json(
        { error: "Missing required parameter: publicKey" },
        { status: 400 }
      );
    }

    const mode = RPC_URL.includes("mainnet") ? "Mainnet" : "Mainnet";
    const client = new DefiClient({
      rpcUrl: RPC_URL,
      encifherKey: ENCIFHER_API_KEY,
      mode: mode as "Mainnet" | "Devnet",
    });

    const mints = await client.getUserTokenMints(new PublicKey(publicKey));
    const userTokenMints = mints.map((m: any) => m.mint);

    return NextResponse.json({ mints: userTokenMints });
  } catch (error: any) {
    console.error("[Encifher API] Failed to get user token mints:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get user token mints" },
      { status: 500 }
    );
  }
}


