/**
 * Portfolio tracker — P&L calculation, gas fee estimation, price alerts.
 */

import { WalletBalance, ChainId } from '@clutch/core'

// ── P&L Tracking ─────────────────────────────────────────────────────────────

export interface PortfolioSnapshot {
  pocketId:     string
  takenAt:      Date
  totalUsd:     number
  balances:     Array<{ token: string; amount: number; usdValue: number }>
}

export interface PnLResult {
  absoluteUsd:  number    // current - cost basis
  percentChange: number   // %
  period:       string    // '24h' | '7d' | '30d'
  from:         number    // USD value at start of period
  to:           number    // current USD value
}

export function calculatePnL(
  current: number,
  previous: number,
  period: string,
): PnLResult {
  const absoluteUsd   = current - previous
  const percentChange = previous > 0 ? ((current - previous) / previous) * 100 : 0
  return { absoluteUsd, percentChange, period, from: previous, to: current }
}

// ── Solana Fee Tracker ────────────────────────────────────────────────────────

export interface SolanaFeeEstimate {
  baseFee:           number   // lamports — always 5000
  priorityFee:       number   // lamports — variable
  totalFee:          number   // lamports
  totalFeeSol:       string   // human-readable SOL
  totalFeeUsd:       number | null
  congestion:        'low' | 'medium' | 'high'
}

export async function estimateSolanaFee(
  solPriceUsd?: number
): Promise<SolanaFeeEstimate> {
  const BASE_FEE = 5000  // lamports, fixed

  try {
    // Use recent prioritization fees from a public RPC
    const res = await fetch('https://api.mainnet-beta.solana.com', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id:      1,
        method:  'getRecentPrioritizationFees',
        params:  [[]],
      }),
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) throw new Error('RPC error')

    const data = await res.json() as { result: Array<{ prioritizationFee: number }> }
    const fees = data.result ?? []

    if (fees.length === 0) throw new Error('No fee data')

    // Median of recent fees
    const sorted = fees.map((f) => f.prioritizationFee).sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0

    const congestion: 'low' | 'medium' | 'high' =
      median < 1000 ? 'low' : median < 10_000 ? 'medium' : 'high'

    const totalFee    = BASE_FEE + median
    const totalFeeSol = (totalFee / 1e9).toFixed(9)
    const totalFeeUsd = solPriceUsd ? (totalFee / 1e9) * solPriceUsd : null

    return { baseFee: BASE_FEE, priorityFee: median, totalFee, totalFeeSol, totalFeeUsd, congestion }
  } catch {
    // Fallback estimate
    return {
      baseFee:     BASE_FEE,
      priorityFee: 1000,
      totalFee:    6000,
      totalFeeSol: (6000 / 1e9).toFixed(9),
      totalFeeUsd: solPriceUsd ? (6000 / 1e9) * solPriceUsd : null,
      congestion:  'low',
    }
  }
}

// ── Price Alerts ──────────────────────────────────────────────────────────────

export type AlertDirection = 'above' | 'below'

export interface PriceAlert {
  id:        string
  userId:    string
  token:     string
  direction: AlertDirection
  targetUsd: number
  createdAt: Date
  triggeredAt?: Date
  active:    boolean
}

export function checkAlertTriggered(
  alert: PriceAlert,
  currentPrice: number,
): boolean {
  if (!alert.active) return false
  return alert.direction === 'above'
    ? currentPrice >= alert.targetUsd
    : currentPrice <= alert.targetUsd
}

// ── Token Metrics ─────────────────────────────────────────────────────────────

export interface TokenMetrics {
  token:         string
  priceUsd:      number
  change24h:     number | null    // %
  change7d:      number | null    // %
  volumeUsd24h:  number | null
  marketCapUsd:  number | null
}

export async function fetchTokenMetrics(tokens: string[]): Promise<TokenMetrics[]> {
  const COINGECKO_IDS: Record<string, string> = {
    SOL: 'solana', USDC: 'usd-coin', BONK: 'bonk',
    JUP: 'jupiter-exchange-solana', RAY: 'raydium',
    ORCA: 'orca', mSOL: 'msol', WIF: 'dogwifcoin',
    PYTH: 'pyth-network', JTO: 'jito-governance-token',
  }

  const ids = tokens
    .map((t) => COINGECKO_IDS[t.toUpperCase()])
    .filter(Boolean)

  if (ids.length === 0) return []

  try {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(',')}&price_change_percentage=24h,7d&per_page=50`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []

    const data = await res.json() as any[]

    const reverseMap = Object.fromEntries(
      Object.entries(COINGECKO_IDS).map(([k, v]) => [v, k])
    )

    return data.map((coin: any): TokenMetrics => ({
      token:        reverseMap[coin.id] ?? coin.symbol.toUpperCase(),
      priceUsd:     coin.current_price ?? 0,
      change24h:    coin.price_change_percentage_24h ?? null,
      change7d:     coin.price_change_percentage_7d_in_currency ?? null,
      volumeUsd24h: coin.total_volume ?? null,
      marketCapUsd: coin.market_cap ?? null,
    }))
  } catch {
    return []
  }
}
