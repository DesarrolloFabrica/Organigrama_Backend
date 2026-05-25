# Imagen de producción para Cloud Run (NestJS + TypeORM)
# Build:  docker build -t organigrama-backend .
# Run local: docker run --rm -p 8080:8080 --env-file .env -e PORT=8080 organigrama-backend

FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm run build && npm prune --omit=dev

# --- Runtime ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Usuario no root (la imagen oficial node ya incluye el usuario `node`)
RUN chown node:node /app
USER node

COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist

# Cloud Run inyecta PORT (suele ser 8080). main.ts escucha en 0.0.0.0:PORT
EXPOSE 8080

CMD ["node", "dist/main.js"]
