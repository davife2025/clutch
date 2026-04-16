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
