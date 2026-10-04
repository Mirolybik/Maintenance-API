# --- Сборка артефактов ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# --- Финальный легковесный образ ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/docs ./docs

# Запуск процесса от непривилегированного пользователя node
USER node

EXPOSE 3000
CMD ["node", "src/server.js"]
