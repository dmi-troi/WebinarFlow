# ====== BUILD STAGE (Debian for correct native binaries) ======
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json* bun.lock* ./
RUN npm install

COPY . .

# Generate Prisma client (local SQLite URL for generation)
ENV DATABASE_URL="file:/app/data/wf.db"
RUN npx prisma generate

# Build Next.js standalone
RUN npx next build

# ====== RUNNER STAGE ======
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma generated client + schema
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Turso adapter packages
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/@libsql ./node_modules/@libsql

# Local fallback dir
RUN mkdir -p /app/data

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3000
CMD ["./entrypoint.sh"]
