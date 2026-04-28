import { db } from '../db/client.js'
import { portfolioSnapshots, pockets, wallets, walletBalances } from '../db/schema.js'
import { eq, and, gte, lte, desc } from 'drizzle-orm'
import { lamportsToSol } from '@clutch/core'
import { priceService } from './price.service.js'

export interface PortfolioPoint {
  ts:       Date
  totalUsd: number
}

export interface TokenBreakdown {
  token:       string
  chain:       string
  amount:      number
  usdValue:    number
  percentage:  number
  change24h?:  number
}

export interface PnLSummary {
  period:         '24h' | '7d' | '30d' | 'all'
  startUsd:       number
  currentUsd:     number
  changeUsd:      number
  changePct:      number
}

export interface AnalyticsReport {
  pocketId:        string
  generatedAt:     Date
  totalUsd:        number
  nativeSolBalance: string
  breakdown:       TokenBreakdown[]
  pnl:             PnLSummary[]
  history:         PortfolioPoint[]   // last 30 days
  topMover:        TokenBreakdown | null
  transactionCount: number
}

export class AnalyticsService {

  /** Take a snapshot of the current portfolio state. Called after each balance sync. */
  async takeSnapshot(pocketId: string): Promise<void> {
    const pocket = await db.query.pockets.findFirst({
      where: eq(pockets.id, pocketId),
      with: { wallets: { with: { balances: true } } },
    })
    if (!pocket) return

    let totalUsd = 0
    const balanceSnapshot: any[] = []

    for (const w of (pocket as any).wallets ?? []) {
      for (const b of w.balances ?? []) {
        const usdValue = parseFloat(b.usdValue ?? '0')
        totalUsd += usdValue
        balanceSnapshot.push({
          walletId: w.id, chain: w.chain, token: b.token,
          amount: b.amount.toString(), decimals: b.decimals, usdValue,
        })
      }
    }

    await db.insert(portfolioSnapshots).values({
      pocketId,
      totalUsd: Math.round(totalUsd * 100),  // cents
      nativeSol: pocket.nativeBalance.toString(),
      balances: JSON.stringify(balanceSnapshot),
    })
  }

  /** Portfolio value history for chart rendering */
  async getHistory(pocketId: string, days = 30): Promise<PortfolioPoint[]> {
    const since = new Date(Date.now() - days * 86_400_000)

    const snaps = await db.query.portfolioSnapshots.findMany({
      where: and(
        eq(portfolioSnapshots.pocketId, pocketId),
        gte(portfolioSnapshots.takenAt, since)
      ),
      orderBy: [portfolioSnapshots.takenAt],
    })

    return snaps.map((s) => ({
      ts:       s.takenAt,
      totalUsd: s.totalUsd / 100,
    }))
  }

  /** P&L across multiple periods */
  async getPnL(pocketId: string, currentUsd: number): Promise<PnLSummary[]> {
    const periods: Array<{ period: PnLSummary['period']; days: number }> = [
      { period: '24h', days: 1 },
      { period: '7d',  days: 7 },
      { period: '30d', days: 30 },
    ]

    const results: PnLSummary[] = []

    for (const { period, days } of periods) {
      const since = new Date(Date.now() - days * 86_400_000)
      const snap  = await db.query.portfolioSnapshots.findFirst({
        where: and(
          eq(portfolioSnapshots.pocketId, pocketId),
          gte(portfolioSnapshots.takenAt, since)
        ),
        orderBy: [portfolioSnapshots.takenAt],  // oldest first
      })

      const startUsd   = snap ? snap.totalUsd / 100 : currentUsd
      const changeUsd  = currentUsd - startUsd
      const changePct  = startUsd > 0 ? (changeUsd / startUsd) * 100 : 0

      results.push({ period, startUsd, currentUsd, changeUsd, changePct })
    }

    // All time
    const oldest = await db.query.portfolioSnapshots.findFirst({
      where: eq(portfolioSnapshots.pocketId, pocketId),
      orderBy: [portfolioSnapshots.takenAt],
    })
    if (oldest) {
      const startUsd  = oldest.totalUsd / 100
      const changeUsd = currentUsd - startUsd
      results.push({
        period: 'all', startUsd, currentUsd,
        changeUsd, changePct: startUsd > 0 ? (changeUsd / startUsd) * 100 : 0,
      })
    }

    return results
  }

  /** Token breakdown with percentages */
  async getBreakdown(pocketId: string): Promise<TokenBreakdown[]> {
    const pocketWallets = await db.query.wallets.findMany({
      where: eq(wallets.pocketId, pocketId),
      with: { balances: true },
    })

    const tokenMap: Record<string, TokenBreakdown> = {}
    let total = 0

    for (const w of pocketWallets) {
      for (const b of (w as any).balances ?? []) {
        const usdValue = parseFloat(b.usdValue ?? '0')
        const key      = `${b.token}:${w.chain}`
        total         += usdValue

        if (!tokenMap[key]) {
          tokenMap[key] = {
            token: b.token, chain: w.chain,
            amount: 0, usdValue: 0, percentage: 0,
          }
        }
        tokenMap[key].amount   += Number(b.amount) / 10 ** b.decimals
        tokenMap[key].usdValue += usdValue
      }
    }

    const breakdown = Object.values(tokenMap)
      .map((t) => ({ ...t, percentage: total > 0 ? (t.usdValue / total) * 100 : 0 }))
      .sort((a, b) => b.usdValue - a.usdValue)

    return breakdown
  }

  /** Build full analytics report */
  async buildReport(pocketId: string): Promise<AnalyticsReport> {
    const [pocket, breakdown, history] = await Promise.all([
      db.query.pockets.findFirst({ where: eq(pockets.id, pocketId) }),
      this.getBreakdown(pocketId),
      this.getHistory(pocketId, 30),
    ])

    if (!pocket) throw new Error('Pocket not found')

    const totalUsd   = breakdown.reduce((s, t) => s + t.usdValue, 0)
    const pnl        = await this.getPnL(pocketId, totalUsd)
    const topMover   = breakdown.length > 0 ? breakdown[0] : null
    const nativeSol  = lamportsToSol(pocket.nativeBalance)

    const txCount = await db.query.portfolioSnapshots.findMany({
      where: eq(portfolioSnapshots.pocketId, pocketId),
    }).then((rows) => rows.length)

    return {
      pocketId,
      generatedAt:      new Date(),
      totalUsd,
      nativeSolBalance: nativeSol,
      breakdown,
      pnl,
      history,
      topMover,
      transactionCount: txCount,
    }
  }

  /** Export transaction history as CSV */
  async exportCsv(pocketId: string): Promise<string> {
    const { transactions } = await import('../db/schema.js')
    const txns = await db.query.transactions.findMany({
      where: eq(transactions.pocketId, pocketId),
      orderBy: [desc(transactions.createdAt)],
    })

    const header = 'date,type,status,from,to,amount,token,chain,tx_hash,memo'
    const rows = txns.map((t) => [
      t.createdAt.toISOString(),
      t.type,
      t.status,
      t.fromAddress,
      t.toAddress,
      (Number(t.amount) / 1e9).toFixed(9),
      t.token,
      t.chain,
      t.txHash ?? '',
      t.memo ?? '',
    ].join(','))

    return [header, ...rows].join('\n')
  }
}

export const analyticsService = new AnalyticsService()
