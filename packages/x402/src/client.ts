import { X402PaymentRequest, X402PaymentProof } from './types'

export class X402Client {
  /**
   * Intercepts a 402 response and fulfills the payment using the best available wallet.
   */
  async handlePaymentRequired(
    paymentRequest: X402PaymentRequest
  ): Promise<X402PaymentProof> {
    // TODO: resolve best wallet via @clutch/ai-agent, sign & broadcast tx
    throw new Error('Not implemented')
  }

  /**
   * Wraps fetch() — automatically handles 402 responses.
   */
  async fetch(url: string, init?: RequestInit): Promise<Response> {
    const res = await fetch(url, init)
    if (res.status === 402) {
      const paymentRequest: X402PaymentRequest = await res.json()
      const proof = await this.handlePaymentRequired(paymentRequest)
      return fetch(url, {
        ...init,
        headers: {
          ...init?.headers,
          'X-Payment-Proof': JSON.stringify(proof),
        },
      })
    }
    return res
  }
}
