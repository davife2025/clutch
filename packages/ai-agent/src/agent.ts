import { Pocket, PaymentIntent } from '@clutch/core'

export interface AgentDecision {
  walletId: string
  reasoning: string
  estimatedGas?: bigint
}

export class ClutchAgent {
  /**
   * Given a pocket and a payment intent, decide which wallet to pay from.
   * Uses AI to reason about balances, gas costs, chain preferences, etc.
   */
  async resolvePayment(
    pocket: Pocket,
    intent: PaymentIntent
  ): Promise<AgentDecision> {
    // TODO: call Claude API with wallet balances + intent context
    throw new Error('Not implemented')
  }

  /**
   * Proactively monitor wallets and surface insights (low balance alerts,
   * suspicious activity, rebalancing suggestions, etc.)
   */
  async analyze(pocket: Pocket): Promise<string> {
    // TODO: AI-powered pocket health analysis
    throw new Error('Not implemented')
  }
}
