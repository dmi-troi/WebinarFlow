# ====== BUILD STAGE (Debian for correct native binaries) ======
FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update -qq && apt-get install -y -qq openssl > /dev/null 2>&1 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* bun.lock* ./
RUN npm install

COPY . .

# Generate Prisma client (local SQLite URL for generation)
ENV DATABASE_URL="file:/app/data/wf.db"
RUN npx prisma generate

# Build Next.js (no standalone — custom server handles startup)
RUN npx next build

# ====== RUNNER STAGE ======
FROM node:20-slim AS runner
WORKDIR /app
RUN apt-get update -qq && apt-get install -y -qq openssl > /dev/null 2>&1 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Build output
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Full node_modules — needed for runtime imports in server.mjs
COPY --from=builder /app/node_modules ./node_modules

# Config files
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

# Custom server
COPY --from=builder /app/server.mjs ./server.mjs

# Local fallback dir
RUN mkdir -p /app/data

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3000
CMD ["./entrypoint.sh"]
