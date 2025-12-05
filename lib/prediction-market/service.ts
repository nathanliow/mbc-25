import { PredictionMarketRepo } from "./repo";
import {
  PredictionMarketEventFilter,
  PredictionMarketEventListOptions,
  PredictionMarketEventListResult,
} from "./types";

export class PredictionMarketService {
  constructor(private repo: PredictionMarketRepo) {}

  async list(
    filters?: PredictionMarketEventFilter,
    options?: PredictionMarketEventListOptions
  ): Promise<PredictionMarketEventListResult> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const events = await this.repo.findMany(filters, options);
    
    let total: number;
    try {
      total = await this.repo.count(filters);
    } catch (error) {
      console.warn("[PredictionMarketService] Count query failed, using estimated total:", error);
      total = events.length >= limit ? events.length + 1 : events.length;
    }

    return {
      events,
      total,
      limit,
      offset,
      hasMore: offset + events.length < total,
    };
  }
}

