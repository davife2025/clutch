import { Hono } from 'hono'
import { db } from '../db/client.js'
import {
  subscriptionPlans, subscriptions, tokenGates, usageRecords, wallets, walletBalances,
} from '../db/schema.js'
import { eq, and, gte } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { priceService } from '../services/price.service.js'
import { pushService } from '../services/push.service.js'
import {
  isSubscriptionActive, nextPeriodEnd, planPriceToRaw, checkGate,
  type TokenGate,
} from '@clutch/subscriptions'
import { createPaymentRequired } from '@clutch/x402'

export const subscriptionRoutes = new Hono()
subscriptionRoutes.use('*', authMiddleware)

// ── Plans ─────────────────────────────────────────────────────────────────────

subscriptionRoutes.get('/plans', async (c) => {
  const plans = await db.query.subscriptionPlans.findMany({
    where: eq(subscriptionPlans.active, true),
  })
  return c.json({ data: { plans: plans.map(parsePlan) } })
})

subscriptionRoutes.post('/plans', async (c) => {
  const { name, description, priceUsd, billingPeriod, token = 'USDC', payTo, features = [] } = await c.req.json()

  if (!name || !priceUsd || !billingPeriod || !payTo) {
    return c.json({ error: { code: 'VALIDATION', message: 'name, priceUsd, billingPeriod, payTo required' } }, 400)
  }

  const solPrice = token === 'SOL' ? await priceService.getUsdPrice('SOL') ?? undefined : undefined
  const priceRaw = planPriceToRaw(priceUsd, token, solPrice)

  const [plan] = await db.insert(subscriptionPlans).values({
    name, description, priceUsd, billingPeriod, token, priceRaw, payTo,
    features: JSON.stringify(features),
  }).returning()

  return c.json({ data: { plan: parsePlan(plan) } }, 201)
})

// ── Subscriptions ─────────────────────────────────────────────────────────────

subscriptionRoutes.get('/', async (c) => {
  const userId = c.get('userId') as string
  const subs = await db.query.subscriptions.findMany({
    where: eq(subscriptions.userId, userId),
    with: { plan: true },
    orderBy: (s, { desc }) => [desc(s.createdAt)],
  })
  return c.json({ data: { subscriptions: subs } })
})

subscriptionRoutes.post('/subscribe', async (c) => {
  const userId = c.get('userId') as string
  const { planId, payerAddress, txHash } = await c.req.json()

  if (!planId || !payerAddress) {
    return c.json({ error: { code: 'VALIDATION', message: 'planId and payerAddress required' } }, 400)
  }

  const plan = await db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.id, planId) })
  if (!plan) return c.json({ error: { code: 'NOT_FOUND', message: 'Plan not found' } }, 404)
  if (!plan.active) return c.json({ error: { code: 'UNAVAILABLE', message: 'Plan is no longer active' } }, 400)

  const now    = new Date()
  const period = parsePlan(plan).billingPeriod

  const [sub] = await db.insert(subscriptions).values({
    userId, planId, payerAddress,
    status:              'active',
    currentPeriodStart:  now,
    currentPeriodEnd:    nextPeriodEnd(now, period),
    lastTxHash:          txHash,
  }).returning()

  await pushService.notifyUser(userId, 'Subscription activated', `Welcome to ${plan.name}!`)
    .catch(() => {})

  return c.json({ data: { subscription: sub } }, 201)
})

subscriptionRoutes.post('/:id/cancel', async (c) => {
  const userId = c.get('userId') as string
  const subId  = c.req.param('id')

  const sub = await db.query.subscriptions.findFirst({
    where: and(eq(subscriptions.id, subId), eq(subscriptions.userId, userId)),
  })
  if (!sub) return c.json({ error: { code: 'NOT_FOUND', message: 'Subscription not found' } }, 404)

  const [updated] = await db.update(subscriptions)
    .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
    .where(eq(subscriptions.id, subId))
    .returning()

  return c.json({ data: { subscription: updated } })
})

