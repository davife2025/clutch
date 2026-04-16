# Clutch 🫙

> **Your wallets. Always there.**

Clutch is a unified wallet pocket — a persistent home for all your crypto wallets (cold, hot, hardware) plus native fund holding. An AI agent can reach in and pay for things across wallets on your behalf using the x402 protocol.

---

## Progress

| Session | What | Status |
|---|---|---|
| 1 | Core types · DB schema · Auth · Pocket + Wallet CRUD | ✅ Done |
| 2 | Balance sync service · Price service · Balance routes | ✅ Done |
| 3 | EVM connector (viem) · Solana connector · Hardware stub · ConnectorRegistry | ✅ Done |
| 4 | Next.js web app · Pocket dashboard · Connect wallet UI | 🔜 |
| 5 | Native fund deposit/withdraw · On-chain tx flow | 🔜 |
| 6 | AI agent · Claude API · Smart payment routing | 🔜 |
| 7 | x402 payment client · Agent-driven pay flow | 🔜 |
| 8 | Expo mobile · Ledger/Trezor · Mainnet launch | 🔜 |

---

## Monorepo

```
clutch/
├── apps/
│   ├── api/          Hono API server (Sessions 1-3)
│   ├── web/          Next.js web app (Session 4)
│   └── mobile/       Expo React Native (Session 8)
└── packages/
    ├── core/             Types · pocket logic · utils · constants
    ├── wallet-connectors EVM (viem) · Solana · Hardware stub · Registry
    ├── ai-agent/         Claude-powered wallet agent (Session 6)
    ├── x402/             HTTP 402 payment client (Session 7)
    └── ui/               Shared component library (Session 4)
```

---

## Quick Start

```bash
# 1. Install
pnpm install

# 2. Configure
cp .env.example .env

# 3. Start DB + run migrations
bash scripts/setup.sh

# 4. Dev
pnpm dev
```

API runs at `http://localhost:3001`. See `docs/api.md` for full reference.

---

## Supported Chains

| Chain | Native | USDC | USDT | Other |
|---|---|---|---|---|
| Ethereum | ETH | ✅ | ✅ | DAI, WBTC |
| Base | ETH | ✅ | — | DAI |
| Polygon | MATIC | ✅ | ✅ | — |
| Arbitrum | ETH | ✅ | — | ARB |
| Optimism | ETH | ✅ | — | OP |
| Solana | SOL | ✅ | ✅ | BONK, JUP |

---

## Tech Stack

- **Runtime**: Node.js 20, pnpm workspaces, Turborepo
- **API**: Hono
- **DB**: PostgreSQL + Drizzle ORM
- **EVM**: viem
- **Solana**: @solana/web3.js + @solana/spl-token
- **AI**: Anthropic Claude API (Session 6)
- **Payments**: x402 protocol (Session 7)
- **Web**: Next.js 14 (Session 4)
- **Mobile**: Expo (Session 8)
