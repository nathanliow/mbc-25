import { PredictionMarketEventSchema } from "./types";
import type { KalshiEvent, KalshiMarket } from "./clients/kalshi-client";
import type { PolymarketEvent, PolymarketMarket } from "./clients/polymarket-client";

export interface PredictionMarketEventWithMarkets extends PredictionMarketEventSchema {
  _markets?: any[]; // Internal field to store markets for database storage
}

/**
 * Transform Kalshi event to PredictionMarketEventSchema with markets
 */
export function fromKalshi(
  event: KalshiEvent,
  metadata?: KalshiEvent | null,
  existingImage?: string
): PredictionMarketEventWithMarkets {
  const now = new Date().toISOString();
  
  // Use metadata if available, otherwise use event
  const source = metadata || event;
  
  // Build markets array from nested markets
  const markets: any[] = [];
  if (event.markets && Array.isArray(event.markets)) {
    event.markets.forEach((market: KalshiMarket) => {
      if (market.closed === true) return; // Skip closed markets
      
      const outcomes = market.outcomes || [];
      const outcomePrices = market.outcome_prices || [];
      
      markets.push({
        id: market.ticker || String(market.ticker) || market.title,
        question: market.title,
        outcomes: JSON.stringify(outcomes),
        outcomePrices: JSON.stringify(outcomePrices.map(p => String(p))),
        lastTradePrice: market.last_trade_price,
        groupItemTitle: market.group_item_title,
        closed: market.closed || false,
      });
    });
  }

  return {
    id: event.event_ticker,
    provider: 'kalshi',
    providerEventId: event.event_ticker,
    title: source.title || event.title,
    subtitle: source.subtitle || event.subtitle,
    description: source.description || event.description,
    imageUrl: existingImage || source.image_url || event.image_url,
    category: source.category || event.category,
    series: source.series_ticker || event.series_ticker,
    tags: source.tags || event.tags || [],
    startDate: source.start_time || event.start_time,
    endDate: source.expiration_time || event.expiration_time,
    active: true,
    featured: false,
    volume: source.volume || event.volume,
    liquidity: source.liquidity || event.liquidity,
    location: undefined, // Kalshi doesn't provide location in standard format
    createdAt: now,
    updatedAt: now,
    _markets: markets, // Store markets for database insertion
  };
}

/**
 * Transform Polymarket event to PredictionMarketEventSchema with markets
 */
export function fromPolymarket(event: PolymarketEvent): PredictionMarketEventWithMarkets {
  const now = new Date().toISOString();
  const eventId = event.ticker || String(event.id);
  
  // Build markets array from nested markets
  const markets: any[] = [];
  if (event.markets && Array.isArray(event.markets)) {
    event.markets.forEach((market: PolymarketMarket) => {
      if (market.closed === true) return; // Skip closed markets
      
      const outcomes = typeof market.outcomes === 'string' 
        ? JSON.parse(market.outcomes) 
        : market.outcomes || [];
      const outcomePrices = typeof market.outcomePrices === 'string'
        ? JSON.parse(market.outcomePrices)
        : market.outcomePrices || [];
      
      markets.push({
        id: market.id || String(market.id),
        question: market.question,
        outcomes: JSON.stringify(outcomes),
        outcomePrices: JSON.stringify(outcomePrices),
        lastTradePrice: market.lastTradePrice,
        groupItemTitle: market.groupItemTitle,
        closed: market.closed || false,
      });
    });
  }

  return {
    id: eventId,
    provider: 'polymarket',
    providerEventId: eventId,
    title: event.title,
    subtitle: undefined,
    description: event.description,
    imageUrl: event.image,
    category: event.category,
    series: undefined,
    tags: event.tags || [],
    startDate: event.startDate,
    endDate: event.endDate,
    active: true,
    featured: false,
    volume: event.volume,
    liquidity: event.liquidity,
    location: undefined, // Extract from tags or additional data if needed
    createdAt: now,
    updatedAt: now,
    _markets: markets, // Store markets for database insertion
  };
}

