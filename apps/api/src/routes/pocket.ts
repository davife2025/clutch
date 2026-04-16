import { Hono } from 'hono'
import { db } from '../db/client.js'
import { pockets, wallets, walletBalances, transactions } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'

export const pocketRoutes = new Hono()
pocketRoutes.use('*', authMiddleware)

// Create pocket
pocketRoutes.post('/', async (c) => {
  const userId = c.get('userId') as string
  const { name } = await c.req.json().catch(() => ({ name: 'My Pocket' }))

  const [pocket] = await db.insert(pockets)
    .values({ ownerId: userId, name: name ?? 'My Pocket' })
    .returning()

  return c.json({ data: { pocket } }, 201)
})

// Get pocket with wallets + balances
pocketRoutes.get('/:id', async (c) => {
  const userId = c.get('userId') as string
  const pocketId = c.req.param('id')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
    with: {
      wallets: {
        with: { balances: true }
      }
    }
  })

  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  return c.json({ data: { pocket } })
})

// List all pockets for user
pocketRoutes.get('/', async (c) => {
  const userId = c.get('userId') as string

  const userPockets = await db.query.pockets.findMany({
    where: eq(pockets.ownerId, userId),
    with: { wallets: true },
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  })

  return c.json({ data: { pockets: userPockets } })
})

// Delete pocket
pocketRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId') as string
  const pocketId = c.req.param('id')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })

  if (!pocket) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)
  }

  await db.delete(pockets).where(eq(pockets.id, pocketId))
  return c.json({ data: { deleted: true } })
})
