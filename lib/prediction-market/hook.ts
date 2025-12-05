"use client";

import { 
  useState, 
  useEffect, 
  useRef, 
  useMemo 
} from "react";
import {
  PredictionMarketEventSchema,
  PredictionMarketEventFilter,
  PredictionMarketEventListOptions,
  PredictionMarketEventListResult,
} from "./types";

interface UsePredictionMarketsOptions {
  filters?: PredictionMarketEventFilter;
  options?: PredictionMarketEventListOptions;
  enabled?: boolean;
}

interface UsePredictionMarketsResult {
  events: PredictionMarketEventSchema[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePredictionMarkets({
  filters,
  options,
  enabled = true,
}: UsePredictionMarketsOptions = {}): UsePredictionMarketsResult {
  const [data, setData] = useState<PredictionMarketEventListResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const lastParamsRef = useRef<string>("");

  const paramsString = useMemo(() => {
    const params = new URLSearchParams();

    if (options?.limit) params.set("limit", options.limit.toString());
    if (options?.offset) params.set("offset", options.offset.toString());
    if (options?.orderBy) params.set("orderBy", options.orderBy);
    if (options?.ascending !== undefined)
      params.set("ascending", options.ascending.toString());

    if (filters?.provider) params.set("provider", filters.provider);
    if (filters?.category) params.set("category", filters.category);
    if (filters?.active !== undefined)
      params.set("active", filters.active.toString());
    if (filters?.featured !== undefined)
      params.set("featured", filters.featured.toString());
    if (filters?.search) params.set("search", filters.search);

    return params.toString();
  }, [
    options?.limit,
    options?.offset,
    options?.orderBy,
    options?.ascending,
    filters?.provider,
    filters?.category,
    filters?.active,
    filters?.featured,
    filters?.search,
  ]);

  useEffect(() => {
    if (!enabled) return;

    const currentParams = paramsString;
    if (currentParams === lastParamsRef.current && data !== null) {
      return;
    }

    lastParamsRef.current = currentParams;
    isMountedRef.current = true;
    setIsLoading(true);
    setError(null);

    const fetchMarkets = async () => {
      try {
        const response = await fetch(`/api/prediction-markets?${currentParams}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch prediction markets");
        }

        const result: PredictionMarketEventListResult = await response.json();
        if (isMountedRef.current) {
          setData(result);
          setIsLoading(false);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "An error occurred";
        if (isMountedRef.current) {
          setError(message);
          setIsLoading(false);
        }
      }
    };

    fetchMarkets();

    return () => {
      isMountedRef.current = false;
    };
  }, [paramsString, enabled]);

  const refetch = async () => {
    lastParamsRef.current = "";
    isMountedRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/prediction-markets?${paramsString}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch prediction markets");
      }

      const result: PredictionMarketEventListResult = await response.json();
      if (isMountedRef.current) {
        setData(result);
        setIsLoading(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      if (isMountedRef.current) {
        setError(message);
        setIsLoading(false);
      }
    }
  };

  return {
    events: data?.events ?? [],
    total: data?.total ?? 0,
    hasMore: data?.hasMore ?? false,
    isLoading,
    error,
    refetch,
  };
}

