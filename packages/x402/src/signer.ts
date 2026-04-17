import type { X402PaymentRequired, X402PaymentProof } from './types.js'
import type { PaymentSigner } from './client.js'

export interface AgentSignerOptions {
  /** Clutch API base URL */
  apiUrl: string
  /** Auth token */
  token: string
  /** Which pocket to pay from */
  pocketId: string
}

/**
 * Creates a PaymentSigner that delegates to Clutch's AI agent.
 * The agent selects the best wallet + chain + token, then broadcasts.
 *
 * Flow:
 *   1. POST /agent/resolve-payment  → agent picks wallet
 *   2. POST /pockets/:id/pay        → API broadcasts tx
 *   3. Returns proof
 */
export function createAgentSigner(options: AgentSignerOptions): PaymentSigner {
  return async (req: X402PaymentRequired): Promise<X402PaymentProof> => {
    const { apiUrl, token, pocketId } = options

    // Step 1: resolve which wallet to use
    const resolveRes = await fetch(`${apiUrl}/agent/resolve-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        pocketId,
        to:     req.payTo,
        amount: req.amount,
        token:  req.currency,
        chain:  req.network,
        memo:   req.description,
      }),
    })

    if (!resolveRes.ok) {
      const err = await resolveRes.json()
      throw new Error(`Agent failed to resolve payment: ${err.error?.message}`)
    }

    const { data: { decision } } = await resolveRes.json()

    // Step 2: execute the payment
    const payRes = await fetch(`${apiUrl}/pockets/${pocketId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        walletId: decision.walletId,
        to:       req.payTo,
        amount:   req.amount,
        token:    decision.token,
        chain:    decision.chain,
        memo:     req.description,
      }),
    })

    if (!payRes.ok) {
      const err = await payRes.json()
      throw new Error(`Payment execution failed: ${err.error?.message}`)
    }

    const { data: { txHash, paidAt } } = await payRes.json()

    return {
      txHash,
      network:  decision.chain,
      amount:   req.amount,
      currency: decision.token,
      paidAt:   Math.floor(paidAt / 1000),
      payTo:    req.payTo,
    }
  }
}
