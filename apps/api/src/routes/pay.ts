import { Hono } from 'hono'
import { db } from '../db/client.js'
import { pockets, wallets, transactions } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { ConnectorRegistry } from '@clutch/wallet-connectors'
import { ethToWei, ChainId } from '@clutch/core'
import { getAgentService } from '../services/agent.service.js'

export const payRoutes = new Hono()
payRoutes.use('*', authMiddleware)

const registry = new ConnectorRegistry({
  ethRpcUrl:      process.env.ETH_RPC_URL,
  baseRpcUrl:     process.env.BASE_RPC_URL,
  polygonRpcUrl:  process.env.POLYGON_RPC_URL,
  arbitrumRpcUrl: process.env.ARBITRUM_RPC_URL,
  optimismRpcUrl: process.env.OPTIMISM_RPC_URL,
  solanaRpcUrl:   process.env.SOLANA_RPC_URL,
})

/**
 * POST /pockets/:id/pay
 * Execute a payment from a specific wallet (after agent has resolved it).
 * In production: fetch private key from secure vault — never accept it over API.
 */
payRoutes.post('/:id/pay', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.param('id')
  const { walletId, to, amount, token, chain, memo } = await c.req.json()

  if (!walletId || !to || !amount || !token || !chain) {
    return c.json({ error: { code: 'VALIDATION', message: 'walletId, to, amount, token, chain are required' } }, 400)
  }

  // Verify ownership
  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)

  const wallet = await db.query.wallets.findFirst({
    where: and(eq(wallets.id, walletId), eq(wallets.pocketId, pocketId)),
  })
  if (!wallet) return c.json({ error: { code: 'NOT_FOUND', message: 'Wallet not found' } }, 404)

  // Record intent
  const decimals = token === 'SOL' ? 9 : token === 'USDC' || token === 'USDT' ? 6 : 18
  const amountWei = BigInt(Math.floor(Number(amount) * 10 ** decimals))

  const [tx] = await db.insert(transactions).values({
    pocketId,
    walletId,
    type:        'payment',
    status:      'pending',
    fromAddress: wallet.address,
    toAddress:   to,
    amount:      amountWei,
    token,
    chain:       chain as any,
    memo,
  }).returning()

  /**
   * NOTE: In production, broadcast the tx here using the wallet's private key
   * fetched from a secure vault (AWS KMS, HashiCorp Vault, etc).
   * We return the pending tx record — a webhook will confirm it on-chain.
   *
   * const connector  = registry.getOrThrow(chain)
   * const privateKey = await vault.getKey(walletId)
   * const receipt    = await connector.sendTransaction({ to, amount: amountWei, token, chain }, privateKey)
   * await db.update(transactions).set({ status: 'confirmed', txHash: receipt.txHash, confirmedAt: new Date() }).where(eq(transactions.id, tx.id))
   */

  return c.json({
    data: {
      txId:    tx.id,
      txHash:  tx.txHash ?? null,
      status:  tx.status,
      paidAt:  tx.createdAt.getTime(),
      from:    wallet.address,
      to,
      amount,
      token,
      chain,
    },
  })
})

/**
 * POST /pockets/:id/pay/agent
 * One-shot endpoint: agent resolves + pays in a single call.
 */
payRoutes.post('/:id/pay/agent', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.param('id')
  const { to, amount, token, chain, memo } = await c.req.json()

  if (!to || !amount || !token) {
    return c.json({ error: { code: 'VALIDATION', message: 'to, amount, token are required' } }, 400)
  }

  // Verify ownership
  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)

  try {
    const service  = getAgentService()
    const decision = await service.resolvePayment(pocketId, { to, amount, token, chain, memo })

    // Re-use the explicit pay route logic
    c.req.param('id')  // already set
    const fakeBody = { walletId: decision.walletId, to, amount, token: decision.token, chain: decision.chain, memo }

    // Record the tx
    const wallet = await db.query.wallets.findFirst({ where: eq(wallets.id, decision.walletId) })
    if (!wallet) throw new Error('Agent selected non-existent wallet')

    const decimals  = decision.token === 'SOL' ? 9 : decision.token === 'USDC' || decision.token === 'USDT' ? 6 : 18
    const amountWei = BigInt(Math.floor(Number(amount) * 10 ** decimals))

    const [tx] = await db.insert(transactions).values({
      pocketId,
      walletId:    decision.walletId,
      type:        'payment',
      status:      'pending',
      fromAddress: wallet.address,
      toAddress:   to,
      amount:      amountWei,
      token:       decision.token,
      chain:       decision.chain as any,
      memo,
    }).returning()

    return c.json({
      data: {
        decision,
        tx: { id: tx.id, status: tx.status, paidAt: tx.createdAt.getTime() },
      },
    })
  } catch (err: any) {
    return c.json({ error: { code: 'PAYMENT_FAILED', message: err.message } }, 500)
  }
})
