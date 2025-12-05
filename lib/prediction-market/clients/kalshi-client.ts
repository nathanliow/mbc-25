export interface KalshiGetEventsParams {
  limit?: number;
  cursor?: string;
  with_nested_markets?: boolean;
  status?: 'open' | 'closed';
}

export interface KalshiEvent {
  event_ticker: string;
  title: string;
  subtitle?: string;
  description?: string;
  category?: string;
  series_ticker?: string;
  tags?: string[];
  start_time?: string;
  expiration_time?: string;
  volume?: number;
  liquidity?: number;
  image_url?: string;
  markets?: KalshiMarket[];
  [key: string]: any;
}

export interface KalshiMarket {
  ticker: string;
  title: string;
  outcomes?: string[];
  outcome_prices?: string[];
  last_trade_price?: number;
  closed?: boolean;
  group_item_title?: string;
  [key: string]: any;
}

export interface KalshiGetEventsResponse {
  events: KalshiEvent[];
  cursor: string | null;
}

export class KalshiClient {
  private baseUrl = 'https://trading-api.kalshi.com';
  private timeout = 30000; // 30 seconds

  async getEvents(params: KalshiGetEventsParams): Promise<KalshiGetEventsResponse> {
    try {
      const url = new URL(`${this.baseUrl}/trade-api/v2/events`);
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
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
        throw new Error(`Kalshi API error: ${response.status} ${response.statusText}`);
      }

      const result: KalshiGetEventsResponse = await response.json();
      return result;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Kalshi API request timed out');
        }
        throw new Error(`Failed to fetch Kalshi events: ${error.message}`);
      }
      throw new Error('Unknown error fetching Kalshi events');
    }
  }

  async getEventMetadata(params: { eventTicker: string }): Promise<KalshiEvent | null> {
    try {
      const url = new URL(`${this.baseUrl}/trade-api/v2/events/${params.eventTicker}`);
      
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
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Kalshi API error: ${response.status} ${response.statusText}`);
      }

      const result: KalshiEvent = await response.json();
      return result;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Kalshi API request timed out');
        }
        throw new Error(`Failed to fetch Kalshi event metadata: ${error.message}`);
      }
      throw new Error('Unknown error fetching Kalshi event metadata');
    }
  }
}

