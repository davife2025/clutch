# Clutch 🫙

> **Your wallets. Always there.**

Clutch is a unified wallet pocket — a persistent home for all your crypto wallets (cold, hot, hardware) plus native fund holding. An AI agent pays for things across wallets on your behalf using the x402 protocol.

---

## Progress

| Session | What | Status |
|---|---|---|
| 1 | Core types · DB schema · Auth · Pocket & Wallet CRUD | ✅ Done |
| 2 | Balance sync · Price service · Balance routes | ✅ Done |
| 3 | EVM connector · Solana connector · ConnectorRegistry | ✅ Done |
| 4 | Next.js web app · Dashboard · Wallet UI · Add wallet flow | ✅ Done |
| 5 | Native fund deposit/withdraw · Funds service · Tx webhook | ✅ Done |
| 6 | AI agent · Claude API · Smart payment routing | 🔜 Next |
| 7 | x402 payment client · Agent-driven pay flow | 🔜 |
| 8 | Expo mobile · Ledger/Trezor · Mainnet launch | 🔜 |

---

## Quick start

```bash
pnpm install
cp .env.example .env       # update DATABASE_URL if needed
bash scripts/setup.sh      # starts postgres, runs migrations

pnpm dev                   # starts API (3001) + web (3000)
```

Open **http://localhost:3000** → register → create pocket → add wallet → sync balances.

---

## API routes (v0.5.0)

| Method | Path | Description |
|---|---|---|
| POST | /auth/register | Create account |
| POST | /auth/login | Get JWT |
| GET  | /pockets | List pockets |
| POST | /pockets | Create pocket |
| GET  | /pockets/:id | Pocket + wallets + balances |
| DELETE | /pockets/:id | Delete pocket |
| POST | /pockets/:id/wallets | Add wallet |
| DELETE | /pockets/:id/wallets/:wid | Remove wallet |
| PATCH | /pockets/:id/wallets/:wid/default | Set default |
| POST | /pockets/:id/deposit | Deposit native ETH |
| POST | /pockets/:id/withdraw | Withdraw native ETH |
| GET  | /pockets/:id/balance | Native balance |
| POST | /balances/:id/sync | Trigger on-chain sync |
| GET  | /balances/:id | Cached balances + USD |
| GET  | /transactions/:id | Tx history |
| POST | /webhook/tx-confirmed | On-chain confirm hook |
| GET  | /health/chains | RPC ping all chains |

---

## Monorepo

```
clutch/
├── apps/
│   ├── api/       Hono · Drizzle · PostgreSQL
│   ├── web/       Next.js 14 · Tailwind · dark UI
│   └── mobile/    Expo (Session 8)
└── packages/
    ├── core/              Types · pocket logic · utils
    ├── wallet-connectors/ EVM (viem) · Solana · Registry
    ├── ai-agent/          Claude agent (Session 6)
    ├── x402/              Payment client (Session 7)
    └── ui/                Shared components
```
