export interface X402PaymentRequired {
  /** Amount in smallest token units */
  amount: string
  /** Token ticker: ETH, USDC, etc. */
  currency: string
  /** Recipient address */
  payTo: string
  /** Chain to pay on */
  network: string
  /** Unix timestamp — payment must be broadcast before this */
  expiresAt: number
  /** Human-readable description of what is being paid for */
  description?: string
  /** Resource being unlocked */
  resource?: string
  /** Optional payment receipt endpoint */
  receiptUrl?: string
}

export interface X402PaymentProof {
  txHash: string
  network: string
  amount: string
  currency: string
  paidAt: number
  payTo: string
}

export interface X402Receipt {
  receiptId: string
  txHash: string
  verifiedAt: number
  resource?: string
}
