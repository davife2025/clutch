import { ChainId, Wallet, WalletBalance } from '@clutch/core'

export interface WalletContext {
  wallet: Wallet
  balances: WalletBalance[]
  totalUsdValue: number
}

export interface PocketContext {
  pocketId: string
  pocketName: string
  nativeBalanceEth: string
  nativeBalanceUsd: number
  wallets: WalletContext[]
  totalUsdValue: number
}

export interface AgentDecision {
  walletId: string
  chain: ChainId
  token: string
  reasoning: string
  estimatedGasFee?: string
  confidence: 'high' | 'medium' | 'low'
}

export interface AgentInsight {
  type: 'low_balance' | 'diversification' | 'gas_optimization' | 'rebalance' | 'info'
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  walletId?: string
  chain?: ChainId
}

export interface AgentAnalysis {
  summary: string
  insights: AgentInsight[]
  totalUsdValue: number
  healthScore: number   // 0–100
  suggestedActions: string[]
}

export interface PaymentRequest {
  to: string
  amount: string        // human-readable, e.g. "0.01"
  token: string         // "ETH", "USDC", etc.
  chain?: ChainId       // if omitted, agent picks best chain
  memo?: string
}

export interface AgentTool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required: string[]
  }
}
