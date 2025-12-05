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
    const { inMint, outMint, amountIn } = body;

    if (!inMint || !outMint || !amountIn) {
      return NextResponse.json(
        { error: "Missing required parameters: inMint, outMint, amountIn" },
        { status: 400 }
      );
    }

    // console.log("[Encifher] Getting swap quote:", { inMint, outMint, amountIn });

    const config: DefiClientConfig = {
      encifherKey: ENCIFHER_API_KEY,
      rpcUrl: RPC_URL,
      mode: "Mainnet",
    };
    const client = new DefiClient(config);

    const quote = await client.getSwapQuote({
      inMint,
      outMint,
      amountIn: amountIn.toString(),
    });

    // console.log("[Encifher] Swap quote received:", quote);

    return NextResponse.json(quote);
  } catch (error: any) {
    console.error("[Encifher] Get swap quote error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get swap quote" },
      { status: 500 }
    );
  }
}

