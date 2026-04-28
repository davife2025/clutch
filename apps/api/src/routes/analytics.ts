import { Hono } from 'hono'
import { db } from '../db/client.js'
import { pockets } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { analyticsService } from '../services/analytics.service.js'

export const analyticsRoutes = new Hono()
analyticsRoutes.use('*', authMiddleware)

/**
 * GET /analytics/:pocketId/report
 * Full analytics report: total, breakdown, P&L across 24h/7d/30d/all, history.
 */
analyticsRoutes.get('/:pocketId/report', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.param('pocketId')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)

  try {
    const report = await analyticsService.buildReport(pocketId)
    return c.json({ data: { report } })
  } catch (err: any) {
    return c.json({ error: { code: 'REPORT_FAILED', message: err.message } }, 500)
  }
})

/**
 * GET /analytics/:pocketId/history?days=30
 * Portfolio value time series for chart rendering.
 */
analyticsRoutes.get('/:pocketId/history', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.param('pocketId')
  const days     = parseInt(c.req.query('days') ?? '30')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)

  const history = await analyticsService.getHistory(pocketId, Math.min(days, 365))
  return c.json({ data: { history } })
})

/**
 * GET /analytics/:pocketId/pnl
 * P&L summary across all time periods.
 */
analyticsRoutes.get('/:pocketId/pnl', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.param('pocketId')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)

  const breakdown  = await analyticsService.getBreakdown(pocketId)
  const currentUsd = breakdown.reduce((s, t) => s + t.usdValue, 0)
  const pnl        = await analyticsService.getPnL(pocketId, currentUsd)

  return c.json({ data: { pnl, currentUsd } })
})

/**
 * GET /analytics/:pocketId/breakdown
 * Token allocation breakdown with percentages.
 */
analyticsRoutes.get('/:pocketId/breakdown', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.param('pocketId')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)

  const breakdown = await analyticsService.getBreakdown(pocketId)
  return c.json({ data: { breakdown } })
})

/**
 * GET /analytics/:pocketId/export.csv
 * Download transaction history as CSV.
 */
analyticsRoutes.get('/:pocketId/export.csv', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.param('pocketId')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)

  const csv = await analyticsService.exportCsv(pocketId)

  return new Response(csv, {
    headers: {
      'Content-Type':        'text/csv',
      'Content-Disposition': `attachment; filename="clutch-${pocketId.slice(0, 8)}-transactions.csv"`,
    },
  })
})

/**
 * POST /analytics/:pocketId/snapshot
 * Manually trigger a portfolio snapshot.
 */
analyticsRoutes.post('/:pocketId/snapshot', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.param('pocketId')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)

  await analyticsService.takeSnapshot(pocketId)
  return c.json({ data: { snapshotTaken: true } })
})
