import type {
  SubscriptionPlan, Subscription, TokenGate,
  GateCheckResult, BillingPeriod, UsageRecord, BillingMeter,
} from './types.js'

// ── Period math ───────────────────────────────────────────────────────────────

export function nextPeriodEnd(start: Date, period: BillingPeriod): Date {
  const d = new Date(start)
  switch (period) {
    case 'daily':   d.setDate(d.getDate() + 1);     break
    case 'weekly':  d.setDate(d.getDate() + 7);     break
    case 'monthly': d.setMonth(d.getMonth() + 1);   break
    case 'annual':  d.setFullYear(d.getFullYear() + 1); break
  }
  return d
}

export function isSubscriptionActive(sub: Subscription): boolean {
  const now = new Date()
  return (
    (sub.status === 'active' || sub.status === 'trialing') &&
    now <= sub.currentPeriodEnd
  )
}

export function isDueForRenewal(sub: Subscription, bufferMs = 3_600_000): boolean {
  const now = new Date()
  const due = new Date(sub.currentPeriodEnd.getTime() - bufferMs)
  return now >= due && sub.status === 'active' && !sub.cancelAtPeriodEnd
}

// ── x402 payment amount ───────────────────────────────────────────────────────

/**
 * Convert a USD plan price to the raw token amount for an x402 payment request.
 * USDC/USDT are pegged — compute directly.
 * SOL requires a live price feed (passed in as solPriceUsd).
 */
export function planPriceToRaw(
  priceUsd:     number,
  token:        string,
  solPriceUsd?: number,
): string {
  if (token === 'USDC' || token === 'USDT') {
    return Math.floor(priceUsd * 1_000_000).toString()    // 6 decimals
  }
  if (token === 'SOL') {
    if (!solPriceUsd) throw new Error('SOL price required to compute raw amount')
    const solAmount = priceUsd / solPriceUsd
    return Math.floor(solAmount * 1_000_000_000).toString()  // 9 decimals (lamports)
  }
  throw new Error(`Unsupported payment token: ${token}`)
}

// ── Token gate evaluation ─────────────────────────────────────────────────────

/**
 * Check if a user passes a token gate.
 * Balances are passed in — caller fetches them from the chain.
 */
export function checkGate(
  gate:      TokenGate,
  balances:  Record<string, number>,   // token symbol → human-readable amount
  nfts:      string[],                 // list of held mint addresses
  activeSubscriptionPlanIds: string[], // list of plan IDs user is subscribed to
): GateCheckResult {
  switch (gate.condition) {
    case 'min_balance': {
      const balance = balances[gate.token ?? ''] ?? 0
      const min     = parseFloat(gate.minAmount ?? '0')
      if (balance >= min) return { allowed: true, gate }
      return {
        allowed: false, gate,
        reason: `Requires at least ${min} ${gate.token} (you have ${balance.toFixed(4)})`,
      }
    }

    case 'holds_token': {
      const balance = balances[gate.token ?? ''] ?? 0
      const min     = parseFloat(gate.minAmount ?? '1')
      if (balance >= min) return { allowed: true, gate }
      return {
        allowed: false, gate,
        reason: `Requires ${min}+ ${gate.token}`,
      }
    }

    case 'holds_nft': {
      const holds = gate.collectionAddress
        ? nfts.some((mint) => mint === gate.collectionAddress)
        : nfts.length > 0
      if (holds) return { allowed: true, gate }
      return {
        allowed: false, gate,
        reason: `Requires holding an NFT from collection ${gate.collectionAddress?.slice(0,8)}...`,
      }
    }

    case 'active_subscription': {
      if (!gate.planId || activeSubscriptionPlanIds.includes(gate.planId)) {
        return { allowed: true, gate }
      }
      return {
        allowed: false, gate,
        reason: `Requires an active subscription`,
        paymentRequired: gate.planId
          ? { planId: gate.planId, priceUsd: 0, token: 'USDC' }
          : undefined,
      }
    }

    default:
      return { allowed: false, gate, reason: 'Unknown gate condition' }
  }
}

// ── Usage / metered billing ────────────────────────────────────────────────────

export function computeOverageCharge(
  usage:   UsageRecord[],
  meter:   BillingMeter,
): { units: number; overage: number; chargeUsd: number } {
  const total    = usage.reduce((s, r) => s + r.quantity, 0)
  const overage  = Math.max(0, total - meter.freeUnits)
  const chargeUsd = overage * meter.pricePerUnit
  return { units: total, overage, chargeUsd }
}
