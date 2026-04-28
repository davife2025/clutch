import { Hono } from 'hono'
import { db } from '../db/client.js'
import { pockets, transactions } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { solToLamports, lamportsToSol } from '@clutch/core'

export const fundsRoutes = new Hono()
fundsRoutes.use('*', authMiddleware)

const LAMPORTS_PER_SOL = 1_000_000_000n

/** POST /pockets/:id/deposit — credit SOL to the pocket's native balance */
fundsRoutes.post('/:id/deposit', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.param('id')
  const { amount, txHash } = await c.req.json()

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return c.json({ error: { code: 'VALIDATION', message: 'Invalid amount' } }, 400)
  }

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)

  const lamports    = solToLamports(String(amount))
  const newBalance  = pocket.nativeBalance + lamports

  await db.update(pockets)
    .set({ nativeBalance: newBalance, updatedAt: new Date() })
    .where(eq(pockets.id, pocketId))

  await db.insert(transactions).values({
    pocketId,
    type:        'deposit',
    status:      txHash ? 'confirmed' : 'pending',
    fromAddress: '11111111111111111111111111111111',  // Solana system program
    toAddress:   pocketId,
    amount:      lamports,
    token:       'SOL',
    chain:       'solana',
    txHash,
    confirmedAt: txHash ? new Date() : undefined,
  })

  return c.json({
    data: {
      pocketId,
      deposited:       amount,
      newBalanceLamports: newBalance.toString(),
      newBalanceSol:   lamportsToSol(newBalance),
    }
  })
})

/** POST /pockets/:id/withdraw — debit SOL from pocket, send on-chain */
fundsRoutes.post('/:id/withdraw', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.param('id')
  const { amount, toAddress } = await c.req.json()

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return c.json({ error: { code: 'VALIDATION', message: 'Invalid amount' } }, 400)
  }
  if (!toAddress) {
    return c.json({ error: { code: 'VALIDATION', message: 'Destination address required' } }, 400)
  }

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)

  const lamports = solToLamports(String(amount))
  if (lamports > pocket.nativeBalance) {
    return c.json({ error: { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient SOL balance' } }, 400)
  }

  const newBalance = pocket.nativeBalance - lamports

  await db.update(pockets)
    .set({ nativeBalance: newBalance, updatedAt: new Date() })
    .where(eq(pockets.id, pocketId))

  await db.insert(transactions).values({
    pocketId,
    type:        'withdraw',
    status:      'pending',
    fromAddress: pocketId,
    toAddress,
    amount:      lamports,
    token:       'SOL',
    chain:       'solana',
  })

  return c.json({
    data: {
      pocketId,
      withdrawn:          amount,
      toAddress,
      newBalanceLamports: newBalance.toString(),
      newBalanceSol:      lamportsToSol(newBalance),
    }
  })
})

/** GET /pockets/:id/balance — native SOL balance */
fundsRoutes.get('/:id/balance', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.param('id')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)

  return c.json({
    data: {
      pocketId,
      lamports: pocket.nativeBalance.toString(),
      sol:      lamportsToSol(pocket.nativeBalance),
    }
  })
})
