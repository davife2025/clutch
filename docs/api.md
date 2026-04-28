# Clutch API Reference

Base URL: `http://localhost:3001`

---

## Auth

### POST /auth/register
```json
{ "email": "user@example.com", "password": "secret123" }
```
Returns: `{ data: { token, userId } }`

### POST /auth/login
```json
{ "email": "user@example.com", "password": "secret123" }
```
Returns: `{ data: { token, userId } }`

---

## Pockets
All routes require `Authorization: Bearer <token>`

### POST /pockets — create pocket
```json
{ "name": "Main Pocket" }
```
### GET /pockets — list all user pockets
### GET /pockets/:id — get pocket + wallets + balances
### DELETE /pockets/:id — delete pocket

---

## Wallets

### POST /pockets/:pocketId/wallets — add wallet
```json
{
  "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "chain": "ethereum",
  "type": "hot",
  "label": "Main ETH"
}
```
Chains: `ethereum` · `base` · `polygon` · `solana` · `arbitrum` · `optimism`

### DELETE /pockets/:pocketId/wallets/:walletId
### PATCH /pockets/:pocketId/wallets/:walletId/default

---

## Balances

### POST /balances/:pocketId/sync
Trigger live on-chain refresh (runs in background).

### GET /balances/:pocketId
Returns total USD + per-wallet token balances.

### GET /balances/:pocketId/wallet/:walletId

---

## Transactions

### GET /transactions/:pocketId — last 50 txns

---

## Health

### GET /health — liveness
### GET /health/chains — RPC ping for all 6 chains

---

## DeFi (Session 10)

### GET /defi/quote?from=SOL&to=USDC&amount=1
Jupiter swap quote — route, output amount, price impact.

### POST /defi/swap
Build a Jupiter swap transaction (base64). Client signs + broadcasts.

### GET /defi/yield?pocketId=...
Yield opportunities from Marinade, Jito, Orca, Raydium — filtered by holdings.

### GET /defi/gas
Current Solana network fee estimate (lamports + USD, congestion level).

### GET /defi/metrics?tokens=SOL,USDC,BONK
24h + 7d price change, volume, market cap.

### POST /defi/alerts
Create price alert: `{ token, direction: "above"|"below", targetUsd }`.

### GET /defi/alerts
List user's price alerts.

### DELETE /defi/alerts/:id
Remove an alert.

---

## Real-time (Session 11)

### GET /ws?token=<jwt>
WebSocket endpoint. Send `{ type: "subscribe", pocketId }`.

Server events: `balance_update | price_update | fee_update | tx_confirmed | alert_triggered`

### GET /ws/status
Active WebSocket connection count.

### POST /push/register
Register Expo push token: `{ token, platform: "ios"|"android"|"web" }`.

### DELETE /push/token
Remove a push token.

### POST /push/test
Send test push notification (dev only).
