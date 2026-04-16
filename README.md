# Clutch 🫙

> **Your wallets. Always there.**

Clutch is a unified wallet pocket — a persistent, unforgettable home for all your crypto wallets (cold, hot, hardware) plus native fund holding. Think of it as the fixed pocket in your trousers: it never falls out, it holds everything, and an AI agent can reach in and pay for things on your behalf.

---

## What is Clutch?

| Problem | Clutch's Solution |
|---|---|
| Hardware/cold wallets get lost or forgotten | All wallets live in your Pocket — always accessible |
| Juggling multiple wallets across chains | One view, all balances, all wallets |
| Paying for things across chains is manual | AI agent selects optimal wallet + executes via x402 |
| Holding funds requires a separate wallet | Native balance built into the Pocket |

---

## Monorepo Structure

```
clutch/
├── apps/
│   ├── web/          — Next.js web app
│   ├── mobile/       — Expo React Native app  
│   └── api/          — Hono API server
└── packages/
    ├── core/             — Shared types & business logic
    ├── ui/               — Design system components
    ├── wallet-connectors/— EVM, Solana, hardware wallet adapters
    ├── ai-agent/         — AI agent for smart payments & analysis
    └── x402/             — HTTP 402 payment protocol client
```

---

## Tech Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **API**: Hono (lightweight, edge-ready)
- **Web**: Next.js 14
- **Mobile**: Expo (React Native)
- **Wallet Layer**: viem/wagmi (EVM), @solana/wallet-adapter
- **Payments**: x402 protocol
- **AI Agent**: Claude API
- **Language**: TypeScript throughout

---

## Getting Started

```bash
pnpm install
pnpm dev
```

---

## Roadmap

- [ ] Core pocket creation & wallet aggregation
- [ ] EVM + Solana wallet connectors
- [ ] Native fund holding
- [ ] AI agent — wallet analysis & insights
- [ ] x402 payment execution
- [ ] Hardware wallet support (Ledger, Trezor)
- [ ] Mobile app
