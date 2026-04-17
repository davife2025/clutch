import type { X402PaymentRequired, X402PaymentProof, X402Receipt } from './types.js'

export type PaymentSigner = (request: X402PaymentRequired) => Promise<X402PaymentProof>

export interface X402ClientOptions {
  /** Called when a 402 is encountered — must sign and broadcast the payment */
  signer: PaymentSigner
  /** Max USD value auto-approved without user confirmation (default: 1.00) */
  autoApproveUnderUsd?: number
  /** Called before each payment for user confirmation — return false to cancel */
  onPaymentRequired?: (request: X402PaymentRequired) => Promise<boolean>
  /** Called after successful payment */
  onPaymentSuccess?: (proof: X402PaymentProof) => void
  /** Called on payment failure */
  onPaymentError?: (err: Error) => void
}

const X402_PROOF_HEADER = 'X-Payment-Proof'
const X402_MAX_RETRIES  = 1

/**
 * x402-aware fetch wrapper.
 * Intercepts HTTP 402 responses, fulfils the payment, and retries the request.
 *
 * Usage:
 *   const client = new X402Client({ signer: agentSigner })
 *   const res = await client.fetch('https://api.example.com/premium-data')
 */
export class X402Client {
  constructor(private options: X402ClientOptions) {}

  async fetch(url: string, init: RequestInit = {}): Promise<Response> {
    let lastProof: X402PaymentProof | null = null

    for (let attempt = 0; attempt <= X402_MAX_RETRIES; attempt++) {
      const headers = new Headers(init.headers ?? {})
      if (lastProof) {
        headers.set(X402_PROOF_HEADER, JSON.stringify(lastProof))
      }

      const res = await fetch(url, { ...init, headers })

      if (res.status !== 402) return res

      // Parse payment requirements from body
      let paymentReq: X402PaymentRequired
      try {
        paymentReq = await res.clone().json()
      } catch {
        throw new Error('Server returned 402 with invalid payment request body')
      }

      // Validate not expired
      if (Date.now() / 1000 > paymentReq.expiresAt) {
        throw new Error('Payment request expired')
      }

      // Check auto-approve limit
      const needsConfirmation =
        this.options.onPaymentRequired &&
        !(this.options.autoApproveUnderUsd && this.isUnderLimit(paymentReq))

      if (needsConfirmation) {
        const approved = await this.options.onPaymentRequired!(paymentReq)
        if (!approved) throw new Error('Payment cancelled by user')
      }

      // Sign and broadcast
      try {
        lastProof = await this.options.signer(paymentReq)
        this.options.onPaymentSuccess?.(lastProof)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        this.options.onPaymentError?.(error)
        throw error
      }
    }

    throw new Error('x402: exceeded max retries')
  }

  private isUnderLimit(req: X402PaymentRequired): boolean {
    const limit = this.options.autoApproveUnderUsd ?? 1.0
    // Rough check — actual USD conversion happens in the signer
    if (req.currency === 'USDC' || req.currency === 'USDT' || req.currency === 'DAI') {
      return Number(req.amount) / 1e6 <= limit
    }
    return false
  }
}
