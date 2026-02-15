# LoopTrading - Code Style & Conventions

## Language & Compiler
- TypeScript strict mode (`strict: true`)
- Target: ES2022
- Module: ESNext with bundler resolution
- JSX: react-jsx

## Naming Conventions
- **Files**: PascalCase for React components/pages (e.g., `Dashboard.tsx`, `StockChart.tsx`)
- **Files**: PascalCase for services (e.g., `AlertService.ts`, `MarketDataService.ts`)
- **Files**: camelCase for routes (e.g., `stocks.ts`, `portfolio.ts`)
- **Files**: camelCase for hooks with `use` prefix (e.g., `useAlerts.ts`, `useScreener.ts`)
- **Interfaces**: PascalCase (e.g., `StockQuote`, `ScreenerResult`)
- **Types**: PascalCase (e.g., `Market`, `Strategy`)

## Project Structure
```
src/
├── client/              # React frontend
│   ├── components/      # Reusable UI components (Layout, Sidebar, StockChart, etc.)
│   ├── hooks/           # Custom hooks (useAlerts, useScreener, useWatchlist, etc.)
│   ├── lib/             # Client utilities
│   ├── pages/           # Route pages (Dashboard, Portfolio, Screener, etc.)
│   ├── App.tsx          # Router setup
│   ├── main.tsx         # Entry point
│   └── index.css        # Tailwind imports
├── server/              # Fastify backend
│   ├── config/          # Configuration
│   ├── lib/             # Server utilities (prisma.ts)
│   ├── routes/          # API routes (stocks, portfolio, alerts, etc.)
│   ├── services/        # Business logic services
│   │   └── jobs/        # Cron job definitions
│   ├── utils/           # Server utilities
│   ├── __tests__/       # Server tests
│   ├── app.ts           # Fastify app setup
│   └── index.ts         # Server entry point
└── shared/              # Shared between client & server
    └── types.ts         # All shared TypeScript interfaces and types
```

## Path Aliases
- `@/*` → `src/*`
- `@client/*` → `src/client/*`
- `@server/*` → `src/server/*`
- `@shared/*` → `src/shared/*`

## API Patterns
- Zod for request validation (fastify-type-provider-zod)
- API responses follow `ApiResponse<T>` / `ApiError` from shared types
- Routes organized by domain in separate files under `src/server/routes/`

## Frontend Patterns
- TanStack Query for server state (polling at 30s intervals)
- React Router v6 for routing
- No global state manager (TanStack Query + useState)
- TailwindCSS for styling

## Database
- Prisma ORM with SQLite
- Schema in `prisma/schema.prisma`
- Models: Stock, StockData, Position, WatchlistItem, AlertRule, Alert, UserSettings
- Prisma client singleton in `src/server/lib/prisma.ts`

## Testing
- Vitest with node environment
- Tests co-located or in `__tests__/` directories
- Test files: `*.test.ts`
- No file parallelism (`fileParallelism: false`)
