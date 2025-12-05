# Technical Architecture Overview

## Table of Contents
1. [Frontend Architecture](#frontend-architecture)
2. [Backend Architecture](#backend-architecture)
3. [Privacy & Shielding System](#privacy--shielding-system)
4. [Swap System](#swap-system)
5. [Data Providers](#data-providers)
6. [State Management](#state-management)

---

## Frontend Architecture

### Tech Stack

**Framework & Core:**
- **Next.js 16** (App Router) - React framework with server-side rendering and API routes
- **React 19** - UI library
- **TypeScript** - Type-safe development

**State Management:**
- **Jotai** - Atomic state management library for React
  - Used for global wallet state, UI state, and caching
  - Atoms with localStorage persistence for wallet setup and preferences

**UI & Styling:**
- **Tailwind CSS 4** - Utility-first CSS framework
- **Lucide React** - Icon library
- **Recharts** - Charting library for price history visualization

**Blockchain Integration:**
- **@solana/web3.js** - Solana blockchain interaction
- **encifher-swap-sdk** - Privacy-preserving swap SDK
- **bip39** - BIP39 mnemonic phrase generation
- **ed25519-hd-key** - HD key derivation for wallet generation

**Data Layer:**
- **@supabase/supabase-js** - Supabase client for prediction markets data

### Frontend Structure

```
app/
├── page.tsx              # Root redirect to /wallet
├── wallet/               # Main wallet interface
├── swap/                 # Token swap interface
├── markets/              # Prediction markets
├── settings/             # Wallet settings
└── api/                  # Next.js API routes (backend)

components/
├── wallet/               # Wallet-specific components
├── swap/                 # Swap-specific components
├── markets/              # Markets components
└── ui/                   # Reusable UI components

lib/
├── wallet-context.tsx    # Wallet provider & context
├── encifher.ts           # Encifher SDK wrapper
├── helius.ts             # Helius API integration
├── moralis.ts            # Moralis API integration
├── jupiter-price.ts      # Jupiter price fetching
└── atoms.ts              # Jotai state atoms
```

### Key Frontend Features

1. **Wallet Management**
   - HD wallet generation from mnemonic phrases
   - Multiple derived accounts
   - Password-protected wallet locking/unlocking
   - Public and private balance tracking

2. **Transaction Interface**
   - Send/receive transactions (public and private)
   - Real-time balance updates
   - Transaction history with activity feed

3. **Token Management**
   - SOL and SPL token support
   - Token metadata fetching
   - Price tracking and USD value calculation

---

## Backend Architecture

### Next.js API Routes

The backend consists of Next.js API routes that act as a proxy layer between the frontend and external services. This architecture:

- **Protects API keys** - Keeps sensitive keys server-side
- **Handles CORS** - Avoids browser CORS issues
- **Provides abstraction** - Simplifies frontend integration

### API Route Structure

```
app/api/
├── encifher/
│   ├── get-deposit-tx/      # Generate deposit (shield) transaction
│   ├── get-withdraw-tx/      # Generate withdraw (unshield) transaction
│   ├── get-swap-tx/          # Generate private swap transaction
│   ├── execute-swap/         # Execute private swap
│   ├── get-order-status/     # Poll swap order status
│   ├── get-balance/          # Get private balance
│   └── send-anon-transfer/   # Send anonymous private transfer
├── jupiter/
│   ├── quote/                # Get swap quote (public)
│   └── execute/              # Execute swap (public)
└── prediction-markets/
    └── route.ts              # Fetch prediction markets from Supabase
```

### Backend Flow

1. **Request Validation** - Validates required parameters
2. **Service Initialization** - Initializes SDK clients (Encifher, Jupiter)
3. **Transaction Generation** - Creates unsigned transactions
4. **Serialization** - Converts transactions to base64 for client
5. **Error Handling** - Comprehensive error catching and logging

---

## Privacy & Shielding System

### Encifher SDK Integration

The application uses the **Encifher Swap SDK** (`encifher-swap-sdk`) to provide privacy-preserving transactions on Solana.

### Shielding (Deposit to Private)

**Flow:**
1. User initiates deposit from public balance
2. Frontend calls `/api/encifher/get-deposit-tx`
3. Backend uses `DefiClient.getDepositTxn()` to generate transaction
4. Transaction is serialized and sent to frontend
5. Frontend signs transaction with user's keypair
6. Transaction is submitted to Solana network
7. Funds are moved from public to private (shielded) state

**Backend Implementation:**
- Uses `DefiClient` from Encifher SDK initialized with RPC URL and API key
- Calls `DefiClient.getDepositTxn()` with depositor address, token mint/decimals, and amount
- Returns serialized transaction to frontend for signing

### Unshielding (Withdraw from Private)

**Flow:**
1. User initiates withdrawal from private balance
2. Frontend calls `/api/encifher/get-withdraw-tx`
3. Backend uses `DefiClient.getWithdrawTxn()` to generate transaction
4. Transaction includes optional recipient address
5. Frontend signs and submits transaction
6. Funds are moved from private to public (unshielded) state

**Backend Implementation:**
- Uses `DefiClient.getWithdrawTxn()` with withdrawer address, token details, amount, and optional recipient
- Returns serialized transaction to frontend for signing

### Private Balance Tracking

- Private balances are fetched via `/api/encifher/get-balance`
- Balances are cached in frontend state
- Supports SOL and SPL tokens
- Automatically refreshes after transactions

---

## Swap System

### Public Swaps (Jupiter)

**Architecture:**
Public swaps are routed directly through **Jupiter Aggregator** using their Ultra API.

**Flow:**
1. User selects tokens and amount
2. Frontend calls `/api/jupiter/quote` to get swap quote
3. Backend queries Jupiter Ultra API (`api.jup.ag/ultra/v1/order`)
4. Quote includes:
   - Output amount
   - Transaction (unsigned)
   - Request ID
   - Fee and slippage information
5. User approves swap
6. Frontend signs transaction locally
7. Frontend calls `/api/jupiter/execute` with signed transaction
8. Backend submits to Jupiter Ultra Execute endpoint
9. Swap executes on-chain

**Backend Implementation:**
- Quote endpoint calls Jupiter Ultra API (`api.jup.ag/ultra/v1/order`) with input/output mints, amount, and taker address
- Execute endpoint calls Jupiter Ultra Execute API (`api.jup.ag/ultra/v1/execute`) with signed transaction and request ID
- Both endpoints use Jupiter API key for authentication

### Private Swaps (Encifher + Jupiter)

**Architecture:**
Private swaps use **Encifher SDK**, which internally leverages **Jupiter** for routing but adds privacy layers.

**Flow:**
1. User selects private swap option
2. Frontend calls `/api/encifher/get-swap-tx`
3. Backend uses `DefiClient.getSwapTxn()` to generate swap transaction
   - Encifher SDK internally queries Jupiter for best routes
   - Wraps swap in privacy-preserving transaction
4. Transaction is serialized and sent to frontend
5. Frontend signs transaction locally
6. Frontend calls `/api/encifher/execute-swap` with signed transaction
7. Backend uses `DefiClient.executeSwapTxn()` to execute
8. System polls `/api/encifher/get-order-status` for completion
9. Swap completes with privacy preserved

**Status Polling:**
- Polls every 3 seconds (max 5 attempts)
- Statuses: `pending`, `completed`, `swap_failed`, `withdrawal_fallback`
- Updates UI with real-time status

**Backend Implementation:**
- Get swap transaction endpoint uses `DefiClient.getSwapTxn()` with input/output mints, amount, and sender/receiver addresses
- Execute swap endpoint uses `DefiClient.executeSwapTxn()` with signed transaction and order details
- Encifher SDK internally queries Jupiter for optimal swap routes while maintaining privacy

### Swap Comparison

| Feature | Public Swap (Jupiter) | Private Swap (Encifher) |
|---------|----------------------|------------------------|
| **Privacy** | Transparent on-chain | Privacy-preserved |
| **Routing** | Jupiter Aggregator | Encifher (uses Jupiter internally) |
| **Speed** | Instant execution | Polling required (~15s) |
| **Transaction Visibility** | Public blockchain | Private state |
| **Use Case** | Standard swaps | Privacy-sensitive swaps |

---

## Data Providers

### Helius APIs

**Purpose:** Blockchain data and transaction history

**Endpoints Used:**

1. **Token Balances** (`getTokenAccountsByOwner`)
   - Fetches SPL token accounts for a wallet
   - Returns token mint, amount, decimals, UI amount
   - Used for displaying wallet balances

2. **Transaction History** (`getSignaturesForAddress`)
   - Fetches transaction signatures for a wallet
   - Supports pagination and filtering
   - Used in activity feed

3. **Transaction Details** (`getParsedTransactions`)
   - Fetches parsed transaction data
   - Includes token transfers, swaps, and other operations
   - Used to display transaction details

4. **Token Metadata** (`getAssetBatch`)
   - Fetches token metadata (name, symbol, image)
   - Batch API for efficient fetching
   - Used for token display

**Functions Used:**
- `fetchSplTokensByOwner()` - Calls Helius RPC `getTokenAccountsByOwner` method via JSON-RPC
- `fetchSignaturesForAddress()` - Calls Helius RPC `getSignaturesForAddress` method with pagination support
- `fetchTransactionsBatch()` - Calls Helius RPC `getParsedTransactions` method for batch transaction fetching
- `fetchAssetBatch()` - Calls Helius DAS API `getAssetBatch` endpoint for token metadata

### Moralis APIs

**Purpose:** Token price history and chart data

**Endpoints Used:**

1. **Token Pairs** (`/token/{network}/{tokenAddress}/pairs`)
   - Finds trading pairs for a token
   - Returns pair addresses, liquidity, volume
   - Used to identify most liquid pair for charting

2. **OHLCV Data** (`/token/{network}/pairs/{pairAddress}/ohlcv`)
   - Fetches Open, High, Low, Close, Volume data
   - Supports multiple timeframes (1m, 5m, 15m, 30m, 1h, 4h, 1d)
   - Used for price charts in token detail drawer

**Functions Used:**
- `getTokenPairs()` - Calls Moralis API `/token/{network}/{tokenAddress}/pairs` endpoint to find trading pairs
- `getMostLiquidPair()` - Fetches all pairs and selects the one with highest liquidity
- `getOHLCVData()` - Calls Moralis API `/token/{network}/pairs/{pairAddress}/ohlcv` endpoint with date range and timeframe
- `getOHLCVDataLastNDays()` - Wrapper function that calculates date range and calls `getOHLCVData()`

**Chart Data Flow:**
1. User opens token detail drawer
2. System fetches most liquid pair from Moralis
3. Fetches OHLCV data for last 7 days (4-hour intervals = 42 data points)
4. Processes data to calculate midpoints (high + low) / 2
5. Displays chart using Recharts library
6. Data is cached to reduce API calls

### Jupiter Price API

**Purpose:** Real-time token prices

**Functions Used:**
- `fetchTokenPriceFromJupiter()` - Calls Jupiter Price API (`price.jup.ag/v4/price`) with token mint address
- `getTokenPrice()` - Wrapper with caching that checks cache before calling Jupiter API

**Usage:**
- Fetches current USD price for tokens
- Used for calculating USD value of balances
- Cached to reduce API calls

### Supabase (Prediction Markets)

**Purpose:** Prediction markets data storage and retrieval

**Database Schema:**
- Table: `prediction_market_events`
- Stores market events with metadata (title, description, category, tags, dates)
- Includes JSONB `markets` array containing outcome data with `outcomes` and `outcomePrices` arrays
- Tracks volume, liquidity, active status, and featured status

**Architecture:**
- **Repository Pattern** (`PredictionMarketRepo`) - Data access layer using Supabase client
- **Service Layer** (`PredictionMarketService`) - Business logic for fetching and counting markets
- **API Route** (`/api/prediction-markets`) - RESTful endpoint that accepts query parameters
- **React Hook** (`usePredictionMarkets`) - Client-side hook for fetching and caching market data

**Functions Used:**
- `PredictionMarketRepo.findMany()` - Queries Supabase `prediction_market_events` table with filters and options
- `PredictionMarketRepo.count()` - Counts total markets matching filters (with graceful error handling)
- `PredictionMarketService.list()` - Orchestrates fetching markets and total count, returns paginated results
- `mapDbToEvent()` - Transforms database records to application schema, extracts outcomes from JSONB `markets` array

**Filtering & Querying:**
- Supports filtering by: provider, category, tags, active status, featured status, location, date ranges
- Supports search across title and subtitle fields
- Supports sorting by: volume, createdAt, updatedAt, startDate, endDate
- Supports pagination with limit and offset
- Client-side filtering for location (United States/International) and tags (Sports/Politics)

**Data Transformation:**
- Parses `markets` JSONB array to extract individual market outcomes
- Extracts `outcomePrices` and `outcomes` arrays (stored as JSON strings) to calculate probabilities
- Maps database column names (camelCase) to application schema
- Filters out closed markets (`closed: true`) when extracting outcomes
- Uses `groupItemTitle` field as primary name source for outcomes, falls back to question or outcome names

**Data Flow:**
1. Frontend calls `/api/prediction-markets` with query parameters (limit, offset, orderBy, filters)
2. API route initializes Supabase client and creates repository/service instances
3. Service calls `repo.findMany()` with filters and pagination options
4. Repository builds Supabase query with filters (eq, overlaps, gte, lte, ilike for search)
5. Supabase returns database records
6. `mapDbToEvent()` transforms records, parsing JSONB markets array to extract outcomes
7. Service attempts to get total count (with fallback if count query fails)
8. Results returned as JSON with events array, total count, pagination info
9. Frontend hook caches results and handles loading/error states
10. Markets displayed with outcomes and probabilities calculated from outcome prices

**Database Migration:**
See [migrations/create_prediction_market_events.sql](../migrations/create_prediction_market_events.sql) for the complete SQL migration script.

**Sync Script:**
The `syncPredictionMarketEvents()` function in `scripts/sync-prediction-markets.ts` fetches prediction markets from Kalshi and Polymarket APIs and upserts them to Supabase.

**Sync Process:**
1. Fetches all active events from both Kalshi and Polymarket APIs with pagination
2. Applies volume-based sync filtering (T1: 100M+/5min, T2: 10M+/30min, T3: 1M+/60min, T4: <1M/120min)
3. Transforms API responses to normalized schema using `fromKalshi()` and `fromPolymarket()` functions
4. Batches events and upserts to database using `PredictionMarketRepo.upsertEvents()`
5. Marks events as inactive if they weren't returned by APIs
6. Updates finished events based on end dates

**Client Classes:**
- `KalshiClient` - Fetches events from Kalshi API (`trading-api.kalshi.com/trade-api/v2/events`)
- `PolymarketClient` - Fetches events from Polymarket API (`gamma-api.polymarket.com/events`)

**Transformation Functions:**
- `fromKalshi()` - Transforms Kalshi event format to `PredictionMarketEventSchema`, extracts markets array
- `fromPolymarket()` - Transforms Polymarket event format to `PredictionMarketEventSchema`, extracts markets array

**Upsert Function:**
- `PredictionMarketRepo.upsertEvents()` - Bulk upserts events to database using Supabase's upsert with conflict resolution on `(id, provider)`
- Falls back to individual upserts if bulk operation fails
- Returns counts of created/updated events and any errors

---

## State Management

### Jotai Atoms

**Wallet State:**
- `walletSetupStepAtom` - Current setup step (persisted)
- `walletUnlockPasswordAtom` - Unlock password (temporary)
- `activeTabAtom` - Current wallet tab (tokens/activity)

**Token State:**
- `selectedTokenAtom` - Currently selected token
- `walletHoldingsAtom` - Snapshot of all token holdings
- Price cache atoms for Jupiter prices

**Swap State:**
- `swapFromTokenAtom` - Source token
- `swapToTokenAtom` - Destination token
- `swapFromAmountAtom` - Input amount
- `swapToAmountAtom` - Output amount
- Quote-related atoms for Jupiter quotes

**UI State:**
- Drawer open/close atoms
- Loading states
- Error states

**Caching:**
- Price data cache (24-hour TTL)
- Activity transaction cache
- Token metadata cache
- OHLCV chart data cache

### Wallet Context

The `WalletProvider` component manages:
- Wallet initialization and unlocking
- Balance refresh logic
- Transaction sending (public/private)
- Swap execution (public/private)
- Derived account management

**Key Methods:**
- `sendPublic()` - Send public transaction
- `sendPrivately()` - Send private transaction via Encifher
- `deposit()` - Shield funds (deposit to private)
- `withdraw()` - Unshield funds (withdraw from private)
- `swapPublic()` - Execute public swap via Jupiter
- `swapPrivately()` - Execute private swap via Encifher

---

## Security Considerations

1. **API Key Protection**
   - All API keys stored in environment variables
   - Server-side API routes prevent key exposure
   - Client-side code never accesses keys directly

2. **Transaction Signing**
   - All transactions signed locally in browser
   - Private keys never leave the client
   - Uses Solana Web3.js for secure signing

3. **Wallet Security**
   - Mnemonic phrases encrypted with user password
   - Wallet locked by default
   - Password required for unlocking

4. **CORS Protection**
   - External API calls proxied through Next.js API routes
   - Prevents CORS issues and key exposure

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Wallet     │  │     Swap     │  │   Markets    │      │
│  │    Page      │  │     Page     │  │    Page      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                 │                  │             │
│         └─────────────────┼──────────────────┘             │
│                           │                                 │
│                  ┌────────▼────────┐                        │
│                  │  WalletContext │                        │
│                  │   (Jotai Atoms) │                        │
│                  └────────┬────────┘                        │
└───────────────────────────┼─────────────────────────────────┘
                             │
┌───────────────────────────▼─────────────────────────────────┐
│              Next.js API Routes (Backend)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Encifher   │  │   Jupiter    │  │   Supabase   │      │
│  │     API      │  │     API      │  │     API      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
┌────────▼────────┐  ┌───────▼──────┐  ┌────────▼────────┐
│   Encifher SDK  │  │ Jupiter API  │  │  Helius RPC     │
│                 │  │              │  │  Moralis API    │
│  - Shielding    │  │  - Quotes    │  │  - Balances     │
│  - Unshielding  │  │  - Execution │  │  - Transactions │
│  - Private Swap │  │              │  │  - Metadata     │
│                 │  │              │  │  - OHLCV Data   │
└─────────────────┘  └──────────────┘  └─────────────────┘
```

---

## Key Design Decisions

1. **API Route Proxy Pattern**
   - Protects API keys
   - Simplifies frontend code
   - Handles CORS automatically

2. **Atomic State Management (Jotai)**
   - Fine-grained reactivity
   - Easy caching with localStorage
   - Minimal boilerplate

3. **Dual Swap System**
   - Public swaps for speed and transparency
   - Private swaps for privacy-sensitive use cases
   - User choice based on needs

4. **Caching Strategy**
   - Price data cached (24h TTL)
   - Transaction history cached
   - Reduces API calls and improves performance

5. **Progressive Enhancement**
   - Works without private features if Encifher unavailable
   - Graceful degradation for missing data
   - Comprehensive error handling

---

## Future Enhancements

1. **WebSocket Integration**
   - Real-time balance updates
   - Live transaction status
   - Price feed updates

2. **Advanced Privacy Features**
   - Stealth addresses
   - Private transaction batching
   - Enhanced anonymity sets

3. **Multi-chain Support**
   - Ethereum integration
   - Cross-chain swaps
   - Unified interface

4. **Performance Optimizations**
   - Service workers for offline support
   - IndexedDB for large data caching
   - Virtual scrolling for long lists

