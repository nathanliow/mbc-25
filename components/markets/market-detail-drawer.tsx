"use client";

import { 
  Badge,
  Card, 
  CardContent,
  Drawer
 } from "@/components";
import { 
  TrendingUp, 
  Clock,
  Calendar 
} from "lucide-react";
import { PredictionMarketEventSchema } from "@/lib/prediction-market/types";

interface MarketDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  market: PredictionMarketEventSchema | null;
}

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
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isYesNoMarket(outcomes: PredictionMarketEventSchema["outcomes"]): boolean {
  if (!outcomes || outcomes.length !== 2) return false;
  
  const names = outcomes.map(o => o.name.toLowerCase().trim());
  const hasYes = names.some(n => n === "yes" || n === "y");
  const hasNo = names.some(n => n === "no" || n === "n");
  
  return hasYes && hasNo;
}

export function MarketDetailDrawer({
  isOpen,
  onClose,
  market,
}: MarketDetailDrawerProps) {
  if (!market) return null;

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
    displayOutcomes = sortedOutcomes;
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={market.title}>
      <div className="space-y-4">
        {market.imageUrl && (
          <img
            src={market.imageUrl}
            alt={market.title}
            className="w-full h-48 object-cover rounded-lg"
          />
        )}

        {market.subtitle && (
          <p className="text-sm text-gray-400">{market.subtitle}</p>
        )}

        {market.description && (
          <div>
            <h3 className="text-sm font-medium mb-2">Description</h3>
            <p className="text-sm text-gray-300">{market.description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span>Volume</span>
              </div>
              <p className="text-lg font-semibold">{formatVolume(market.volume)}</p>
            </CardContent>
          </Card>

          {market.liquidity && (
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span>Liquidity</span>
                </div>
                <p className="text-lg font-semibold">{formatVolume(market.liquidity)}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {market.startDate && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Calendar className="w-4 h-4" />
            <span>Starts: {formatDate(market.startDate)}</span>
          </div>
        )}

        {market.endDate && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Clock className="w-4 h-4" />
            <span>Ends: {formatDate(market.endDate)}</span>
          </div>
        )}

        {market.category && (
          <div className="flex items-center gap-2">
            <Badge variant="outline">{market.category}</Badge>
            {market.series && (
              <Badge variant="outline">{market.series}</Badge>
            )}
          </div>
        )}

        {displayOutcomes.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3">Outcomes</h3>
            <div className="space-y-2">
              {displayOutcomes.map((outcome) => {
                const probability = outcome.probability;
                const displayProb = probability !== undefined && probability !== null
                  ? `${(probability * 100).toFixed(1)}%`
                  : "N/A";
                
                const probValue = probability ?? 0;
                const probPercent = probValue * 100;

                return (
                  <Card key={outcome.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{outcome.name}</span>
                        <span className="text-primary font-semibold text-sm">
                          {displayProb}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${probPercent}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {market.location && (
          <div className="text-sm text-gray-400">
            <span className="font-medium">Location: </span>
            <span>{market.location}</span>
          </div>
        )}

        {market.tags && market.tags.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {market.tags.map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}

