# ShadeWallet

A privacy-enhanced Solana wallet with support for public and private transactions, token swaps, and prediction markets.

## Features

- **Wallet Management**: HD wallet generation, multiple derived accounts, password-protected locking
- **Privacy Transactions**: Shield/unshield funds using Encifher SDK for private transactions
- **Token Swaps**: Public swaps via Jupiter Aggregator and private swaps via Encifher (which uses Jupiter internally)
- **Activity History**: Transaction history and activity feed powered by Helius APIs
- **Price Charts**: Token price history and OHLCV data from Moralis APIs
- **Prediction Markets**: Browse and view prediction markets with outcome probabilities

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **State Management**: Jotai with localStorage persistence
- **Blockchain**: Solana Web3.js, Encifher Swap SDK
- **Data Providers**: Helius (balances, transactions), Moralis (price charts), Jupiter (swaps, prices), Supabase (prediction markets)

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables (see `.env.example`):
   - `NEXT_PUBLIC_RPC_URL` - Solana RPC endpoint (Helius recommended)
   - `NEXT_PUBLIC_ENCIFHER_API_KEY` - Encifher API key for private transactions
   - `JUPITER_API_KEY` - Jupiter API key for swaps
   - `NEXT_PUBLIC_MORALIS_API_KEY` - Moralis API key for price charts
   - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Architecture

For detailed technical documentation, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Project Structure

- `app/` - Next.js pages and API routes
- `components/` - React components (wallet, swap, markets, UI)
- `lib/` - Core libraries (wallet context, Encifher, Helius, Moralis, Jupiter)
