import { ChainId } from '@clutch/core'

// ── Subscription plans ────────────────────────────────────────────────────────

export type BillingPeriod = 'daily' | 'weekly' | 'monthly' | 'annual'
export type PaymentToken  = 'SOL' | 'USDC' | 'USDT'

export interface SubscriptionPlan {
  id:            string
  name:          string
  description:   string
  priceUsd:      number
  billingPeriod: BillingPeriod
  token:         PaymentToken
  /** Price in token's smallest unit */
  priceRaw:      string
  chain:         ChainId
  payTo:         string        // merchant's Solana address
  features:      string[]
  active:        boolean
}

export interface Subscription {
  id:            string
  userId:        string
  planId:        string
  plan:          SubscriptionPlan
  status:        SubscriptionStatus
  currentPeriodStart: Date
  currentPeriodEnd:   Date
  cancelAtPeriodEnd:  boolean
  /** Solana address that paid — used for on-chain verification */
  payerAddress:  string
  lastTxHash?:   string
  createdAt:     Date
  updatedAt:     Date
}

export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing' | 'expired'

// ── Token gating ──────────────────────────────────────────────────────────────

export type GateCondition = 'min_balance' | 'holds_nft' | 'holds_token' | 'active_subscription'

export interface TokenGate {
  id:         string
  name:       string
  condition:  GateCondition
  /** For min_balance / holds_token */
  token?:     string
  mintAddress?: string
  minAmount?: string    // human-readable
  /** For holds_nft */
  collectionAddress?: string
  /** For active_subscription */
  planId?:    string
}

export interface GateCheckResult {
  allowed:    boolean
  gate:       TokenGate
  reason?:    string   // why denied
  /** x402 payment request if a subscription payment can unlock access */
  paymentRequired?: {
    planId:    string
    priceUsd:  number
    token:     PaymentToken
  }
}

// ── Metered billing ───────────────────────────────────────────────────────────

export interface UsageRecord {
  subscriptionId: string
  userId:         string
  metric:         string    // 'api_calls' | 'ai_queries' | 'swaps'
  quantity:       number
  recordedAt:     Date
}

export interface BillingMeter {
  metric:       string
  pricePerUnit: number   // USD
  token:        PaymentToken
  freeUnits:    number   // included in base plan
}
