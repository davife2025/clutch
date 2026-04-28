# Clutch 🫙

> **Your wallets. Always there.**

Clutch is a **Solana-first** unified wallet pocket. It's a persistent home for all your Solana wallets plus any EVM wallets you connect. It holds SOL natively, aggregates SPL token balances in real time, and ships an AI agent powered by Claude that routes payments through the best wallet — preferring Solana for its speed and low fees.

---

## Primary chain: Solana

Every default in Clutch points to Solana:
- Native balance stored in **lamports** (1 SOL = 1,000,000,000 lamports)
- Default chain when adding a wallet: **Solana**
- AI agent prefers Solana wallets and USDC on Solana for payments
- Transaction fees estimated in lamports
- SPL tokens tracked: SOL, USDC, USDT, BONK, JUP, RAY, ORCA, mSOL, stSOL, WIF, PYTH, JTO

EVM chains (Ethereum, Base, Polygon, Arbitrum, Optimism) are supported as secondaries.

---

## Progress

| # | Session | Status |
|---|---|---|
| 1–8 | Foundation → Mobile launch | ✅ |
| 9 | Test suite (Vitest + Playwright + CI) | ✅ |
| 10 | DeFi: Jupiter swaps · yield · gas tracker · price alerts | ✅ |
| 11 | Real-time: WebSocket · Expo push · live balance + prices | ✅ |
| 12 | Multi-sig + team pockets · proposals · audit log · Squads | ✅ |
| 13 | Token gating + subscriptions · x402 billing · metered usage | ✅ |
| 14 | Analytics + reporting · P\&L charts · breakdown · CSV export | ✅ |

---

## Quick start

```bash
pnpm install
cp .env.example .env   # set SOLANA_RPC_URL + ANTHROPIC_API_KEY
bash scripts/setup.sh
pnpm dev               # API :3001 · Web :3000
```

---

## Supported tokens (Solana)

SOL · USDC · USDT · BONK · JUP · RAY · ORCA · mSOL · stSOL · WIF · PYTH · JTO

---

## Tech stack

Hono · PostgreSQL · Drizzle · @solana/web3.js · @solana/spl-token · viem (EVM) · Claude AI · x402 · Next.js 14 · Expo SDK 51 · Turborepo
