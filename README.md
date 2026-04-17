# Clutch 🫙

> **Your wallets. Always there.**

Unified crypto wallet pocket with AI-powered payment routing and x402 autonomous payments.

---

## Progress

| Session | What | Status |
|---|---|---|
| 1 | Core types · DB schema · Auth · Pocket & Wallet CRUD | ✅ |
| 2 | Balance sync · Price service · CoinGecko integration | ✅ |
| 3 | EVM connector (viem) · Solana connector · Registry | ✅ |
| 4 | Next.js web app · Dashboard · Wallet UI | ✅ |
| 5 | Native fund deposit/withdraw · Tx webhook | ✅ |
| 6 | AI agent · Claude tool-use loop · Streaming chat · Analysis | ✅ |
| 7 | x402 payment protocol · Agent signer · One-shot pay | ✅ |
| 8 | Expo mobile · Ledger/Trezor · Mainnet launch | 🔜 Next |

---

## Quick start

```bash
pnpm install
cp .env.example .env   # add ANTHROPIC_API_KEY for sessions 6+7
bash scripts/setup.sh
pnpm dev
# API → :3001  |  Web → :3000
```

---

## AI Agent (Session 6)

The agent uses Claude with tool use to reason across your wallets:

```
POST /agent/analyze/:pocketId      → portfolio health score + insights
POST /agent/resolve-payment        → pick best wallet for a payment
POST /agent/chat/:pocketId         → streaming SSE chat
```

The tool loop:
1. Claude calls `get_wallet_balance` — fetches live balances
2. Claude calls `estimate_gas_fee` — compares chains
3. Claude calls `get_token_price` — USD conversion
4. Claude calls `select_payment_wallet` — final decision

---

## x402 Payments (Session 7)

```typescript
import { X402Client, createAgentSigner } from '@clutch/x402'

const client = new X402Client({
  signer: createAgentSigner({ apiUrl, token, pocketId }),
  autoApproveUnderUsd: 5.00,
})

// This will automatically pay any 402 and retry
const res = await client.fetch('https://api.example.com/premium-data')
```

API endpoints:
```
POST /pockets/:id/pay            → execute payment from specific wallet
POST /pockets/:id/pay/agent      → agent resolves + pays in one shot
```

---

## Monorepo

```
clutch/
├── apps/
│   ├── api/    Hono · Drizzle · PostgreSQL (v0.7.0)
│   ├── web/    Next.js 14 · Tailwind · AI chat UI
│   └── mobile/ Expo (Session 8)
└── packages/
    ├── core/              Types · pocket logic · utils
    ├── wallet-connectors/ EVM + Solana + Registry
    ├── ai-agent/          Claude tool-use agent
    ├── x402/              HTTP 402 client + server middleware
    └── ui/                Shared components
```
