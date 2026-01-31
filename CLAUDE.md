# CLAUDE.md - Looptrading Project Context

## Project Overview

**Looptrading** is a personal swing trading web application for receiving buy alerts and visualizing stock opportunities. 100% local, no broker connection, manual portfolio management.

## BMAD Process Status

| Phase | Document | Status |
|-------|----------|--------|
| 1. Brief | `docs/brief.md` | Done |
| 2. PRD | `docs/prd.md` | Done |
| 3. Architecture | `docs/architecture.md` | Done (v3.0 - simplified) |
| 4. Stories | `docs/stories/` | Done (25 stories, updated for v3.0) |
| 5. Implementation | - | **In Progress** (Stories 1.1–1.5 done) |

## Architecture v3.0 - Simplification Maximale

### Principes
- **Port unique** : localhost:3000 (Fastify sert React + API)
- **Pas de monorepo** : un seul `package.json`
- **Pas de dev server séparé** : même comportement dev/prod (Vite = build only)
- **Pas de WebSocket** : polling TanStack Query (30s)
- **Pas de state manager** : TanStack Query + useState

### Structure projet
```
looptrading/
├── src/
│   ├── client/          # React frontend
│   ├── server/          # Fastify backend
│   └── shared/          # Types partagés
├── prisma/
│   └── schema.prisma
├── package.json
├── vite.config.ts
└── .env
```

### Tech Stack
| Layer | Technologies |
|-------|--------------|
| Frontend | React 18, Vite, TailwindCSS, TanStack Query, React Router |
| Backend | Fastify, Prisma, SQLite, node-cron, Zod |
| Charts | TradingView Lightweight Charts |
| Data | Yahoo Finance (yahoo-finance2) |

### Supprimés (vs v2.0)
- Turborepo / monorepo
- Socket.io / WebSocket
- Zustand
- CORS config

## Stories par Epic

| Epic | Stories | Fichiers |
|------|---------|----------|
| Epic 1: Foundation | 5 | 1.1-project-init → 1.5 |
| Epic 2: Portfolio & News | 3 | 2.1 → 2.3 |
| Epic 3: Market Data | 4 | 3.1 → 3.4 |
| Epic 4: Scoring & Screening | 3 | 4.1 → 4.3 |
| Epic 5: Alerts | 4 | 5.1 → 5.4 |
| Epic 6: Dashboard & UI | 6 | 6.1 → 6.6 |

## Critical Constraints

1. **Local only** - No cloud, runs on user's machine
2. **No external services** - No Docker, No Redis, No IB Gateway
3. **Free APIs only** - Yahoo Finance for all market data
4. **Manual portfolio** - Positions via UI/CSV import

## Next Steps

1. ~~Brief~~ - Done
2. ~~PRD~~ - Done
3. ~~Architecture v3.0~~ - Done
4. ~~Stories update~~ - Done
5. ~~Story 1.1: Project Init~~ - Done
6. ~~Story 1.2: Database Setup~~ - Done
7. ~~Story 1.3: API Skeleton~~ - Done
8. ~~Story 1.4: Frontend Shell~~ - Done
9. ~~Story 1.5: Scheduler Setup~~ - Done
10. **Next:** Story 2.1: Portfolio Management

## Commands

```bash
pnpm dev       # Watch mode (rebuild client + restart server on changes)
pnpm build     # Build client + server → dist/
pnpm start     # Start server (port 3000)
pnpm test      # Vitest

# Database
pnpm db:generate  # Generate Prisma client
pnpm db:migrate   # Run migrations
pnpm db:seed      # Seed database
pnpm db:reset     # Reset database (warning: deletes all data)
```

## Key Files

| File | Purpose |
|------|---------|
| `docs/architecture.md` | Source of truth for technical decisions |
| `docs/prd.md` | Product requirements |
| `docs/stories/*.md` | Implementation stories |
| `prisma/schema.prisma` | Database schema (section 9 of architecture) |

## BMAD Agents

| Command | Usage |
|---------|-------|
| `/architect` | Architecture decisions, tech stack |
| `/po` | Story validation, PRD updates |
| `/dev` | Implementation guidance |

## Workflow

**A la fin de chaque story:**
1. Mettre à jour le status de la story (`Done`) et cocher les tasks
2. Mettre à jour `CLAUDE.md` (Next Steps)
3. Commit avec message descriptif
4. **Push sur GitHub** (`git push origin main`)
