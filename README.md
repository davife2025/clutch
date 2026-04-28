# Clutch 🫙

> **Your wallets. Always there.**

Clutch is a unified crypto wallet pocket — a fixed, persistent home for all your wallets (hot, cold, hardware) across every chain. It holds funds natively, aggregates balances in real time, and ships an AI agent powered by Claude that reasons across your wallets to route payments intelligently. The x402 layer lets the agent pay for things on your behalf with zero friction.

---

## All 8 Sessions Complete ✅

| # | Session | What was built |
|---|---|---|
| 1 | Foundation | Core types · DB schema · Auth · Pocket & Wallet CRUD |
| 2 | Balance layer | Live balance sync · CoinGecko prices · Balance routes |
| 3 | Wallet connectors | EVM (viem) · Solana · ConnectorRegistry · public RPC fallbacks |
| 4 | Web app | Next.js 14 · Dark dashboard · Wallet cards · Sync UI |
| 5 | Native funds | Deposit/withdraw ETH · FundsService · Tx webhook |
| 6 | AI agent | Claude tool-use loop · Pocket analysis · SSE chat |
| 7 | x402 payments | HTTP 402 client · Agent signer · One-shot pay endpoint |
| 8 | Mobile + launch | Expo app · Ledger/Trezor connectors · EAS build · Launch checklist |

---

## Quick start

```bash
pnpm install
cp .env.example .env          # add DATABASE_URL + ANTHROPIC_API_KEY
bash scripts/setup.sh         # start postgres + run migrations
pnpm dev                      # API :3001 · Web :3000

# Mobile
cd apps/mobile
cp .env.example .env.local
npx expo start
```

---

## What Clutch does

**One pocket, all wallets** — Connect Ethereum, Base, Polygon, Arbitrum, Optimism, and Solana wallets. Hot wallets, cold wallets, Ledger hardware wallets — they all live in the same place.

**Native balance** — Hold ETH directly in the pocket without needing a separate wallet. Deposit and withdraw on demand.

**Live balances** — Syncs token balances across all chains in real time. USD values powered by CoinGecko.

**AI agent** — Claude reasons across your wallets to pick the optimal chain and token for any payment. Prefers L2s to save gas. Uses stablecoins for USD payments. Explains every decision.

**x402 payments** — Drop-in `fetch()` replacement that automatically pays HTTP 402 paywalled APIs. The agent signs, broadcasts, and retries — you just call `fetch()`.

**Ledger support** — Full Ledger Nano X/S+ support via BLE (mobile) and USB (web). Private keys never leave the device.

---

## Monorepo

```
clutch/
├── apps/
│   ├── api/      Hono · Drizzle ORM · PostgreSQL  (v0.7.0)
│   ├── web/      Next.js 14 · Tailwind             (Sessions 4–7)
│   └── mobile/   Expo SDK 51 · React Native        (Session 8)
└── packages/
    ├── core/              Shared types · pocket logic · utils
    ├── wallet-connectors/ EVM · Solana · Ledger · Trezor · Registry
    ├── ai-agent/          Claude tool-use agent · executor · analysis
    ├── x402/              HTTP 402 client · agent signer · server middleware
    └── ui/                Shared design system components
```

---

## API surface (v0.7.0)

```
POST /auth/register|login
GET|POST|DELETE /pockets
POST /pockets/:id/wallets          ADD wallet
DELETE /pockets/:id/wallets/:wid   REMOVE wallet
PATCH /pockets/:id/wallets/:wid/default
POST /pockets/:id/deposit|withdraw NATIVE FUNDS
GET  /pockets/:id/balance
POST /pockets/:id/pay              EXECUTE payment
POST /pockets/:id/pay/agent        AGENT resolves + pays
POST /balances/:id/sync            ON-CHAIN sync (background)
GET  /balances/:id                 CACHED balances + USD totals
GET  /transactions/:id             TX history
POST /agent/analyze/:id            POCKET analysis
POST /agent/resolve-payment        PAYMENT routing decision
POST /agent/chat/:id               STREAMING SSE chat
POST /webhook/tx-confirmed         ON-CHAIN confirmation hook
GET  /health/chains                RPC ping all 6 chains
```

---

## Supported chains

Ethereum · Base · Polygon · Arbitrum · Optimism · Solana

---

## Tech stack

| Layer | Tech |
|---|---|
| API | Hono · Node 20 · TypeScript |
| DB | PostgreSQL · Drizzle ORM |
| EVM | viem |
| Solana | @solana/web3.js + spl-token |
| Hardware | @ledgerhq/hw-app-eth · hw-app-solana |
| AI | Anthropic Claude (claude-opus-4-5) |
| Payments | x402 protocol |
| Web | Next.js 14 · Tailwind CSS |
| Mobile | Expo SDK 51 · React Native 0.74 |
| Monorepo | Turborepo · pnpm workspaces |
