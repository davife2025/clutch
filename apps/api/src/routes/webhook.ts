import { Hono } from 'hono'
import { db } from '../db/client.js'
import { transactions } from '../db/schema.js'
import { eq } from 'drizzle-orm'

export const webhookRoutes = new Hono()

/**
 * POST /webhook/tx-confirmed
 * Called by an on-chain indexer (e.g. Alchemy Notify) when a tx is confirmed.
 * Marks the transaction as confirmed and updates confirmedAt.
 *
 * In production: verify the webhook signature before processing.
 */
webhookRoutes.post('/tx-confirmed', async (c) => {
  const { txHash, blockNumber } = await c.req.json()
  if (!txHash) return c.json({ error: { code: 'VALIDATION', message: 'txHash required' } }, 400)

  const [updated] = await db
    .update(transactions)
    .set({ status: 'confirmed', confirmedAt: new Date() })
    .where(eq(transactions.txHash, txHash))
    .returning()

  if (!updated) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Transaction not found' } }, 404)
  }

  return c.json({ data: { updated: true, txId: updated.id } })
})
