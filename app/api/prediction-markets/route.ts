import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { PredictionMarketRepo } from "@/lib/prediction-market/repo";
import { PredictionMarketService } from "@/lib/prediction-market/service";
import { PredictionMarketEventFilter } from "@/lib/prediction-market/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");
    const orderBy = searchParams.get("orderBy");
    const ascending = searchParams.get("ascending");
    const provider = searchParams.get("provider");
    const category = searchParams.get("category");
    const active = searchParams.get("active");
    const featured = searchParams.get("featured");
    const search = searchParams.get("search");

    let supabase;
    try {
      supabase = getSupabaseClient();
    } catch (supabaseError: unknown) {
      const supabaseMessage = supabaseError instanceof Error 
        ? supabaseError.message 
        : "Failed to initialize Supabase client";
      console.error("[Prediction Markets API] Supabase init error:", supabaseError);
      return NextResponse.json(
        { error: `Supabase configuration error: ${supabaseMessage}` },
        { status: 500 }
      );
    }

    const repo = new PredictionMarketRepo(supabase);
    const service = new PredictionMarketService(repo);

    const filters: PredictionMarketEventFilter = {};
    if (provider) filters.provider = provider;
    if (category) filters.category = category;
    if (active !== null) filters.active = active === "true";
    if (featured !== null) filters.featured = featured === "true";
    if (search) filters.search = search;

    const options = {
      limit: Math.min(parseInt(limit as string) || 50, 100),
      offset: parseInt(offset as string) || 0,
      orderBy: (orderBy as string) || "volume",
      ascending: ascending === "true",
    };

    const result = await service.list(filters, options);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[Prediction Markets API] Error:", error);
    console.error("[Prediction Markets API] Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    let message = "Failed to fetch prediction markets";
    if (error instanceof Error) {
      message = error.message || message;
    } else if (typeof error === "object" && error !== null) {
      const errorObj = error as Record<string, unknown>;
      if (errorObj.message) {
        message = String(errorObj.message);
      } else if (errorObj.error) {
        message = String(errorObj.error);
      }
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

