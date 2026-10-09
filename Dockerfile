# --- Этап 1: продакшн-зависимости ---
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# --- Этап 2: мигратор (нужен sequelize-cli из devDependencies) ---
FROM node:20-alpine AS migrator
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --include=dev
COPY src ./src

USER node
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed"]

# --- Этап 3: финальный минимальный образ (последний этап = цель по умолчанию) ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY src ./src
COPY docs ./docs

# Запуск процесса от непривилегированного пользователя node
USER node

EXPOSE 3000
CMD ["node", "src/server.js"]
