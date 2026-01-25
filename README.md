# LoopTrading

Personal swing trading application for receiving buy alerts and visualizing stock opportunities.

## Features

- Portfolio management (manual positions)
- Watchlist with price targets
- Technical indicators (SMA, EMA, RSI, MACD, Bollinger Bands)
- Composite scoring system
- Buy alerts (Pullback, Breakout, MACD Cross)
- Real-time quotes via Yahoo Finance

## Prerequisites

- Node.js 20+
- pnpm 8+

## Setup

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Initialize database
pnpm prisma migrate dev

# Seed initial data (optional)
pnpm prisma db seed
```

## Usage

```bash
# Development (watch mode - auto-rebuild on changes)
pnpm dev

# Production build
pnpm build

# Start server
pnpm start
```

Application runs at http://localhost:3000

## Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS, TanStack Query
- **Backend**: Fastify, Prisma, SQLite
- **Charts**: TradingView Lightweight Charts
- **Data**: Yahoo Finance (yahoo-finance2)

## Project Structure

```
looptrading/
├── src/
│   ├── client/          # React frontend
│   ├── server/          # Fastify backend
│   └── shared/          # Shared types
├── prisma/
│   └── schema.prisma    # Database schema
├── package.json
└── vite.config.ts
```

## License

Private - Personal use only
