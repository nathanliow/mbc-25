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
    const { extendedAnonTransferParams, signature } = body;

    if (!extendedAnonTransferParams || !signature) {
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

    console.log("[Encifher API] Calling sendSignedAnonTransferParams with:", {
      rpcUrl: RPC_URL,
      hasParams: !!extendedAnonTransferParams,
      hasSignature: !!signature,
      paramsKeys: extendedAnonTransferParams ? Object.keys(extendedAnonTransferParams) : [],
    });

    let result;
    try {
      result = await client.sendSignedAnonTransferParams({
        extendedAnonTransferParams,
        signature,
      });
    } catch (sdkError: any) {
      console.error("[Encifher API] SDK error - Full details:", {
        message: sdkError.message,
        name: sdkError.name,
        stack: sdkError.stack,
        cause: sdkError.cause,
        toString: sdkError.toString(),
        // Check for nested errors
        ...(sdkError.error && { nestedError: sdkError.error }),
        ...(sdkError.response && { response: sdkError.response }),
        ...(sdkError.data && { data: sdkError.data }),
      });
      throw sdkError;
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Encifher API] Failed to send anon transfer:", error);
    console.error("[Encifher API] Error type:", typeof error);
    console.error("[Encifher API] Error constructor:", error?.constructor?.name);
    
    // Try to extract more details
    let errorMessage = error.message || "Failed to send anon transfer";
    
    // If the error message mentions deposit transaction, provide more context
    if (errorMessage.includes("deposit transaction") || errorMessage.includes("construct deposit")) {
      errorMessage = `Failed to construct deposit transaction. The SDK is trying to automatically deposit funds but cannot construct the transaction. This may be due to: (1) RPC connection issues, (2) Insufficient public balance for fees, or (3) SDK configuration problems. Original error: ${error.message}`;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

