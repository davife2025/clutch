import { Hono } from 'hono'
import { db } from '../db/client.js'
import { pockets, transactions } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { ConnectorRegistry } from '@clutch/wallet-connectors'
import { ethToWei } from '@clutch/core'

export const fundsRoutes = new Hono()
fundsRoutes.use('*', authMiddleware)

/**
 * POST /pockets/:id/deposit
 * Record a deposit to the pocket's native balance.
 * In production this would verify an on-chain tx before crediting.
 */
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

  const amountWei = ethToWei(String(amount))
  const newBalance = pocket.nativeBalance + amountWei

  await db.update(pockets)
    .set({ nativeBalance: newBalance, updatedAt: new Date() })
    .where(eq(pockets.id, pocketId))

  // Record transaction
  await db.insert(transactions).values({
    pocketId,
    type: 'deposit',
    status: txHash ? 'confirmed' : 'pending',
    fromAddress: '0x0000000000000000000000000000000000000000',
    toAddress: pocketId,
    amount: amountWei,
    token: 'ETH',
    chain: 'ethereum',
    txHash,
    confirmedAt: txHash ? new Date() : undefined,
  })

  return c.json({
    data: {
      pocketId,
      deposited: amount,
      newBalanceWei: newBalance.toString(),
      newBalanceEth: (Number(newBalance) / 1e18).toFixed(6),
    }
  })
})

/**
 * POST /pockets/:id/withdraw
 * Withdraw native ETH from the pocket to an address.
 */
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

  const amountWei = ethToWei(String(amount))
  if (amountWei > pocket.nativeBalance) {
    return c.json({ error: { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient native balance' } }, 400)
  }

  // TODO: in production, broadcast on-chain tx here before decrementing
  // const registry = new ConnectorRegistry({ ethRpcUrl: process.env.ETH_RPC_URL })
  // const receipt  = await registry.getOrThrow('ethereum').sendTransaction(...)

  const newBalance = pocket.nativeBalance - amountWei
  await db.update(pockets)
    .set({ nativeBalance: newBalance, updatedAt: new Date() })
    .where(eq(pockets.id, pocketId))

  await db.insert(transactions).values({
    pocketId,
    type: 'withdraw',
    status: 'pending',   // becomes 'confirmed' after on-chain broadcast
    fromAddress: pocketId,
    toAddress,
    amount: amountWei,
    token: 'ETH',
    chain: 'ethereum',
  })

  return c.json({
    data: {
      pocketId,
      withdrawn: amount,
      toAddress,
      newBalanceWei: newBalance.toString(),
      newBalanceEth: (Number(newBalance) / 1e18).toFixed(6),
    }
  })
})

/**
 * GET /pockets/:id/balance
 * Get current native balance for a pocket.
 */
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
      balanceWei: pocket.nativeBalance.toString(),
      balanceEth: (Number(pocket.nativeBalance) / 1e18).toFixed(6),
    }
  })
})
