# @clutch/sdk

> Embed Clutch wallet pockets in any Solana application.

The Clutch SDK gives you a typed HTTP client and React hooks to integrate Solana wallet management, DeFi, NFTs, staking, and AI-powered payments into your own app.

---

## Install

```bash
pnpm add @clutch/sdk
# or
npm install @clutch/sdk
```

---

## Quick start

### Node.js / server

```typescript
import { ClutchClient } from '@clutch/sdk'

const clutch = new ClutchClient({
  apiUrl: 'https://api.yourclutch.com',
  token:  'user-jwt-token',
})

// List pockets
const { pockets } = await clutch.pockets.list()

// Get swap quote
const { quote } = await clutch.defi.getQuote({ from: 'SOL', to: 'USDC', amount: 1 })

// AI-powered payment
const { decision, tx } = await clutch.payments.payWithAgent('pocket-id', {
  to:     'recipient-solana-address',
  amount: '0.01',
  token:  'SOL',
  memo:   'Coffee',
})
```

### React

```tsx
import { ClutchProvider, useClutchClient, usePockets, useBalances, useAgent } from '@clutch/sdk'

// 1. Wrap your app
function App() {
  return (
    <ClutchProvider apiUrl="https://api.yourclutch.com" token={userToken}>
      <Dashboard />
    </ClutchProvider>
  )
}

// 2. Use hooks anywhere inside the tree
function Dashboard() {
  const client = useClutchClient()
  const { data: pockets, loading } = usePockets(client)
  const { totalUsd, sync } = useBalances(client, pockets?.[0]?.id ?? '')
  const { analyze, analysis, analyzing } = useAgent(client)

  if (loading) return <div>Loading...</div>

  return (
    <div>
      <p>Total value: ${totalUsd.toFixed(2)}</p>
      <button onClick={() => sync()}>Sync balances</button>
      <button onClick={() => analyze(pockets![0].id)} disabled={analyzing}>
        {analyzing ? 'Analysing...' : 'AI analysis'}
      </button>
      {analysis && <pre>{analysis.summary}</pre>}
    </div>
  )
}
```

---

## API reference

### `ClutchClient`

| Namespace | Methods |
|---|---|
| `client.auth` | `login`, `register` |
| `client.pockets` | `list`, `get`, `create`, `delete`, `nativeBalance`, `deposit`, `withdraw` |
| `client.wallets` | `add`, `remove`, `setDefault` |
| `client.balances` | `get`, `sync` |
| `client.transactions` | `list` |
| `client.payments` | `resolveAgent`, `payWithAgent`, `execute` |
| `client.agent` | `analyze` |
| `client.defi` | `getQuote`, `getGas`, `getMetrics`, `getYield`, `createAlert`, `listAlerts`, `deleteAlert` |
| `client.nfts` | `list`, `sync`, `get`, `transfer`, `marketplaceStats` |
| `client.staking` | `portfolio`, `validators`, `liquidOptions` |
| `client.analytics` | `report`, `history`, `pnl`, `snapshot` |
| `client.push` | `register`, `unregister` |
| `client.health` | `check`, `chains` |

### React hooks

| Hook | Returns |
|---|---|
| `usePockets(client)` | `{ data, loading, error, refresh }` |
| `usePocket(client, id)` | `{ data, loading, error, refresh }` |
| `useBalances(client, id)` | `{ totalUsd, wallets, sync, loading }` |
| `useNativeBalance(client, id)` | `{ data: { lamports, sol }, loading }` |
| `useTransactions(client, id)` | `{ transactions, loading }` |
| `useAgent(client)` | `{ analyze, analysis, analyzing, error }` |
| `useYield(client, id?)` | `{ data: opportunities[], loading }` |
| `useTokenMetrics(client, tokens)` | `{ data: metrics[], loading }` |
| `useNfts(client, id)` | `{ nfts, totalItems, sync, loading }` |
| `useAnalytics(client, id)` | `{ data: report, loading }` |
| `useStaking(client, id)` | `{ data: { portfolios, totalStakedSOL }, loading }` |

---

## Error handling

```typescript
import { ClutchError } from '@clutch/sdk'

try {
  await clutch.pockets.create('My Pocket')
} catch (err) {
  if (err instanceof ClutchError) {
    console.log(err.code)    // 'VALIDATION' | 'NOT_FOUND' | 'UNAUTHORIZED' etc.
    console.log(err.status)  // HTTP status code
    console.log(err.message) // Human-readable message
  }
}
```

---

## Token refresh

```typescript
const clutch = new ClutchClient({
  apiUrl: 'https://api.yourclutch.com',
  token:  localStorage.getItem('token') ?? '',
  onTokenRefresh: async () => {
    // Called automatically on 401
    const newToken = await refreshMyToken()
    localStorage.setItem('token', newToken)
    return newToken
  },
})
```
