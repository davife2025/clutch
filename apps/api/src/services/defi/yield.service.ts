/**
 * YieldService — fetches Solana staking and DeFi yield rates.
 *
 * Sources:
 *  - Marinade Finance API for mSOL yield
 *  - Lido for stSOL yield
 *  - Solana network stake APY via Solana Beach
 */

export interface YieldRate {
  protocol:    string
  token:       string
  apy:         number       // annualised percentage, e.g. 7.2 = 7.2%
  tvlUsd?:     number
  updatedAt:   Date
}

const CACHE_TTL_MS = 5 * 60_000  // 5 minutes
let rateCache: { rates: YieldRate[]; fetchedAt: number } | null = null

export class YieldService {
  async getRates(): Promise<YieldRate[]> {
    if (rateCache && Date.now() - rateCache.fetchedAt < CACHE_TTL_MS) {
      return rateCache.rates
    }

    const rates = await Promise.all([
      this.getMarinadeRate(),
      this.getLidoRate(),
      this.getNativeStakeRate(),
    ])

    const valid = rates.filter((r): r is YieldRate => r !== null)
    rateCache = { rates: valid, fetchedAt: Date.now() }
    return valid
  }

  private async getMarinadeRate(): Promise<YieldRate | null> {
    try {
      const res = await fetch('https://api.marinade.finance/msol/apy/rolling30d', {
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) return null
      const data = await res.json() as { value: number }
      return {
        protocol:  'Marinade Finance',
        token:     'mSOL',
        apy:       data.value * 100,
        updatedAt: new Date(),
      }
    } catch {
      return null
    }
  }

  private async getLidoRate(): Promise<YieldRate | null> {
    try {
      const res = await fetch('https://sol-api.lido.fi/v1/stats', {
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) return null
      const data = await res.json() as { apr: number; tvl: number }
      return {
        protocol:  'Lido (stSOL)',
        token:     'stSOL',
        apy:       data.apr * 100,
        tvlUsd:    data.tvl,
        updatedAt: new Date(),
      }
    } catch {
      return null
    }
  }

  private async getNativeStakeRate(): Promise<YieldRate | null> {
    try {
      // Solana Beach public endpoint for network APY
      const res = await fetch('https://api.solanabeach.io/v1/network-stats', {
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) return null
      const data = await res.json() as { networkApy?: number }
      return {
        protocol:  'Native Staking',
        token:     'SOL',
        apy:       data.networkApy ?? 6.8,
        updatedAt: new Date(),
      }
    } catch {
      // Fallback to known approximate APY
      return { protocol: 'Native Staking', token: 'SOL', apy: 6.8, updatedAt: new Date() }
    }
  }
}

export const yieldService = new YieldService()
