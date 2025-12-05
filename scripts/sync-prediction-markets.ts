import { getSupabaseClient } from "@/lib/supabase";
import { PredictionMarketRepo } from "@/lib/prediction-market/repo";
import { KalshiClient } from "@/lib/prediction-market/clients/kalshi-client";
import { PolymarketClient } from "@/lib/prediction-market/clients/polymarket-client";
import { fromKalshi, fromPolymarket, type PredictionMarketEventWithMarkets } from "@/lib/prediction-market/transformers";

// Configuration constants
const KALSHI_FETCH_BATCH_SIZE = 50;
const POLYMARKET_FETCH_BATCH_SIZE = 50;
const PREDICTION_MARKET_EVENT_UPSERT_BATCH_SIZE = 100;

interface PredictionMarketEventSyncResult {
  success: boolean;
  provider: string;
  eventsProcessed: number;
  created: number;
  updated: number;
  errors: Array<{ id: string; error: string }>;
  duration: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}


export async function syncPredictionMarketEvents(): Promise<{
  success: boolean;
  kalshi: PredictionMarketEventSyncResult;
  polymarket: PredictionMarketEventSyncResult;
  totalDuration: number;
}> {
  const startTime = Date.now();
  const supabase = getSupabaseClient();
  const repo = new PredictionMarketRepo(supabase);

  console.log('[Sync] Starting combined prediction market events sync...');

  // Initialize clients
  const kalshiClient = new KalshiClient();
  const polymarketClient = new PolymarketClient();

  // Results tracking
  const kalshiResult: PredictionMarketEventSyncResult = {
    success: true,
    provider: 'kalshi',
    eventsProcessed: 0,
    created: 0,
    updated: 0,
    errors: [],
    duration: 0
  };

  const polymarketResult: PredictionMarketEventSyncResult = {
    success: true,
    provider: 'polymarket',
    eventsProcessed: 0,
    created: 0,
    updated: 0,
    errors: [],
    duration: 0
  };

  try {
    // Pagination state
    let kalshiCursor: string | null = null;
    let kalshiHasMore = true;
    let polymarketOffset = 0;
    let polymarketHasMore = true;

    // Combined event buffer for batching
    const eventBuffer: PredictionMarketEventWithMarkets[] = [];
    let batchCount = 0;

    console.log(`[Sync] Starting combined streaming sync...`);

    while (kalshiHasMore || polymarketHasMore || eventBuffer.length > 0) {
      // Fetch from Kalshi if still has more data
      if (kalshiHasMore) {
        const kalshiParams = { 
          limit: KALSHI_FETCH_BATCH_SIZE,
          with_nested_markets: true,
          status: 'open' as const,
          cursor: kalshiCursor || undefined,
        };

        try {
          const kalshiResponse = await kalshiClient.getEvents(kalshiParams);
          const kalshiBatchEvents = kalshiResponse.events || [];
          
          if (kalshiBatchEvents.length > 0) {
            console.log(`[Sync] Kalshi: Fetched ${kalshiBatchEvents.length} events`);

            // Transform all fetched events
            const { data: existingEvents } = await supabase
              .from('prediction_market_events')
              .select('id, image')
              .eq('provider', 'kalshi')
              .in('id', kalshiBatchEvents.map(event => event.event_ticker));

            // Create a map of existing images for quick lookup
            const existingImages = new Map(
              (existingEvents || [])
                .filter(event => event.image && event.image.trim() !== '')
                .map(event => [event.id, event.image])
            );

            // Transform events, preserving existing images
            const normalizedEvents: PredictionMarketEventWithMarkets[] = kalshiBatchEvents.map(event => {
              const existingImage = existingImages.get(event.event_ticker);
              return fromKalshi(event, undefined, existingImage);
            });

            console.log(`[Sync] Processing ${normalizedEvents.length} Kalshi events`);
            eventBuffer.push(...normalizedEvents);
            kalshiResult.eventsProcessed += normalizedEvents.length;
          }

          kalshiCursor = kalshiResponse.cursor || null;
          kalshiHasMore = !!kalshiCursor;
          
          if (kalshiBatchEvents.length === 0) {
            console.log(`[Sync] Kalshi: No more events returned, stopping pagination`);
            kalshiHasMore = false;
          }
        } catch (error) {
          console.error('[Sync] Kalshi fetch error:', error);
          kalshiResult.errors.push({ 
            id: 'FETCH', 
            error: error instanceof Error ? error.message : 'Unknown fetch error' 
          });
          kalshiHasMore = false;
        }
      }

      // Fetch from Polymarket if still has more data
      if (polymarketHasMore) { 
        const polymarketParams = {
          limit: POLYMARKET_FETCH_BATCH_SIZE,
          offset: polymarketOffset,
          order: 'volume' as const,
          ascending: false,
          include_chat: false,
          include_template: false,
          closed: false
        };

        try {
          const polymarketBatchEvents = await polymarketClient.getEvents(polymarketParams);
          
          console.log(`[Sync] Polymarket: Fetched ${polymarketBatchEvents.length} events (offset: ${polymarketOffset})`);
          
          if (polymarketBatchEvents.length > 0) {
            // Transform all fetched events
            const normalizedEvents: PredictionMarketEventWithMarkets[] = polymarketBatchEvents.map(event => {
              return fromPolymarket(event);
            });

            console.log(`[Sync] Processing ${normalizedEvents.length} Polymarket events`);
            eventBuffer.push(...normalizedEvents);
            polymarketResult.eventsProcessed += normalizedEvents.length;
          } else {
            console.log(`[Sync] Polymarket: No more events returned, stopping pagination`);
          }

          polymarketOffset += POLYMARKET_FETCH_BATCH_SIZE;
          polymarketHasMore = polymarketBatchEvents.length > 0;
        } catch (error) {
          console.error('[Sync] Polymarket fetch error:', error);
          polymarketResult.errors.push({ 
            id: 'FETCH', 
            error: error instanceof Error ? error.message : 'Unknown fetch error' 
          });
          polymarketHasMore = false;
        }
      }

      // Process buffer when it reaches batch size or no more data to fetch
      if (eventBuffer.length >= PREDICTION_MARKET_EVENT_UPSERT_BATCH_SIZE || 
          (!kalshiHasMore && !polymarketHasMore && eventBuffer.length > 0)) {
        const batchToProcess = eventBuffer.splice(0, PREDICTION_MARKET_EVENT_UPSERT_BATCH_SIZE);
        batchCount++;
        
        // Count events by provider in this batch
        const kalshiEventsInBatch = batchToProcess.filter(e => e.provider === 'kalshi').length;
        const polymarketEventsInBatch = batchToProcess.filter(e => e.provider === 'polymarket').length;
        
        try {
          const upsertResult = await repo.upsertEvents(batchToProcess);
          
          console.log(`[Sync] Batch ${batchCount}: ${batchToProcess.length} events (K:${kalshiEventsInBatch}, P:${polymarketEventsInBatch}) - Created: ${upsertResult.created}, Updated: ${upsertResult.updated}`);
          
          // Distribute results proportionally
          const kalshiRatio = kalshiEventsInBatch / batchToProcess.length;
          const polymarketRatio = polymarketEventsInBatch / batchToProcess.length;
          
          kalshiResult.created += Math.round(upsertResult.created * kalshiRatio);
          kalshiResult.updated += Math.round(upsertResult.updated * kalshiRatio);
          polymarketResult.created += Math.round(upsertResult.created * polymarketRatio);
          polymarketResult.updated += Math.round(upsertResult.updated * polymarketRatio);
          
          // Distribute errors by provider
          upsertResult.errors.forEach(error => {
            const event = batchToProcess.find(e => e.id === error.id);
            if (event?.provider === 'kalshi') {
              kalshiResult.errors.push(error);
            } else if (event?.provider === 'polymarket') {
              polymarketResult.errors.push(error);
            }
          });
          
          if (upsertResult.errors.length > 0) {
            console.error(`[Sync] Batch ${batchCount} had ${upsertResult.errors.length} errors`);
          }
          
          // Add delay between batches
          await sleep(500);
          
        } catch (error) {
          console.error(`[Sync] Batch ${batchCount} failed:`, error);
          const errorMsg = error instanceof Error ? error.message : 'Unknown batch error';
          kalshiResult.errors.push({ id: `BATCH_${batchCount}`, error: errorMsg });
          polymarketResult.errors.push({ id: `BATCH_${batchCount}`, error: errorMsg });
        }
      }

      // Rate limiting between fetch cycles
      if (kalshiHasMore || polymarketHasMore) {
        await sleep(500);
      }
    }


    const totalDuration = Date.now() - startTime;
    kalshiResult.duration = totalDuration;
    polymarketResult.duration = totalDuration;
    
    const overallSuccess = kalshiResult.errors.length === 0 && polymarketResult.errors.length === 0;
    kalshiResult.success = kalshiResult.errors.length === 0;
    polymarketResult.success = polymarketResult.errors.length === 0;

    const result = {
      success: overallSuccess,
      kalshi: kalshiResult,
      polymarket: polymarketResult,
      totalDuration
    };

    console.log(`[Sync] Combined sync completed! Success: ${overallSuccess}, Kalshi: ${kalshiResult.eventsProcessed}, Polymarket: ${polymarketResult.eventsProcessed}`);
    console.log(`[Sync] Total Duration: ${totalDuration}ms`);

    return result;
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error('[Sync] Combined sync failed:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      success: false,
      kalshi: {
        ...kalshiResult,
        success: false,
        errors: [...kalshiResult.errors, { id: 'ALL', error: errorMsg }],
        duration: totalDuration
      },
      polymarket: {
        ...polymarketResult,
        success: false,
        errors: [...polymarketResult.errors, { id: 'ALL', error: errorMsg }],
        duration: totalDuration
      },
      totalDuration
    };
  }
}

