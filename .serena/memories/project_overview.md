# LoopTrading - Project Overview

## Purpose
Personal swing trading web application for receiving buy alerts and visualizing stock opportunities. 100% local, no broker connection, manual portfolio management.

## Key Features
- Portfolio management (manual positions, P&L tracking)
- Watchlist with price targets
- Technical indicators (SMA, EMA, RSI, MACD, Bollinger Bands, OBV)
- Composite scoring system
- Buy alerts (Pullback, Breakout, MACD Cross, Score Threshold)
- Screener with filters
- Stock detail pages with interactive charts
- Real-time quotes via Yahoo Finance
- News feed via Yahoo Finance

## Critical Constraints
1. **Local only** - No cloud, runs on user's machine
2. **No external services** - No Docker, No Redis, No IB Gateway
3. **Free APIs only** - Yahoo Finance for all market data
4. **Manual portfolio** - Positions via UI only
5. **Single port** - localhost:3000 (Fastify serves React + API)

## Tech Stack
| Layer | Technologies |
|-------|-------------|
| Frontend | React 18, Vite (build only), TailwindCSS, TanStack Query (polling 30s), React Router |
| Backend | Fastify, Prisma, SQLite, node-cron, Zod validation |
| Charts | TradingView Lightweight Charts |
| Data | Yahoo Finance (yahoo-finance2) |
| Testing | Vitest |
| Package Manager | pnpm |
| Language | TypeScript (strict mode, ES2022 target) |

## Architecture Principles
- Single package.json (no monorepo)
- No dev server séparé: same behavior dev/prod (Vite = build only)
- No WebSocket: polling via TanStack Query (30s)
- No state manager: TanStack Query + useState
- Path aliases: `@/*`, `@client/*`, `@server/*`, `@shared/*`

## Project Status
All 25 stories implemented across 6 epics. Stories 6.1-6.6 are "Ready for Review".
