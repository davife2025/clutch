# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN npm install -g pnpm turbo

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY turbo.json tsconfig.json ./

# Copy package.json files for all packages (for pnpm install caching)
COPY packages/core/package.json       ./packages/core/
COPY packages/wallet-connectors/package.json ./packages/wallet-connectors/
COPY packages/ai-agent/package.json   ./packages/ai-agent/
COPY packages/x402/package.json       ./packages/x402/
COPY packages/defi/package.json       ./packages/defi/
COPY packages/multisig/package.json   ./packages/multisig/
COPY packages/subscriptions/package.json ./packages/subscriptions/
COPY packages/nft/package.json        ./packages/nft/
COPY packages/walletconnect/package.json ./packages/walletconnect/
COPY packages/governance/package.json ./packages/governance/
COPY packages/solanapay/package.json  ./packages/solanapay/
COPY packages/bridge/package.json     ./packages/bridge/
COPY packages/anchor/package.json     ./packages/anchor/
COPY packages/sdk/package.json        ./packages/sdk/
COPY apps/api/package.json            ./apps/api/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Build all packages in dependency order
RUN turbo run build --filter=@clutch/core
RUN turbo run build --filter=@clutch/wallet-connectors
RUN turbo run build --filter=@clutch/ai-agent
RUN turbo run build --filter=@clutch/x402
RUN turbo run build --filter=@clutch/defi
RUN turbo run build --filter=@clutch/multisig
RUN turbo run build --filter=@clutch/subscriptions
RUN turbo run build --filter=@clutch/nft
RUN turbo run build --filter=@clutch/walletconnect
RUN turbo run build --filter=@clutch/governance
RUN turbo run build --filter=@clutch/solanapay
RUN turbo run build --filter=@clutch/bridge
RUN turbo run build --filter=@clutch/anchor
RUN turbo run build --filter=@clutch/api

# ── Production stage ───────────────────────────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
ENV PORT=3001

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/*/dist ./packages/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

EXPOSE 3001

# Run with dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/dist/index.js"]
