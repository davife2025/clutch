import type { X402PaymentRequired } from './types.js'

export interface PaywallConfig {
  amount: string
  currency: string
  payTo: string
  network: string
  description?: string
  ttlSeconds?: number
}

/**
 * Creates a 402 response body for a paywalled endpoint.
 * Drop this into any HTTP framework's middleware.
 *
 * Example (Hono):
 *   app.use('/premium/*', async (c, next) => {
 *     const proof = c.req.header('X-Payment-Proof')
 *     if (!proof || !(await verifyProof(JSON.parse(proof)))) {
 *       return c.json(createPaymentRequired({ amount: '1000000', currency: 'USDC', payTo: '0x...', network: 'base' }), 402)
 *     }
 *     await next()
 *   })
 */
export function createPaymentRequired(config: PaywallConfig): X402PaymentRequired {
  return {
    amount:      config.amount,
    currency:    config.currency,
    payTo:       config.payTo,
    network:     config.network,
    description: config.description,
    expiresAt:   Math.floor(Date.now() / 1000) + (config.ttlSeconds ?? 300),
  }
}

/**
 * Verify a payment proof (stub — real implementation checks on-chain receipt).
 */
export async function verifyProof(
  proof: { txHash: string; network: string; amount: string; paidAt: number },
  config: PaywallConfig,
): Promise<boolean> {
  if (!proof.txHash || !proof.network || !proof.amount) return false
  if (proof.network !== config.network) return false
  // TODO: verify txHash on-chain and confirm payTo + amount match
  return true
}
