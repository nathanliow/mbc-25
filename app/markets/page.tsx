"use client";

import { 
  useMemo, 
  useState 
} from "react";
import { 
  TrendingUp, 
  Clock, 
  ChevronRight, 
  Loader2 
} from "lucide-react";
import { 
  Badge,
  Card,
  Skeleton,
  MarketDetailDrawer,
  Select
} from "@/components";
import { usePredictionMarkets } from "@/lib/prediction-market/hook";
import { PredictionMarketEventSchema } from "@/lib/prediction-market/types";

function formatVolume(volume: number | undefined): string {
  if (!volume) return "$0";
  if (volume >= 1_000_000) {
    return `$${(volume / 1_000_000).toFixed(1)}M`;
  }
  if (volume >= 1_000) {
    return `$${(volume / 1_000).toFixed(1)}K`;
  }
  return `$${volume.toFixed(0)}`;
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isYesNoMarket(outcomes: PredictionMarketEventSchema["outcomes"]): boolean {
  if (!outcomes || outcomes.length !== 2) return false;
  
  const names = outcomes.map(o => o.name.toLowerCase().trim());
  const hasYes = names.some(n => n === "yes" || n === "y");
  const hasNo = names.some(n => n === "no" || n === "n");
  
  return hasYes && hasNo;
}

function MarketCard({ 
  market, 
  onClick 
}: { 
  market: PredictionMarketEventSchema;
  onClick: () => void;
}) {
  const outcomes = market.outcomes || [];
  const isYesNo = isYesNoMarket(outcomes);
  
  let displayOutcomes: typeof outcomes = [];
  
  if (isYesNo) {
    displayOutcomes = outcomes;
  } else {
    const sortedOutcomes = [...outcomes].sort((a, b) => {
      const probA = a.probability ?? 0;
      const probB = b.probability ?? 0;
      return probB - probA;
    });
    displayOutcomes = sortedOutcomes.slice(0, 2);
  }

  return (
    <Card 
      className="p-4 hover:border-primary/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex gap-3">
        {market.imageUrl && (
          <img
            src={market.imageUrl}
            alt={market.title}
            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm line-clamp-2 mb-2">{market.title}</h3>

          {displayOutcomes.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {displayOutcomes.map((outcome) => {
                const probability = outcome.probability;
                const displayProb = probability !== undefined && probability !== null
                  ? `${(probability * 100).toFixed(0)}%`
                  : "-";
                
                return (
                  <div
                    key={outcome.id}
                    className="flex items-center gap-1 text-xs"
                  >
                    <span className="text-gray-400">{outcome.name}:</span>
                    <span className="text-primary font-medium">
                      {displayProb}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>{formatVolume(market.volume)}</span>
              </div>
              {market.endDate && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatDate(market.endDate)}</span>
                </div>
              )}
            </div>
            {market.category && (
              <Badge variant="outline" className="text-xs">
                {market.category}
              </Badge>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0 self-center" />
      </div>
    </Card>
  );
}

function MarketSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex gap-3">
        <Skeleton className="w-16 h-16 rounded-lg flex-shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4 mb-3" />
          <div className="flex gap-2 mb-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </div>
    </Card>
  );
}

type FilterOption = "all" | "united-states" | "international" | "sports" | "politics";

export default function MarketsPage() {
  const [selectedMarket, setSelectedMarket] = useState<PredictionMarketEventSchema | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [filterOption, setFilterOption] = useState<FilterOption>("all");

  const options = useMemo(
    () => ({
      limit: 50,
      orderBy: "volume" as const,
      ascending: false,
    }),
    []
  );

  const filters = useMemo(
    () => ({
      active: true,
    }),
    []
  );

  const { events: allEvents, isLoading, error } = usePredictionMarkets({
    filters,
    options,
  });

  const events = useMemo(() => {
    if (filterOption === "all") {
      return allEvents;
    }

    return allEvents.filter((event) => {
      switch (filterOption) {
        case "united-states":
          return event.location === "United States of America";
        case "international":
          return event.location && event.location !== "United States of America";
        case "sports":
          return event.tags?.includes("Sports") ?? false;
        case "politics":
          return event.tags?.includes("Politics") ?? false;
        default:
          return true;
      }
    });
  }, [allEvents, filterOption]);

  const handleMarketClick = (market: PredictionMarketEventSchema) => {
    setSelectedMarket(market);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedMarket(null);
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-4 max-w-md pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Markets</h1>
        <div className="flex items-center gap-2">
          <Select
            value={filterOption}
            onChange={(e) => setFilterOption(e.target.value as FilterOption)}
            className="text-xs h-8 w-32"
          >
            <option value="all">All</option>
            <option value="united-states">United States</option>
            <option value="international">International</option>
            <option value="sports">Sports</option>
            <option value="politics">Politics</option>
          </Select>
          <Badge variant="outline" className="text-xs text-gray-400">
            Top by Volume
          </Badge>
        </div>
      </div>

      {error && (
        <Card className="p-4 border-red-500/50">
          <p className="text-red-400 text-sm">{error}</p>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <MarketSkeleton key={i} />
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card className="p-8">
          <div className="text-center text-gray-400">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No markets available</p>
            <p className="text-xs mt-1">Check back later for new markets</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((market) => (
            <MarketCard 
              key={market.id} 
              market={market} 
              onClick={() => handleMarketClick(market)}
            />
          ))}
        </div>
      )}

      {isLoading && events.length > 0 && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      <MarketDetailDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        market={selectedMarket}
      />
    </div>
  );
}

