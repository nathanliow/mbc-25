import { NextRequest, NextResponse } from "next/server";

const JUPITER_ULTRA_API_URL = "https://api.jup.ag/ultra/v1/order";
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
    const { inputMint, outputMint, amount, taker } = body;

    console.log("[Jupiter] Quote request:", { inputMint, outputMint, amount, taker });

    if (!inputMint || !outputMint || !amount || !taker) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Prevent swapping same token to itself
    if (inputMint === outputMint) {
      return NextResponse.json(
        { error: "Cannot swap token to itself" },
        { status: 400 }
      );
    }

    // Jupiter Ultra API expects GET with query parameters
    const url =
      `${JUPITER_ULTRA_API_URL}` +
      `?inputMint=${encodeURIComponent(inputMint)}` +
      `&outputMint=${encodeURIComponent(outputMint)}` +
      `&amount=${encodeURIComponent(String(amount))}` +
      `&taker=${encodeURIComponent(taker)}`;

    console.log("[Jupiter] Calling Jupiter API:", url);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": JUPITER_API_KEY,
      },
    });

    const responseText = await res.text();
    console.log("[Jupiter] Response status:", res.status, res.statusText);
    console.log("[Jupiter] Response body:", responseText);

    if (!res.ok) {
      console.error("[Jupiter] Quote API error:", res.status, res.statusText, responseText);
      return NextResponse.json(
        { error: `Failed to fetch quote from Jupiter: ${responseText}` },
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
    console.error("[Jupiter] Quote route error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch quote from Jupiter" },
      { status: 500 }
    );
  }
}


