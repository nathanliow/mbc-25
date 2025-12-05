import { NextRequest, NextResponse } from "next/server";
import { DefiClient } from "encifher-swap-sdk";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

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
    const { depositor, amountLamports, tokenMint, decimals } = body;

    if (!depositor || !amountLamports || !tokenMint || !decimals) {
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

    const depositorPubkey = new PublicKey(depositor);

    const txn = await client.getDepositTxn({
      depositor: depositorPubkey,
      token: {
        tokenMintAddress: tokenMint,
        decimals: decimals,
      },
      amount: String(amountLamports),
    });

    const serialized = txn
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    return NextResponse.json({ transaction: serialized });
  } catch (error: any) {
    console.error("[Encifher API] Failed to get deposit transaction:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get deposit transaction" },
      { status: 500 }
    );
  }
}


