# Clutch — Mainnet Launch Checklist

## Security
- [ ] Rotate JWT_SECRET to a 256-bit random value
- [ ] Move all private keys to AWS KMS / HashiCorp Vault — never store in DB
- [ ] Enable HTTPS (TLS 1.3) on API — set CORS_ORIGIN to production domain only
- [ ] Add rate limiting to auth endpoints (max 5 req/min per IP)
- [ ] Add request signing / HMAC verification to webhook endpoints
- [ ] Audit all SQL queries for injection (Drizzle parameterises by default ✅)
- [ ] Run `pnpm audit` and patch critical/high severity packages
- [ ] Enable Postgres row-level security for multi-tenant isolation

## Infrastructure
- [ ] Provision managed Postgres (RDS / Supabase / Neon) with daily backups
- [ ] Deploy API behind a load balancer (Railway / Fly.io / AWS ECS)
- [ ] Set up Redis for session/rate-limit state (optional but recommended)
- [ ] Configure uptime monitoring (Better Uptime / Checkly)
- [ ] Set up error tracking (Sentry) in API and web app
- [ ] Configure log aggregation (Datadog / Logtail)

## Blockchain
- [ ] Switch all RPC URLs to dedicated endpoints (Alchemy / Infura / QuickNode)
- [ ] Add RPC fallback/retry logic in ConnectorRegistry
- [ ] Test deposit + withdraw flows on each chain with real funds (small amounts)
- [ ] Verify x402 payment flow end-to-end on Base (cheapest gas)
- [ ] Set up Alchemy Notify webhooks for tx confirmation (replaces polling)
- [ ] Audit smart contract interactions if any custom contracts are added

## AI Agent
- [ ] Set ANTHROPIC_API_KEY in production secrets manager
- [ ] Add per-user rate limiting on /agent/* endpoints
- [ ] Cap max_tokens and add spend monitoring on Anthropic console
- [ ] Test agent payment routing with real wallets across all 6 chains
- [ ] Add fallback behaviour when Anthropic API is unavailable

## Mobile
- [ ] Complete App Store Connect submission (screenshots, metadata, privacy policy)
- [ ] Submit to Google Play internal testing track
- [ ] Enable Expo Updates (OTA patches without app store review)
- [ ] Test biometric auth on physical iOS and Android devices
- [ ] Test Ledger BLE pairing on physical Ledger Nano X
- [ ] Enable push notifications for tx confirmations

## Web
- [ ] Deploy to Vercel / Cloudflare Pages with production env vars
- [ ] Set Content-Security-Policy headers
- [ ] Test wallet connect flow with MetaMask, Rainbow, Coinbase Wallet
- [ ] Add Google Analytics / Plausible

## Post-launch
- [ ] Set up Discord/Telegram community
- [ ] Write public-facing docs at docs.clutch.app
- [ ] Draft incident response runbook
- [ ] Schedule weekly dependency updates
