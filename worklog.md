---
Task ID: 1
Agent: Super Z (main)
Task: Fix WebinarFlow 502 error on Render.com - Turso connection

Work Log:
- Analyzed Dockerfile, entrypoint.sh, db.ts, next.config.ts
- Found critical bug: Dockerfile line 44 set ENV DATABASE_URL="file:/app/data/wf.db" in runner stage, which prevented entrypoint.sh from ever detecting TURSO_DATABASE_URL
- Simplified db.ts to just `new PrismaClient()` — removed adapter pattern, require() calls
- Simplified Dockerfile: removed npm install in runner, removed ENV DATABASE_URL
- Simplified entrypoint.sh: removed prisma db push, always prefer TURSO_DATABASE_URL
- Reverted next.config.ts to simple config
- Pushed 4 files to GitHub via GitHub API (git push was failing)

Stage Summary:
- Files pushed: src/lib/db.ts, Dockerfile, entrypoint.sh, next.config.ts
- All 4 commits confirmed on GitHub remote
- Render should auto-deploy from these commits
- Token and credentials cleaned up