import { SupabaseClient } from "@supabase/supabase-js";
import {
  PredictionMarketEventSchema,
  PredictionMarketEventFilter,
  PredictionMarketEventListOptions,
  PredictionMarketDbRecord,
  mapDbToEvent,
} from "./types";

export class PredictionMarketRepo {
  constructor(private supabase: SupabaseClient) {}

  async findMany(
    filters?: PredictionMarketEventFilter,
    options?: PredictionMarketEventListOptions
  ): Promise<PredictionMarketEventSchema[]> {
    let query = this.supabase.from("prediction_market_events").select("*");

    if (filters) {
      if (filters.provider) {
        query = query.eq("provider", filters.provider);
      }
      if (filters.tags) {
        query = query.overlaps("tags", filters.tags);
      }
      if (filters.active !== undefined) {
        query = query.eq("active", filters.active);
      }
      if (filters.closed !== undefined) {
        const now = new Date().toISOString();
        if (filters.closed) {
          query = query.lt("endDate", now);
        } else {
          query = query.gte("endDate", now);
        }
      }
      if (filters.featured !== undefined) {
        query = query.eq("featured", filters.featured);
      }
      if (filters.category) {
        query = query.eq("category", filters.category);
      }
      if (filters.series) {
        query = query.eq("series", filters.series);
      }
      if (filters.ids && filters.ids.length > 0) {
        query = query.in("id", filters.ids);
      }
      if (filters.startDateMin) {
        query = query.gte("startDate", filters.startDateMin.toISOString());
      }
      if (filters.startDateMax) {
        query = query.lte("startDate", filters.startDateMax.toISOString());
      }
      if (filters.endDateMin) {
        query = query.gte("endDate", filters.endDateMin.toISOString());
      }
      if (filters.endDateMax) {
        query = query.lte("endDate", filters.endDateMax.toISOString());
      }
      if (filters.search) {
        query = query.or(
          `title.ilike.%${filters.search}%,subtitle.ilike.%${filters.search}%`
        );
      }
      if (filters.locationNotNull) {
        query = query.not("location", "is", null).neq("location", "");
      }
    }

    if (options) {
      const orderBy = options.orderBy || "createdAt";
      const ascending = options.ascending ?? false;
      
      const orderByColumn = orderBy === "volume" ? "volume" : 
                           orderBy === "createdAt" ? "createdAt" :
                           orderBy === "updatedAt" ? "updatedAt" :
                           orderBy === "startDate" ? "startDate" :
                           orderBy === "endDate" ? "endDate" :
                           orderBy;
      
      try {
        query = query.order(orderByColumn, { ascending });
      } catch (orderError) {
        console.warn(`[PredictionMarketRepo] Failed to order by ${orderByColumn}, using createdAt instead`);
        query = query.order("createdAt", { ascending: false });
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(
          options.offset,
          options.offset + (options.limit || 50) - 1
        );
      }
    }

    const { data, error } = await query;

    if (error) {
      const errorMessage = error.message || 
                          (error as any).error_description || 
                          (error as any).msg ||
                          "Database query failed";
      const errorDetails = {
        message: errorMessage,
        details: (error as any).details || error.details,
        hint: (error as any).hint || error.hint,
        code: (error as any).code || error.code,
        fullError: error,
      };
      console.error("[PredictionMarketRepo] Query error:", errorDetails);
      
      if (error.code === '57014') {
        throw new Error("Query timeout - the database query took too long. Please try again or contact support.");
      }
      
      throw new Error(errorMessage);
    }

    return data ? data.map((d: PredictionMarketDbRecord) => mapDbToEvent(d)) : [];
  }

  async count(filters?: PredictionMarketEventFilter): Promise<number> {
    let query = this.supabase
      .from("prediction_market_events")
      .select("*", { count: "exact", head: true });

    if (filters) {
      if (filters.provider) {
        query = query.eq("provider", filters.provider);
      }
      if (filters.tags) {
        query = query.overlaps("tags", filters.tags);
      }
      if (filters.active !== undefined) {
        query = query.eq("active", filters.active);
      }
      if (filters.closed !== undefined) {
        const now = new Date().toISOString();
        if (filters.closed) {
          query = query.lt("endDate", now);
        } else {
          query = query.gte("endDate", now);
        }
      }
      if (filters.featured !== undefined) {
        query = query.eq("featured", filters.featured);
      }
      if (filters.category) {
        query = query.eq("category", filters.category);
      }
      if (filters.series) {
        query = query.eq("series", filters.series);
      }
      if (filters.ids && filters.ids.length > 0) {
        query = query.in("id", filters.ids);
      }
      if (filters.startDateMin) {
        query = query.gte("startDate", filters.startDateMin.toISOString());
      }
      if (filters.startDateMax) {
        query = query.lte("startDate", filters.startDateMax.toISOString());
      }
      if (filters.endDateMin) {
        query = query.gte("endDate", filters.endDateMin.toISOString());
      }
      if (filters.endDateMax) {
        query = query.lte("endDate", filters.endDateMax.toISOString());
      }
      if (filters.search) {
        query = query.or(
          `title.ilike.%${filters.search}%,subtitle.ilike.%${filters.search}%`
        );
      }
      if (filters.locationNotNull) {
        query = query.not("location", "is", null).neq("location", "");
      }
      if (filters.locationEquals) {
        query = query.eq("location", filters.locationEquals);
      }
      if (filters.locationNotEquals) {
        query = query.neq("location", filters.locationNotEquals).not("location", "is", null);
      }
    }

    const { count, error } = await query;

    if (error) {
      const errorMessage = error.message || 
                          (error as any).error_description || 
                          (error as any).msg ||
                          "Database count query failed";
      
      // Only log if there's actual error information, otherwise it's likely a timeout/expected failure
      if (error.message || (error as any).code || (error as any).details) {
        const errorDetails = {
          message: errorMessage,
          details: (error as any).details || error.details,
          hint: (error as any).hint || error.hint,
          code: (error as any).code || error.code,
          fullError: error,
        };
        // console.warn("[PredictionMarketRepo] Count query failed (will use estimated total):", errorDetails);
      }
      
      if (error.code === '57014') {
        throw new Error("Count query timeout");
      }
      
      throw new Error(errorMessage);
    }

    return count ?? 0;
  }
}

