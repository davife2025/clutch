import { Hono } from 'hono'
import { db } from '../db/client.js'
import { pockets, wallets } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { isValidSolanaAddress, isValidEthAddress, MAX_WALLETS_PER_POCKET } from '@clutch/core'

export const walletRoutes = new Hono()
walletRoutes.use('*', authMiddleware)

const EVM_CHAINS = ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism']

/** POST /pockets/:pocketId/wallets — add wallet, Solana is the default chain */
walletRoutes.post('/:pocketId/wallets', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.param('pocketId')
  const { address, chain = 'solana', type = 'hot', label } = await c.req.json()

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
    with: { wallets: true },
  })
  if (!pocket) return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  if (pocket.wallets.length >= MAX_WALLETS_PER_POCKET) {
    return c.json({ error: { code: 'LIMIT_REACHED', message: `Max ${MAX_WALLETS_PER_POCKET} wallets per pocket` } }, 400)
  }

  // Address validation
  if (chain === 'solana' && !isValidSolanaAddress(address)) {
    return c.json({ error: { code: 'VALIDATION', message: 'Invalid Solana address' } }, 400)
  }
  if (EVM_CHAINS.includes(chain) && !isValidEthAddress(address)) {
    return c.json({ error: { code: 'VALIDATION', message: 'Invalid EVM address' } }, 400)
  }

  const isDefault = pocket.wallets.length === 0

  const [wallet] = await db.insert(wallets)
    .values({ pocketId, address, chain, type, label, isDefault })
    .returning()

  return c.json({ data: { wallet } }, 201)
})

/** DELETE /pockets/:pocketId/wallets/:walletId */
walletRoutes.delete('/:pocketId/wallets/:walletId', async (c) => {
  const userId = c.get('userId') as string
  const { pocketId, walletId } = c.req.param()

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)

  await db.delete(wallets).where(and(eq(wallets.id, walletId), eq(wallets.pocketId, pocketId)))
  return c.json({ data: { deleted: true } })
})

/** PATCH /pockets/:pocketId/wallets/:walletId/default */
walletRoutes.patch('/:pocketId/wallets/:walletId/default', async (c) => {
  const userId = c.get('userId') as string
  const { pocketId, walletId } = c.req.param()

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)

  await db.update(wallets).set({ isDefault: false }).where(eq(wallets.pocketId, pocketId))
  const [updated] = await db.update(wallets)
    .set({ isDefault: true })
    .where(and(eq(wallets.id, walletId), eq(wallets.pocketId, pocketId)))
    .returning()

  return c.json({ data: { wallet: updated } })
})
