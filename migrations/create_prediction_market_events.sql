-- Migration: Create prediction_market_events table
-- Description: Stores prediction market events with normalized schema

CREATE TABLE IF NOT EXISTS prediction_market_events (
  -- Primary identifier (provider-specific ticker/slug)
  "id" TEXT NOT NULL,
  
  -- Provider information
  "provider" TEXT NOT NULL CHECK ("provider" IN ('polymarket', 'kalshi', 'limitless')),
  
  -- Common event fields
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "description" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT '{}',
  "location" TEXT,
  
  -- Dates and timing (ISO 8601 format)
  "startDate" TEXT,
  "endDate" TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  
  -- Status flags
  "active" BOOLEAN NOT NULL DEFAULT true,
  "featured" BOOLEAN NOT NULL DEFAULT false,
  
  -- Financial metrics
  "volume" NUMERIC,
  "liquidity" NUMERIC,
  
  -- Categorization
  "category" TEXT,
  "series" TEXT,
  
  -- Visual assets
  "image" TEXT,
  
  -- Markets associated with this event (stored as JSONB array)
  "markets" JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Provider-specific additional data stored as JSONB
  "additionalData" JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Constraints
  CONSTRAINT "prediction_market_events_pkey" PRIMARY KEY ("id")
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS "idx_prediction_market_events_provider" ON prediction_market_events("provider");
CREATE INDEX IF NOT EXISTS "idx_prediction_market_events_active" ON prediction_market_events("active");
CREATE INDEX IF NOT EXISTS "idx_prediction_market_events_featured" ON prediction_market_events("featured");
CREATE INDEX IF NOT EXISTS "idx_prediction_market_events_category" ON prediction_market_events("category");
CREATE INDEX IF NOT EXISTS "idx_prediction_market_events_series" ON prediction_market_events("series");
CREATE INDEX IF NOT EXISTS "idx_prediction_market_events_createdAt" ON prediction_market_events("createdAt");
CREATE INDEX IF NOT EXISTS "idx_prediction_market_events_updatedAt" ON prediction_market_events("updatedAt");
CREATE INDEX IF NOT EXISTS "idx_prediction_market_events_startDate" ON prediction_market_events("startDate");
CREATE INDEX IF NOT EXISTS "idx_prediction_market_events_endDate" ON prediction_market_events("endDate");
CREATE INDEX IF NOT EXISTS "idx_prediction_market_events_volume" ON prediction_market_events("volume");

-- Create GIN indexes for JSONB fields
CREATE INDEX IF NOT EXISTS "idx_prediction_market_events_markets" ON prediction_market_events USING GIN ("markets");
CREATE INDEX IF NOT EXISTS "idx_prediction_market_events_additionalData" ON prediction_market_events USING GIN ("additionalData");

-- Create GIN indexes for array fields
CREATE INDEX IF NOT EXISTS "idx_prediction_market_events_tags" ON prediction_market_events USING GIN ("tags");

-- Create composite indexes for common query combinations
CREATE INDEX IF NOT EXISTS "idx_prediction_market_events_provider_active" ON prediction_market_events("provider", "active");
CREATE INDEX IF NOT EXISTS "idx_prediction_market_events_active_featured" ON prediction_market_events("active", "featured");

-- Enable Row Level Security (RLS)
ALTER TABLE prediction_market_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow public read access
CREATE POLICY "Allow public read access to prediction market events" 
ON prediction_market_events 
FOR SELECT 
TO public 
USING (true);

-- Grant read access to public (for frontend)
GRANT SELECT ON prediction_market_events TO public;

