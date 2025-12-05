export interface PredictionMarketEventSchema {
  id: string;
  provider: string;
  providerEventId: string;
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  category?: string;
  series?: string;
  tags?: string[];
  startDate?: string;
  endDate?: string;
  active: boolean;
  featured: boolean;
  volume?: number;
  liquidity?: number;
  location?: string;
  outcomes?: PredictionMarketOutcome[];
  createdAt: string;
  updatedAt: string;
}

export interface PredictionMarketOutcome {
  id: string;
  name: string;
  probability?: number;
  price?: number;
}

export interface PredictionMarketEventFilter {
  provider?: string;
  tags?: string[];
  active?: boolean;
  closed?: boolean;
  featured?: boolean;
  category?: string;
  series?: string;
  ids?: string[];
  startDateMin?: Date;
  startDateMax?: Date;
  endDateMin?: Date;
  endDateMax?: Date;
  search?: string;
  locationNotNull?: boolean;
  locationEquals?: string;
  locationNotEquals?: string;
}

export interface PredictionMarketEventListOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  ascending?: boolean;
}

export interface PredictionMarketEventListResult {
  events: PredictionMarketEventSchema[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface PredictionMarketDbRecord {
  id: string;
  provider: string;
  title: string;
  subtitle?: string;
  description?: string;
  image?: string;
  category?: string;
  series?: string;
  tags?: string[];
  startDate?: string;
  endDate?: string;
  active: boolean;
  featured: boolean;
  volume?: number;
  liquidity?: number;
  location?: string;
  markets?: any[]; // JSONB array from database
  createdAt: string;
  updatedAt: string;
  additionalData?: any; // JSONB object
}

export function mapEventToDb(event: PredictionMarketEventSchema & { _markets?: any[] }): PredictionMarketDbRecord {
  // Extract markets from _markets field if present (set by transformer functions)
  const markets = (event as any)._markets || [];
  
  return {
    id: event.id,
    provider: event.provider,
    title: event.title,
    subtitle: event.subtitle,
    description: event.description,
    image: event.imageUrl,
    category: event.category,
    series: event.series,
    tags: event.tags || [],
    startDate: event.startDate,
    endDate: event.endDate,
    active: event.active,
    featured: event.featured,
    volume: event.volume,
    liquidity: event.liquidity,
    location: event.location,
    markets: markets,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    additionalData: {},
  };
}

export function mapDbToEvent(db: PredictionMarketDbRecord): PredictionMarketEventSchema {
  // Map markets JSONB array to outcomes
  let outcomes: PredictionMarketOutcome[] | undefined;
  if (db.markets && Array.isArray(db.markets)) {
    // Process each market to extract outcomes with probabilities
    const marketOutcomes: PredictionMarketOutcome[] = [];
    
    for (const market of db.markets) {
      try {
        // Skip closed markets
        if (market.closed === true) {
          continue;
        }
        
        // Parse outcomePrices and outcomes (they're JSON strings)
        let outcomePrices: number[] = [];
        let outcomeNames: string[] = [];
        
        if (typeof market.outcomePrices === 'string') {
          outcomePrices = JSON.parse(market.outcomePrices);
        } else if (Array.isArray(market.outcomePrices)) {
          outcomePrices = market.outcomePrices;
        }
        
        if (typeof market.outcomes === 'string') {
          outcomeNames = JSON.parse(market.outcomes);
        } else if (Array.isArray(market.outcomes)) {
          outcomeNames = market.outcomes;
        }
        
        // Get the probability from the first price (typically "Yes" probability)
        // Or use lastTradePrice if available
        const probability = market.lastTradePrice !== undefined && market.lastTradePrice !== null
          ? Number(market.lastTradePrice)
          : outcomePrices.length > 0
          ? Number(outcomePrices[0])
          : undefined;
        
        // Get the outcome name - prioritize groupItemTitle, then fall back to other fields
        const name = market.groupItemTitle 
          ? market.groupItemTitle
          : market.question 
          ? market.question.replace(/^Will the /i, '').replace(/ win Super Bowl \d+\?$/i, '').trim()
          : outcomeNames.length > 0
          ? outcomeNames[0]
          : market.slug || market.id || "Unknown";
        
        if (probability !== undefined && probability !== null && !isNaN(probability)) {
          marketOutcomes.push({
            id: market.id || `market-${marketOutcomes.length}`,
            name,
            probability,
            price: probability,
          });
        }
      } catch (error) {
        console.warn(`[mapDbToEvent] Failed to parse market ${market.id}:`, error);
      }
    }
    
    // Sort by probability (highest first) and take top outcomes
    outcomes = marketOutcomes
      .sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0))
      .slice(0, 10); // Limit to top 10 to avoid too many outcomes
  }

  return {
    id: db.id,
    provider: db.provider,
    providerEventId: db.id, // Using id as providerEventId since schema doesn't have separate field
    title: db.title,
    subtitle: db.subtitle,
    description: db.description,
    imageUrl: db.image,
    category: db.category,
    series: db.series,
    tags: db.tags,
    startDate: db.startDate,
    endDate: db.endDate,
    active: db.active,
    featured: db.featured,
    volume: db.volume ? Number(db.volume) : undefined,
    liquidity: db.liquidity ? Number(db.liquidity) : undefined,
    location: db.location,
    outcomes,
    createdAt: db.createdAt,
    updatedAt: db.updatedAt,
  };
}

