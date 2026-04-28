import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import { db } from '../db/client.js'
import { pockets } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { priceService } from '../services/price.service.js'
import {
  jupiterClient,
  yieldService,
  estimateSolanaFee,
  fetchTokenMetrics,
  checkAlertTriggered,
  type PriceAlert,
} from '@clutch/defi'

export const defiRoutes = new Hono()
defiRoutes.use('*', authMiddleware)

// In-memory alert store (Session 12 will persist to DB)
const alertStore = new Map<string, PriceAlert[]>()

// ── Swap quotes ───────────────────────────────────────────────────────────────

defiRoutes.get('/quote', async (c) => {
  const { from, to, amount } = c.req.query()
  if (!from || !to || !amount) {
    return c.json({ error: { code: 'VALIDATION', message: 'from, to, amount required' } }, 400)
  }
  try {
    const result = await jupiterClient.getQuote({
      inputToken:  from.toUpperCase(),
      outputToken: to.toUpperCase(),
      amount:      parseFloat(amount),
    })
    return c.json({ data: { quote: result } })
  } catch (err: any) {
    return c.json({ error: { code: 'QUOTE_FAILED', message: err.message } }, 422)
  }
})

defiRoutes.post('/swap', async (c) => {
  const { walletAddress, from, to, amount } = await c.req.json()
  if (!walletAddress || !from || !to || !amount) {
    return c.json({ error: { code: 'VALIDATION', message: 'walletAddress, from, to, amount required' } }, 400)
  }
  try {
    const quoteResult = await jupiterClient.getQuote({
      inputToken: from.toUpperCase(), outputToken: to.toUpperCase(), amount: parseFloat(amount),
    })
    const tx = await jupiterClient.buildSwapTransaction(quoteResult.quote, walletAddress)
    return c.json({ data: { transaction: tx.swapTransaction, lastValidBlock: tx.lastValidBlockHeight, quote: quoteResult } })
  } catch (err: any) {
    return c.json({ error: { code: 'SWAP_FAILED', message: err.message } }, 422)
  }
})

// ── Yield ─────────────────────────────────────────────────────────────────────

defiRoutes.get('/yield', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.query('pocketId')
  try {
    const opportunities = await yieldService.getOpportunities()
    if (pocketId) {
      const pocket = await db.query.pockets.findFirst({
        where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
        with: { wallets: { with: { balances: true } } },
      })
      if (pocket) {
        const tokens = new Set<string>(['SOL'])
        for (const w of (pocket as any).wallets ?? []) {
          for (const b of w.balances ?? []) tokens.add(b.token)
        }
        const filtered = yieldService.filterByHoldings(opportunities, [...tokens])
        return c.json({ data: { opportunities: filtered } })
      }
    }
    return c.json({ data: { opportunities } })
  } catch (err: any) {
    return c.json({ error: { code: 'YIELD_FAILED', message: err.message } }, 500)
  }
})

// ── Gas tracker ───────────────────────────────────────────────────────────────

defiRoutes.get('/gas', async (c) => {
  const solPrice = await priceService.getUsdPrice('SOL')
  const estimate = await estimateSolanaFee(solPrice ?? undefined)
  return c.json({ data: { fee: estimate, chain: 'solana' } })
})

// ── Token metrics ─────────────────────────────────────────────────────────────

defiRoutes.get('/metrics', async (c) => {
  const tokensParam = c.req.query('tokens') ?? 'SOL,USDC,BONK,JUP,RAY'
  const tokens = tokensParam.split(',').map((t) => t.trim().toUpperCase())
  try {
    const metrics = await fetchTokenMetrics(tokens)
    return c.json({ data: { metrics } })
  } catch (err: any) {
    return c.json({ error: { code: 'METRICS_FAILED', message: err.message } }, 500)
  }
})

// ── Price alerts ──────────────────────────────────────────────────────────────

defiRoutes.post('/alerts', async (c) => {
  const userId = c.get('userId') as string
  const { token, direction, targetUsd } = await c.req.json()
  if (!token || !direction || !targetUsd) {
    return c.json({ error: { code: 'VALIDATION', message: 'token, direction, targetUsd required' } }, 400)
  }
  const alert: PriceAlert = {
    id: crypto.randomUUID(), userId, token: token.toUpperCase(),
    direction, targetUsd: parseFloat(targetUsd), createdAt: new Date(), active: true,
  }
  alertStore.set(userId, [...(alertStore.get(userId) ?? []), alert])
  return c.json({ data: { alert } }, 201)
})

defiRoutes.get('/alerts', async (c) => {
  const userId = c.get('userId') as string
  return c.json({ data: { alerts: alertStore.get(userId) ?? [] } })
})

defiRoutes.delete('/alerts/:alertId', async (c) => {
  const userId  = c.get('userId') as string
  const alertId = c.req.param('alertId')
  alertStore.set(userId, (alertStore.get(userId) ?? []).filter((a) => a.id !== alertId))
  return c.json({ data: { deleted: true } })
})

defiRoutes.post('/alerts/check', async (c) => {
  const userId  = c.get('userId') as string
  const alerts  = (alertStore.get(userId) ?? []).filter((a) => a.active)
  if (alerts.length === 0) return c.json({ data: { triggered: [] } })
  const tokens    = [...new Set(alerts.map((a) => a.token))]
  const prices    = await priceService.getBatchPrices(tokens)
  const triggered: PriceAlert[] = []
  for (const alert of alerts) {
    const price = prices[alert.token]
    if (price !== undefined && checkAlertTriggered(alert, price)) {
      alert.active = false; alert.triggeredAt = new Date()
      triggered.push(alert)
    }
  }
  return c.json({ data: { triggered } })
})
