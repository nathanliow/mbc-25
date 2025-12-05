import { NextRequest, NextResponse } from "next/server";

const JUPITER_ULTRA_EXECUTE_URL = "https://api.jup.ag/ultra/v1/execute";
const JUPITER_API_KEY = process.env.JUPITER_API_KEY || "";

export async function POST(request: NextRequest) {
  try {
    if (!JUPITER_API_KEY || JUPITER_API_KEY.trim() === "") {
      console.error("[Jupiter] API key not configured");
      return NextResponse.json(
        { error: "Jupiter API key not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { signedTransaction, requestId } = body;

    if (!signedTransaction || !requestId) {
      return NextResponse.json(
        { error: "Missing required parameters: signedTransaction, requestId" },
        { status: 400 }
      );
    }

    console.log("[Jupiter] Executing swap with requestId:", requestId);

    const res = await fetch(JUPITER_ULTRA_EXECUTE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": JUPITER_API_KEY,
      },
      body: JSON.stringify({
        signedTransaction,
        requestId,
      }),
    });

    const responseText = await res.text();
    console.log("[Jupiter] Execute response status:", res.status, res.statusText);
    console.log("[Jupiter] Execute response body:", responseText);

    if (!res.ok) {
      console.error("[Jupiter] Execute error:", res.status, res.statusText, responseText);
      return NextResponse.json(
        { error: `Failed to execute swap: ${responseText}` },
        { status: res.status || 500 }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("[Jupiter] Failed to parse response as JSON:", responseText);
      return NextResponse.json(
        { error: "Invalid JSON response from Jupiter" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[Jupiter] Execute route error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute swap" },
      { status: 500 }
    );
  }
}

