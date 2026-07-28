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

# Copy Prisma + libsql (needed for runtime)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/@libsql ./node_modules/@libsql

# Install prisma CLI for db push at startup
RUN npm install prisma @prisma/client 2>&1 | tail -3

# Copy entrypoint
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Local fallback
RUN mkdir -p /app/data
ENV DATABASE_URL="file:/app/data/wf.db"

EXPOSE 3000
CMD ["./entrypoint.sh"]
