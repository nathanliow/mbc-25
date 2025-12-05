import { SupabaseClient } from "@supabase/supabase-js";
import {
  PredictionMarketEventSchema,
  PredictionMarketEventFilter,
  PredictionMarketEventListOptions,
  PredictionMarketDbRecord,
  mapDbToEvent,
  mapEventToDb,
} from "./types";

export interface PredictionMarketEventUpsertResult {
  created: number;
  updated: number;
  errors: Array<{ id: string; error: string }>;
}

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

  /**
   * Upsert multiple events to database with replacement strategy
   */
  async upsertEvents(
    events: (PredictionMarketEventSchema & { _markets?: any[] })[]
  ): Promise<PredictionMarketEventUpsertResult> {
    const result: PredictionMarketEventUpsertResult = {
      created: 0,
      updated: 0,
      errors: [],
    };

    if (events.length === 0) {
      return result;
    }

    try {
      const dbEvents = events.map(event => mapEventToDb(event));
      
      // Use Supabase's native bulk upsert functionality with timeout handling
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Upsert operation timed out')), 30000); // 30 second timeout
      });
      
      const upsertPromise = this.supabase
        .from('prediction_market_events')
        .upsert(dbEvents, { 
          onConflict: 'id,provider',
          ignoreDuplicates: false 
        });

      const { error } = await Promise.race([upsertPromise, timeoutPromise]) as any;

      if (error) {
        console.error('[PredictionMarketRepo] Bulk upsert error:', error);
        // If bulk upsert fails, fall back to individual upserts
        return await this.upsertEventsFallback(events);
      }

      // Supabase doesn't distinguish created vs updated in upsert
      // Treat the whole batch as updated for accounting purposes
      result.updated = events.length;
      
    } catch (error) {
      console.error('[PredictionMarketRepo] Bulk upsert failed, falling back to individual upserts:', error);
      return await this.upsertEventsFallback(events);
    }

    return result;
  }

  private async upsertEventsFallback(
    events: PredictionMarketEventSchema[]
  ): Promise<PredictionMarketEventUpsertResult> {
    const result: PredictionMarketEventUpsertResult = {
      created: 0,
      updated: 0,
      errors: [],
    };

    for (const event of events) {
      try {
        const dbEvent = mapEventToDb(event);
        
        // Check if event exists
        const { data: existing } = await this.supabase
          .from('prediction_market_events')
          .select('id')
          .eq('id', event.id)
          .eq('provider', event.provider)
          .single();

        if (existing) {
          // Update existing
          const { error } = await this.supabase
            .from('prediction_market_events')
            .update(dbEvent)
            .eq('id', event.id)
            .eq('provider', event.provider);

          if (error) throw error;
          result.updated++;
        } else {
          // Insert new
          const { error } = await this.supabase
            .from('prediction_market_events')
            .insert(dbEvent);

          if (error) throw error;
          result.created++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push({ id: event.id, error: errorMsg });
        console.error(`[PredictionMarketRepo] Failed to upsert event ${event.id}:`, errorMsg);
      }
    }

    return result;
  }
}

