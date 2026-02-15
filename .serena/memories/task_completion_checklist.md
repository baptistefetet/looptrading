# LoopTrading - Task Completion Checklist

## After completing any code change:
1. **Verify TypeScript**: Ensure no type errors (`pnpm build` or check in IDE)
2. **Run tests**: `pnpm test` to ensure nothing is broken
3. **Lint**: `pnpm lint` to check code style

## After completing a story:
1. Update the story status in the story file (`Ready for Review` → `Done`)
2. Check off completed tasks in the story
3. Update `CLAUDE.md` (Next Steps section)
4. Commit with a descriptive message
5. Push to GitHub: `git push origin main`

## After database schema changes:
1. `pnpm db:generate` to regenerate Prisma client
2. `pnpm db:migrate` to create/apply migration
3. Update shared types in `src/shared/types.ts` if needed
