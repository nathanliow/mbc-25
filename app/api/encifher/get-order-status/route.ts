import { NextRequest, NextResponse } from "next/server";
import { DefiClient, DefiClientConfig } from "encifher-swap-sdk";

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
    const { orderStatusIdentifier } = body;

    if (!orderStatusIdentifier) {
      return NextResponse.json(
        { error: "Missing required parameter: orderStatusIdentifier" },
        { status: 400 }
      );
    }

    // console.log("[Encifher] Getting order status:", orderStatusIdentifier);

    const config: DefiClientConfig = {
      encifherKey: ENCIFHER_API_KEY,
      rpcUrl: RPC_URL,
      mode: "Mainnet",
    };
    const client = new DefiClient(config);

    const { status } = await client.getOrderStatus({
      orderStatusIdentifier,
    });

    // console.log("[Encifher] Order status:", status);

    return NextResponse.json({ status });
  } catch (error: any) {
    console.error("[Encifher] Get order status error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get order status" },
      { status: 500 }
    );
  }
}

