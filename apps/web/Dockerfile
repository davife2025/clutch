# ── Build ──────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN npm install -g pnpm

WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/core/package.json ./packages/core/
COPY apps/web/package.json       ./apps/web/

RUN pnpm install --frozen-lockfile

COPY packages/core/       ./packages/core/
COPY apps/web/            ./apps/web/

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

RUN pnpm --filter @clutch/core build
RUN pnpm --filter @clutch/web  build

# ── Production ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production PORT=3000
WORKDIR /app

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static     ./.next/static
COPY --from=builder /app/apps/web/public           ./public

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:3000/ || exit 1

EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
