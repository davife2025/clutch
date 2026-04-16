export interface X402PaymentRequest {
  amount: string
  currency: string
  payTo: string
  network: string
  expiresAt: number
  description?: string
}

export interface X402PaymentProof {
  txHash: string
  network: string
  paidAt: number
}
