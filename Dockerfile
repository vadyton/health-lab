# ── Stage 1: Build frontend ───────────────────────────────────────────────────
# $BUILDPLATFORM = архитектура машины-сборщика (ARM64 на нашем runner-е).
# Компиляция всегда идёт нативно, без эмуляции.
FROM --platform=$BUILDPLATFORM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Build backend (TypeScript → JS) ──────────────────────────────────
FROM --platform=$BUILDPLATFORM node:22-alpine AS backend-build
WORKDIR /app/backend
RUN apk add --no-cache python3 make g++
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
# Сначала генерируем Prisma-клиент — TypeScript должен видеть его типы при компиляции
RUN DATABASE_URL="postgresql://x:x@localhost/x" npx prisma generate
RUN npm run build

# ── Stage 3: Production image ─────────────────────────────────────────────────
# Финальный образ без --platform: наследует целевую платформу (linux/arm64).
FROM node:22-alpine AS production
WORKDIR /app/backend

RUN apk add --no-cache python3 make g++
COPY backend/package*.json ./
RUN npm ci --omit=dev
RUN apk del --purge python3 make g++

# Скомпилированный бэкенд
COPY --from=backend-build /app/backend/dist ./dist
# Prisma-клиент (engine-бинарники под ARM64, сгенерированные на ARM64-runner-е)
COPY --from=backend-build /app/backend/node_modules/.prisma ./node_modules/.prisma

# Схема и миграции для runtime-деплоя
COPY backend/prisma ./prisma
COPY backend/prisma.config.ts ./

# Фронтенд — отдаётся бэкендом как статика
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["/entrypoint.sh"]
