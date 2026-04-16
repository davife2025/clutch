// ─── Wallet ───────────────────────────────────────────────────────────────────

export type WalletType = 'hot' | 'cold' | 'hardware' | 'native'
export type ChainId = 'ethereum' | 'base' | 'polygon' | 'solana' | 'arbitrum' | 'optimism'

export interface Wallet {
  id: string
  pocketId: string
  type: WalletType
  address: string
  chain: ChainId
  label?: string
  isDefault: boolean
  addedAt: Date
}

export interface WalletBalance {
  walletId: string
  chain: ChainId
  token: string         // 'ETH', 'USDC', 'SOL', etc.
  amount: bigint
  decimals: number
  usdValue?: number
  fetchedAt: Date
}

// ─── Pocket ────────────────────────────────────────────────────────────────────

export interface Pocket {
  id: string
  ownerId: string
  name: string
  wallets: Wallet[]
  nativeBalance: bigint  // stored in wei (18 decimals)
  createdAt: Date
  updatedAt: Date
}

export interface PocketSummary {
  pocket: Pocket
  totalUsdValue: number
  balances: WalletBalance[]
}

// ─── User ──────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  passwordHash: string
  createdAt: Date
  updatedAt: Date
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export type TxStatus = 'pending' | 'confirmed' | 'failed'
export type TxType = 'deposit' | 'withdraw' | 'payment' | 'transfer'

export interface Transaction {
  id: string
  pocketId: string
  walletId?: string
  type: TxType
  status: TxStatus
  fromAddress: string
  toAddress: string
  amount: bigint
  token: string
  chain: ChainId
  txHash?: string
  memo?: string
  createdAt: Date
  confirmedAt?: Date
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export interface PaymentIntent {
  to: string
  amount: bigint
  token: string
  chain: ChainId
  fromWalletId?: string   // if omitted, AI agent decides
  memo?: string
  x402?: boolean          // whether this is an x402 auto-payment
}

export interface PaymentResult {
  txHash: string
  walletId: string
  chain: ChainId
  paidAt: Date
  fee?: bigint
}

// ─── API responses ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  error?: never
}

export interface ApiError {
  data?: never
  error: {
    code: string
    message: string
  }
}

export type ApiResult<T> = ApiResponse<T> | ApiError
