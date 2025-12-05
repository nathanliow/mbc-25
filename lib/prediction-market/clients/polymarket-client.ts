export interface PolymarketGetEventsParams {
  limit?: number;
  offset?: number;
  order?: 'volume' | 'created' | 'endDate';
  ascending?: boolean;
  include_chat?: boolean;
  include_template?: boolean;
  closed?: boolean;
}

export interface PolymarketEvent {
  id: string;
  ticker?: string;
  title: string;
  description?: string;
  image?: string;
  category?: string;
  tags?: string[];
  startDate?: string;
  endDate?: string;
  volume?: number;
  liquidity?: number;
  markets?: PolymarketMarket[];
  [key: string]: any;
}

export interface PolymarketMarket {
  id: string;
  question?: string;
  outcomes?: string;
  outcomePrices?: string;
  lastTradePrice?: number;
  closed?: boolean;
  groupItemTitle?: string;
  [key: string]: any;
}

export class PolymarketClient {
  private gammeBaseUrl = 'https://gamma-api.polymarket.com';
  private timeout = 30000; // 30 seconds

  async getEvents(params: PolymarketGetEventsParams): Promise<PolymarketEvent[]> {
    try {
      const url = new URL(`${this.gammeBaseUrl}/events`);
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(item => url.searchParams.append(key, String(item)));
          } else {
            url.searchParams.append(key, String(value));
          }
        }
      });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ShadeWallet/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Polymarket API error: ${response.status} ${response.statusText}`);
      }

      const events: PolymarketEvent[] = await response.json();
      return events;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Polymarket API request timed out');
        }
        throw new Error(`Failed to fetch Polymarket events: ${error.message}`);
      }
      throw new Error('Unknown error fetching Polymarket events');
    }
  }
}

