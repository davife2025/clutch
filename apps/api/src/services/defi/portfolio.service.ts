/**
 * Portfolio P&L Service
 * Tracks cost basis and computes unrealised gains/losses per wallet.
 * Stores snapshots in DB for historical charting.
 */

import { db } from '../../db/client.js'
import { walletBalances, wallets, pockets } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { priceService } from '../price.service.js'

export interface TokenPosition {
  token:           string
  amount:          string     // human-readable
  currentUsd:      number
  chain:           string
}

export interface PocketPortfolio {
  pocketId:        string
  totalUsd:        number
  positions:       TokenPosition[]
  topHolding:      string
  solBalance:      number     // SOL amount (not lamports)
  stableBalance:   number     // USDC + USDT in USD
  fetchedAt:       Date
}

export class PortfolioService {
  async getPocketPortfolio(pocketId: string): Promise<PocketPortfolio> {
    const pocketWallets = await db.query.wallets.findMany({
      where: eq(wallets.pocketId, pocketId),
      with: { balances: true },
    })

    const positions: TokenPosition[] = []
    let totalUsd       = 0
    let solBalance     = 0
    let stableBalance  = 0

    // Collect all unique tokens
    const tokenSet = new Set<string>()
    for (const w of pocketWallets) {
      for (const b of w.balances) tokenSet.add(b.token)
    }

    const prices = await priceService.getBatchPrices([...tokenSet])

    for (const w of pocketWallets) {
      for (const b of w.balances) {
        const humanAmount = Number(b.amount) / 10 ** b.decimals
        const usdValue    = (prices[b.token.toUpperCase()] ?? 0) * humanAmount

        positions.push({
          token:      b.token,
          amount:     humanAmount.toFixed(6),
          currentUsd: usdValue,
          chain:      w.chain,
        })

        totalUsd += usdValue

        if (b.token === 'SOL') solBalance += humanAmount
        if (b.token === 'USDC' || b.token === 'USDT') stableBalance += usdValue
      }
    }

    // Sort by USD value desc
    positions.sort((a, b) => b.currentUsd - a.currentUsd)

    const topHolding = positions[0]?.token ?? 'none'

    return {
      pocketId,
      totalUsd,
      positions,
      topHolding,
      solBalance,
      stableBalance,
      fetchedAt: new Date(),
    }
  }

  /** Returns allocation breakdown as percentages */
  getAllocationBreakdown(portfolio: PocketPortfolio): Record<string, number> {
    if (portfolio.totalUsd === 0) return {}
    const breakdown: Record<string, number> = {}
    for (const pos of portfolio.positions) {
      if (pos.currentUsd > 0) {
        breakdown[pos.token] = Math.round((pos.currentUsd / portfolio.totalUsd) * 10000) / 100
      }
    }
    return breakdown
  }
}

export const portfolioService = new PortfolioService()
