# ====== BUILD STAGE ======
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* bun.lock* ./
RUN npm install

COPY . .

# Generate Prisma client (force local SQLite URL for generation)
ENV DATABASE_URL="file:/app/data/wf.db"
RUN npx prisma generate

# Build Next.js (standalone)
RUN npx next build

# ====== PRODUCTION STAGE ======
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema + generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy @prisma packages (PrismaClient runtime + adapter)
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy @libsql (libsql client for Turso adapter)
COPY --from=builder /app/node_modules/@libsql ./node_modules/@libsql

# Copy prisma CLI from builder (avoid npm install in runner — saves ~50MB + time)
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Create local DB dir as fallback
RUN mkdir -p /app/data

# Copy entrypoint
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# NOTE: Do NOT set DATABASE_URL here!
# It must be empty so entrypoint.sh can detect TURSO_DATABASE_URL.
# Render injects env vars from the dashboard.

EXPOSE 3000
CMD ["./entrypoint.sh"]
