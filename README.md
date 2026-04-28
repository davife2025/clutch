# Clutch 🫙

> **Your wallets. Always there.**

Clutch is a **Solana-first** unified wallet pocket — a persistent home for all your hot, cold, and hardware wallets. It holds SOL natively, aggregates SPL token and NFT balances in real time, and ships an AI agent powered by Claude that routes payments through the best wallet automatically.

---

## Primary chain: Solana

All defaults in Clutch point to Solana:
- Native balance stored in **lamports** (1 SOL = 1,000,000,000 lamports)
- Default chain when adding a wallet: **Solana**
- AI agent prefers Solana wallets and USDC on Solana for payments
- Fees estimated in lamports; SPL tokens tracked natively

EVM chains (Ethereum, Base, Polygon, Arbitrum, Optimism) are fully supported as secondaries.

---

## Quick start

```bash
pnpm install
cp .env.example .env           # see docs/secrets.md
bash scripts/setup.sh
pnpm dev                       # API :3001 · Web :3000
```

---

## Monorepo structure

```
apps/
  api/         Hono API v0.24.0 + Drizzle ORM + PostgreSQL
  web/         Next.js 14 dashboard
  mobile/      Expo SDK 51 (iOS + Android)
  extension/   Chrome MV3 wallet extension

packages/
  core/            ChainId types, lamports/SOL utils, constants
  wallet-connectors/  EVM (viem) + Solana (@solana/web3.js) + Ledger
  ai-agent/        Claude tool-use loop, payment routing, SSE chat
  x402/            HTTP 402 payments
  defi/            Jupiter swaps, yield (Marinade/Jito/Orca), gas tracker
  multisig/        Team pockets, approval engine, Squads integration
  subscriptions/   Plans, billing, token gating, metered usage
  nft/             Metaplex DAS, Magic Eden pricing, NFT transfers
  walletconnect/   Wallet Standard injection, dApp session management
  governance/      Realms DAO, proposals, voting power, cast-vote tx
  solanapay/       Transfer requests, QR links, POS sessions
  bridge/          Wormhole + Mayan Finance cross-chain bridge
  anchor/          IDL explorer, account reader, 12 known programs
  sdk/             ClutchClient + React hooks (public developer SDK)
```

---

## All 24 sessions

| # | Session | Status |
|---|---|---|
| 1 | Core types · DB schema · Auth · Pocket/Wallet CRUD | ✅ |
| 2 | Balance sync · CoinGecko prices | ✅ |
| 3 | EVM connector · Solana connector · ConnectorRegistry | ✅ |
| 4 | Next.js web app · Dashboard · Wallet UI | ✅ |
| 5 | Native SOL deposit/withdraw · FundsService · tx webhook | ✅ |
| 6 | AI agent · Claude tool-use loop · SSE chat · analysis | ✅ |
| 7 | x402 payments · agent signer · one-shot pay | ✅ |
| 8 | Expo mobile · Ledger/Trezor · EAS build · launch checklist | ✅ |
| 9 | Vitest unit tests · Playwright E2E · GitHub Actions CI | ✅ |
| 10 | DeFi: Jupiter swaps · yield · gas tracker · price alerts | ✅ |
| 11 | Real-time: WebSocket · Expo push · live balance+prices | ✅ |
| 12 | Multi-sig + team pockets · proposals · audit log · Squads | ✅ |
| 13 | Token gating + subscriptions · x402 billing · metered usage | ✅ |
| 14 | Analytics · P&L charts · breakdown · CSV export | ✅ |
| 15 | NFT portfolio · DAS client · Metaplex · Magic Eden pricing | ✅ |
| 16 | WalletConnect + dApp browser · Wallet Standard · sessions | ✅ |
| 17 | Solana staking · native accounts · liquid staking · validators | ✅ |
| 18 | Developer SDK · ClutchClient · React hooks · ClutchProvider | ✅ |
| 19 | Realms DAO governance · proposals · voting power · cast vote | ✅ |
| 20 | Chrome extension · MV3 · Wallet Standard injection · popup | ✅ |
| 21 | Solana Pay · payment links · QR codes · POS terminal | ✅ |
| 22 | Cross-chain bridge · Wormhole · Mayan Finance · quote agg | ✅ |
| 23 | Anchor program IDL explorer · account reader · known programs | ✅ |
| 24 | Production deployment: Docker · nginx · Fly.io · CI/CD · monitoring | ✅ |

---

## SPL tokens tracked

SOL · USDC · USDT · BONK · JUP · RAY · ORCA · mSOL · stSOL · WIF · PYTH · JTO

---

## Deploy

```bash
# Fly.io (recommended)
./scripts/deploy.sh fly

# Docker Compose (self-hosted)
./scripts/deploy.sh docker

# Railway
./scripts/deploy.sh railway
```

See `docs/secrets.md` for environment variable setup.

---

## Tech stack

Hono · PostgreSQL · Drizzle ORM · @solana/web3.js · Jupiter v6 · Metaplex DAS · Wormhole · Realms · Claude AI · x402 · Next.js 14 · Expo SDK 51 · Chrome MV3 · Turborepo · pnpm workspaces
