/**
 * PnLService — tracks portfolio profit & loss.
 * Snapshots balance values over time and computes unrealised P&L.
 */
import { db } from '../../db/client.js'
import { walletBalances, pockets } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { priceService } from '../price.service.js'
import { lamportsToSol } from '@clutch/core'

export interface TokenPnL {
  token:        string
  currentValue: number
  chain:        string
}

export interface PocketPnL {
  pocketId:     string
  totalValueUsd: number
  breakdown:    TokenPnL[]
  nativeSol:    string
  nativeSolUsd: number
  computedAt:   Date
}

export class PnLService {
  async computePocketPnL(pocketId: string): Promise<PocketPnL> {
    const pocket = await db.query.pockets.findFirst({
      where: eq(pockets.id, pocketId),
      with: { wallets: { with: { balances: true } } },
    })
    if (!pocket) throw new Error('Pocket not found')

    const breakdown: TokenPnL[] = []
    const allTokens = new Set<string>()

    for (const wallet of pocket.wallets) {
      for (const bal of wallet.balances) {
        allTokens.add(bal.token)
      }
    }

    const prices = await priceService.getBatchPrices([...allTokens])

    for (const wallet of pocket.wallets) {
      for (const bal of wallet.balances) {
        const humanAmount  = Number(bal.amount) / 10 ** bal.decimals
        const priceUsd     = prices[bal.token.toUpperCase()] ?? parseFloat(bal.usdValue ?? '0') / humanAmount
        const currentValue = humanAmount * (priceUsd || 0)

        breakdown.push({
          token:        bal.token,
          currentValue,
          chain:        bal.chain,
        })
      }
    }

    const solPrice    = prices['SOL'] ?? 0
    const nativeSol   = lamportsToSol(pocket.nativeBalance)
    const nativeSolUsd = parseFloat(nativeSol) * solPrice
    const totalValueUsd = breakdown.reduce((s, t) => s + t.currentValue, 0) + nativeSolUsd

    return {
      pocketId,
      totalValueUsd,
      breakdown,
      nativeSol,
      nativeSolUsd,
      computedAt: new Date(),
    }
  }
}

export const pnlService = new PnLService()
