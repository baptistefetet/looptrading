# LoopTrading - Suggested Commands

## Development
```bash
pnpm dev          # Watch mode: rebuilds client + restarts server on changes
pnpm build        # Build client (Vite) + server (tsc) → dist/
pnpm start        # Start production server (port 3000)
```

## Testing
```bash
pnpm test         # Run Vitest (node environment, no parallelism)
```

## Linting
```bash
pnpm lint         # ESLint on src/ (.ts, .tsx files)
```

## Database (Prisma + SQLite)
```bash
pnpm db:generate  # Generate Prisma client after schema changes
pnpm db:migrate   # Run migrations (dev mode)
pnpm db:seed      # Seed database (via tsx prisma/seed.ts)
pnpm db:reset     # Reset database (WARNING: deletes all data)
```

## Git Workflow
After completing a story:
1. Update story status and check tasks
2. Update CLAUDE.md (Next Steps)
3. Commit with descriptive message
4. Push: `git push origin main`

## System Commands (macOS / Darwin)
```bash
git status        # Check repo state
git log --oneline # Recent commits
pnpm install      # Install dependencies
```
