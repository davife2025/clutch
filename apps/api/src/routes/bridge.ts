import { Hono } from 'hono'
import { db } from '../db/client.js'
import { pockets, wallets } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { bridgeAggregator, wormholeTracker, BRIDGE_CHAINS } from '@clutch/bridge'

export const bridgeRoutes = new Hono()
bridgeRoutes.use('*', authMiddleware)

// In-memory transfer history (move to DB in production)
const transferHistory = new Map<string, any[]>()

/**
 * GET /bridge/chains
 * All supported chains with their metadata.
 */
bridgeRoutes.get('/chains', (c) => {
  return c.json({ data: { chains: BRIDGE_CHAINS } })
})

/**
 * GET /bridge/quote?fromChain=solana&toChain=ethereum&fromToken=USDC&toToken=USDC&amount=100
 * Best bridge quote across all protocols.
 */
bridgeRoutes.get('/quote', async (c) => {
  const { fromChain, toChain, fromToken, toToken, amount } = c.req.query()

  if (!fromChain || !toChain || !fromToken || !toToken || !amount) {
    return c.json({ error: { code: 'VALIDATION', message: 'fromChain, toChain, fromToken, toToken, amount required' } }, 400)
  }

  const parsedAmount = parseFloat(amount)
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return c.json({ error: { code: 'VALIDATION', message: 'amount must be a positive number' } }, 400)
  }

  const quotes = await bridgeAggregator.getBestQuote({
    fromChain, toChain, fromToken, toToken, amount: parsedAmount,
  })

  return c.json({ data: { quotes, best: quotes[0] ?? null } })
})

/**
 * POST /bridge/initiate
 * Record a bridge transfer initiation. Returns instructions for the user.
 * Actual tx is signed and broadcast by the client.
 */
bridgeRoutes.post('/initiate', async (c) => {
  const userId = c.get('userId') as string
  const { fromChain, toChain, fromToken, toToken, amount, fromAddress, toAddress, protocol } = await c.req.json()

  if (!fromChain || !toChain || !fromToken || !toToken || !amount || !fromAddress || !toAddress) {
    return c.json({ error: { code: 'VALIDATION', message: 'All bridge params required' } }, 400)
  }

  // Verify source wallet belongs to user
  const wallet = await db.query.wallets.findFirst({ where: eq(wallets.address, fromAddress) })
  if (!wallet) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Source wallet not found in your Clutch' } }, 404)
  }
  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, wallet.pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Not your wallet' } }, 403)
  }

  const transfer = {
    id:              crypto.randomUUID(),
    protocol:        protocol ?? 'wormhole',
    status:          'pending_source',
    fromChain, toChain, fromToken, toToken, amount,
    fromAddress, toAddress,
    initiatedAt:     new Date().toISOString(),
    estimatedTimeMs: 20_000,
  }

  // Store per-user
  const existing = transferHistory.get(userId) ?? []
  transferHistory.set(userId, [transfer, ...existing].slice(0, 50))

  return c.json({
    data: {
      transfer,
      message: `Bridge initiated. Sign the ${fromChain} transaction in your wallet, then monitor status using the transferId.`,
      instructions: [
        `1. Sign the ${fromChain} source transaction`,
        `2. Wait ~${Math.ceil(transfer.estimatedTimeMs / 60000)} minutes for Wormhole Guardians to sign`,
        `3. If needed, claim on ${toChain} (some bridges auto-redeem)`,
      ],
    }
  }, 201)
})

/**
 * GET /bridge/status/:txHash?fromChain=solana
 * Check the status of a Wormhole bridge transfer.
 */
bridgeRoutes.get('/status/:txHash', async (c) => {
  const txHash   = c.req.param('txHash')
  const fromChain = c.req.query('fromChain') ?? 'solana'

  const status = await bridgeAggregator.getTransferStatus(txHash, fromChain)

  return c.json({ data: { txHash, fromChain, status } })
})

/**
 * GET /bridge/history
 * User's bridge transfer history.
 */
bridgeRoutes.get('/history', async (c) => {
  const userId    = c.get('userId') as string
  const transfers = transferHistory.get(userId) ?? []
  return c.json({ data: { transfers } })
})

/**
 * GET /bridge/history/wallet/:address
 * Wormhole transfer history for a specific wallet address.
 */
bridgeRoutes.get('/history/wallet/:address', async (c) => {
  const address = c.req.param('address')
  const history = await wormholeTracker.getTransferHistory(address)
  return c.json({ data: { history } })
})

/**
 * PATCH /bridge/transfer/:id/status
 * Update a transfer status after confirming source tx hash.
 */
bridgeRoutes.patch('/transfer/:id/status', async (c) => {
  const userId     = c.get('userId') as string
  const transferId = c.req.param('id')
  const { sourceTxHash } = await c.req.json()

  const transfers = transferHistory.get(userId) ?? []
  const idx       = transfers.findIndex((t) => t.id === transferId)

  if (idx === -1) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Transfer not found' } }, 404)
  }

  transfers[idx].sourceTxHash = sourceTxHash
  transfers[idx].status       = 'pending_vaa'
  transferHistory.set(userId, transfers)

  return c.json({ data: { transfer: transfers[idx] } })
})
