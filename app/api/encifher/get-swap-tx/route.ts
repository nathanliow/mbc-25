import { NextRequest, NextResponse } from "next/server";
import { DefiClient, DefiClientConfig } from "encifher-swap-sdk";
import { PublicKey } from "@solana/web3.js";

const ENCIFHER_API_KEY = process.env.NEXT_PUBLIC_ENCIFHER_API_KEY || "";
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";

export async function POST(request: NextRequest) {
  try {
    if (!ENCIFHER_API_KEY) {
      return NextResponse.json(
        { error: "Encifher API key not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { inMint, outMint, amountIn, senderPubkey, receiverPubkey } = body;

    if (!inMint || !outMint || !amountIn || !senderPubkey) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // console.log("[Encifher] Getting swap transaction:", { inMint, outMint, amountIn, senderPubkey });

    const config: DefiClientConfig = {
      encifherKey: ENCIFHER_API_KEY,
      rpcUrl: RPC_URL,
      mode: "Mainnet",
    };
    const client = new DefiClient(config);

    const swapTxn = await client.getSwapTxn({
      inMint,
      outMint,
      amountIn: amountIn.toString(),
      senderPubkey: new PublicKey(senderPubkey),
      receiverPubkey: new PublicKey(receiverPubkey || senderPubkey),
    });

    // Serialize transaction to base64
    const serializedTxn = swapTxn.serialize({ requireAllSignatures: false }).toString("base64");

    // console.log("[Encifher] Swap transaction created");

    return NextResponse.json({ transaction: serializedTxn });
  } catch (error: any) {
    console.error("[Encifher] Get swap tx error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get swap transaction" },
      { status: 500 }
    );
  }
}