// ── Token gates ───────────────────────────────────────────────────────────────

subscriptionRoutes.get('/gates', async (c) => {
  const gates = await db.query.tokenGates.findMany()
  return c.json({ data: { gates } })
})

subscriptionRoutes.post('/gates', async (c) => {
  const body = await c.req.json()
  const [gate] = await db.insert(tokenGates).values(body).returning()
  return c.json({ data: { gate } }, 201)
})

/**
 * POST /subscriptions/gate-check
 * Check whether a user passes a token gate.
 * Fetches their on-chain balances and active subscription IDs.
 */
subscriptionRoutes.post('/gate-check', async (c) => {
  const userId = c.get('userId') as string
  const { gateId } = await c.req.json()
  if (!gateId) return c.json({ error: { code: 'VALIDATION', message: 'gateId required' } }, 400)

  const gate = await db.query.tokenGates.findFirst({ where: eq(tokenGates.id, gateId) })
  if (!gate) return c.json({ error: { code: 'NOT_FOUND', message: 'Gate not found' } }, 404)

  // Build user's token balances from cached wallet balances
  const userWallets = await db.query.wallets.findMany({
    where: eq(wallets.pocketId, userId),  // TODO: join through pocket → user
    with: { balances: true },
  })

  const balances: Record<string, number> = {}
  for (const w of userWallets) {
    for (const b of (w as any).balances ?? []) {
      const amount = Number(b.amount) / 10 ** b.decimals
      balances[b.token] = (balances[b.token] ?? 0) + amount
    }
  }

  // Get active subscription plan IDs
  const activeSubs = await db.query.subscriptions.findMany({
    where: and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')),
  })
  const activePlanIds = activeSubs.map((s) => s.planId)

  const result = checkGate(gate as TokenGate, balances, [], activePlanIds)

  // If gate requires subscription and user doesn't have one, return x402 challenge
  if (!result.allowed && result.paymentRequired && gate.planId) {
    const plan = await db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.id, gate.planId) })
    if (plan) {
      const pr = parsePlan(plan)
      const paymentReq = createPaymentRequired({
        amount:      pr.priceRaw,
        currency:    pr.token,
        payTo:       pr.payTo,
        network:     pr.chain,
        description: `Subscribe to ${pr.name} to access this feature`,
        ttlSeconds:  600,
      })
      return c.json({ data: { ...result, x402: paymentReq } }, 402)
    }
  }

  return c.json({ data: result })
})

// ── Usage recording ───────────────────────────────────────────────────────────

subscriptionRoutes.post('/usage', async (c) => {
  const userId = c.get('userId') as string
  const { subscriptionId, metric, quantity = 1 } = await c.req.json()
  if (!subscriptionId || !metric) {
    return c.json({ error: { code: 'VALIDATION', message: 'subscriptionId and metric required' } }, 400)
  }
  const [record] = await db.insert(usageRecords)
    .values({ subscriptionId, userId, metric, quantity })
    .returning()
  return c.json({ data: { record } }, 201)
})

subscriptionRoutes.get('/usage/:subscriptionId', async (c) => {
  const userId = c.get('userId') as string
  const subId  = c.req.param('subscriptionId')

  const records = await db.query.usageRecords.findMany({
    where: and(eq(usageRecords.subscriptionId, subId), eq(usageRecords.userId, userId)),
    orderBy: (r, { desc }) => [desc(r.recordedAt)],
    limit: 500,
  })

  const totals: Record<string, number> = {}
  for (const r of records) {
    totals[r.metric] = (totals[r.metric] ?? 0) + r.quantity
  }

  return c.json({ data: { records, totals } })
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function parsePlan(p: any) {
  return {
    ...p,
    features: typeof p.features === 'string' ? JSON.parse(p.features) : (p.features ?? []),
  }
}
