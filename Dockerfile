# --- Этап 1: Подготовка продакшн-зависимостей ---
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# --- Этап 2: Финальный минимальный образ ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY src ./src
COPY public ./public
COPY docs ./docs

# Запуск процесса от непривилегированного пользователя node
USER node

EXPOSE 3000
CMD ["node", "src/server.js"]
