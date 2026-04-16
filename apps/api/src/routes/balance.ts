import { Hono } from 'hono'
import { db } from '../db/client.js'
import { pockets, wallets, walletBalances } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { balanceService } from '../services/balance.service.js'

export const balanceRoutes = new Hono()
balanceRoutes.use('*', authMiddleware)

/**
 * POST /balances/:pocketId/sync
 * Triggers a live on-chain balance refresh for all wallets in the pocket.
 */
balanceRoutes.post('/:pocketId/sync', async (c) => {
  const userId = c.get('userId') as string
  const pocketId = c.req.param('pocketId')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })

  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  // Run sync in background — return immediately so client isn't blocked
  balanceService.syncPocketBalances(pocketId).catch((err) =>
    console.error('[balance-route] sync error:', err)
  )

  return c.json({ data: { message: 'Balance sync started', pocketId } })
})

/**
 * GET /balances/:pocketId
 * Returns cached balances for all wallets + pocket total USD.
 */
balanceRoutes.get('/:pocketId', async (c) => {
  const userId = c.get('userId') as string
  const pocketId = c.req.param('pocketId')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
    with: {
      wallets: {
        with: { balances: true },
      },
    },
  })

  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  const totalUsd = await balanceService.getPocketTotalUsd(pocketId)

  return c.json({
    data: {
      pocketId,
      totalUsd,
      wallets: pocket.wallets.map((w) => ({
        walletId: w.id,
        address: w.address,
        chain: w.chain,
        label: w.label,
        balances: w.balances,
      })),
    },
  })
})

/**
 * GET /balances/:pocketId/wallet/:walletId
 * Returns balances for a single wallet.
 */
balanceRoutes.get('/:pocketId/wallet/:walletId', async (c) => {
  const userId = c.get('userId') as string
  const { pocketId, walletId } = c.req.param()

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })

  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  const bals = await db.query.walletBalances.findMany({
    where: eq(walletBalances.walletId, walletId),
  })

  return c.json({ data: { walletId, balances: bals } })
})
