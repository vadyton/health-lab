# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Build backend ────────────────────────────────────────────────────
FROM node:22-alpine AS backend-build
WORKDIR /app/backend
# bcrypt and better-sqlite3 require native compilation
RUN apk add --no-cache python3 make g++
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build
# Generate Prisma client (dummy URL satisfies prisma.config.ts validation)
RUN DATABASE_URL="postgresql://x:x@localhost/x" npx prisma generate

# ── Stage 3: Production image ─────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app/backend

RUN apk add --no-cache python3 make g++
COPY backend/package*.json ./
RUN npm ci --omit=dev
RUN apk del --purge python3 make g++

# Compiled backend
COPY --from=backend-build /app/backend/dist ./dist
# Generated Prisma engine binaries (produced by prisma generate in build stage)
COPY --from=backend-build /app/backend/node_modules/.prisma ./node_modules/.prisma

# Prisma schema + migrations for runtime migrate deploy
COPY backend/prisma ./prisma
COPY backend/prisma.config.ts ./

# Built frontend — served as static files by the backend
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["/entrypoint.sh"]
