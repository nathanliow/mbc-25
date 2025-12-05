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
    const { serializedTxn, orderDetails } = body;

    if (!serializedTxn || !orderDetails) {
      return NextResponse.json(
        { error: "Missing required parameters: serializedTxn, orderDetails" },
        { status: 400 }
      );
    }

    // console.log("[Encifher] Executing swap:", { orderDetails });

    const config: DefiClientConfig = {
      encifherKey: ENCIFHER_API_KEY,
      rpcUrl: RPC_URL,
      mode: "Mainnet",
    };
    const client = new DefiClient(config);

    const executeResult = await client.executeSwapTxn({
      serializedTxn,
      orderDetails: {
        inMint: orderDetails.inMint,
        outMint: orderDetails.outMint,
        amountIn: orderDetails.amountIn.toString(),
        senderPubkey: new PublicKey(orderDetails.senderPubkey),
        receiverPubkey: new PublicKey(orderDetails.receiverPubkey || orderDetails.senderPubkey),
      },
    });

    // console.log("[Encifher] Swap executed:", executeResult);

    return NextResponse.json({
      orderStatusIdentifier: executeResult.orderStatusIdentifier,
      txHash: executeResult.txHash,
    });
  } catch (error: any) {
    console.error("[Encifher] Execute swap error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute swap" },
      { status: 500 }
    );
  }
}

