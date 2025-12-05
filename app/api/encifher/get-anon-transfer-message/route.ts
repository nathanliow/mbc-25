import { NextRequest, NextResponse } from "next/server";
import { DefiClient } from "encifher-swap-sdk";

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
    const { sender, receiver, amount, tokenMint } = body;

    if (!sender || !receiver || !amount || !tokenMint) {
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

    const message = await client.getAnonTransferMessageToSign({
      sender,
      receiver,
      amount,
      tokenMint,
    });

    return NextResponse.json(message);
  } catch (error: any) {
    console.error("[Encifher API] Failed to get anon transfer message:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get anon transfer message" },
      { status: 500 }
    );
  }
}

