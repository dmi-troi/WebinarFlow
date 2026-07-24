# ====== BUILD STAGE ======
FROM node:20-alpine AS builder
WORKDIR /app

# Copy only dependency manifests first (better cache)
COPY package.json bun.lockb* ./

# Install deps
RUN npm install --frozen-lockfile 2>/dev/null || npm install

# Copy the rest
COPY . .

# Generate Prisma client & push schema
RUN npx prisma generate && npx prisma db push --accept-data-loss 2>/dev/null || true

# Build Next.js (standalone)
RUN npx next build

# ====== PRODUCTION STAGE ======
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser  --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static    .next/static
COPY --from=builder /app/public          ./public

# Copy Prisma schema + generated client (needed for runtime queries)
COPY --from=builder /app/prisma          ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# SQLite data volume
VOLUME /app/data

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
