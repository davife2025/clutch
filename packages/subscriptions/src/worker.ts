/**
 * Subscription renewal worker.
 * Runs on a cron schedule (every hour in production).
 * Finds subscriptions due for renewal and charges them via x402.
 */

import type { Subscription, SubscriptionPlan } from './types.js'
import { isDueForRenewal, nextPeriodEnd, planPriceToRaw } from './engine.js'
import type { X402PaymentRequired } from '@clutch/x402'

export type RenewalResult =
  | { status: 'renewed'; subscription: Subscription; txHash: string }
  | { status: 'skipped'; reason: string }
  | { status: 'failed';  error: string }

export interface RenewalWorkerConfig {
  /** Fetch subscriptions due for renewal */
  getDueSubscriptions: () => Promise<Subscription[]>
  /** Get current SOL price in USD */
  getSolPrice: () => Promise<number>
  /** Build an x402 payment request for a plan */
  buildPaymentRequest: (plan: SubscriptionPlan, priceRaw: string) => X402PaymentRequired
  /** Execute the payment — returns txHash */
  chargeSubscription: (sub: Subscription, paymentRequest: X402PaymentRequired) => Promise<string>
  /** Persist the renewed subscription */
  updateSubscription: (sub: Subscription) => Promise<void>
  /** Notify user of renewal */
  notifyUser: (userId: string, title: string, body: string) => Promise<void>
}

export async function runRenewalCycle(config: RenewalWorkerConfig): Promise<RenewalResult[]> {
  const due     = await config.getDueSubscriptions()
  const results: RenewalResult[] = []

  for (const sub of due) {
    try {
      // Build payment amount
      const solPrice = sub.plan.token === 'SOL' ? await config.getSolPrice() : undefined
      const priceRaw = planPriceToRaw(sub.plan.priceUsd, sub.plan.token, solPrice)

      const paymentRequest = config.buildPaymentRequest(sub.plan, priceRaw)
      const txHash         = await config.chargeSubscription(sub, paymentRequest)

      // Advance the billing period
      const now = new Date()
      const updated: Subscription = {
        ...sub,
        status:              'active',
        currentPeriodStart:  now,
        currentPeriodEnd:    nextPeriodEnd(now, sub.plan.billingPeriod),
        lastTxHash:          txHash,
        updatedAt:           now,
      }

      await config.updateSubscription(updated)

      await config.notifyUser(
        sub.userId,
        'Subscription renewed',
        `Your ${sub.plan.name} subscription has been renewed — ${priceRaw} ${sub.plan.token}`,
      )

      results.push({ status: 'renewed', subscription: updated, txHash })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      results.push({ status: 'failed', error })

      // Mark past_due after failure
      await config.updateSubscription({ ...sub, status: 'past_due', updatedAt: new Date() })
        .catch(() => {})
    }
  }

  return results
}
