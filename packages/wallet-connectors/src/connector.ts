import { ChainId } from '@clutch/core'

export interface TokenBalance {
  token: string
  amount: bigint
  decimals: number
  contractAddress?: string  // undefined for native tokens
}

export interface TxRequest {
  to: string
  amount: bigint
  token: string
  chain: ChainId
  data?: string            // for smart contract calls
  gasLimit?: bigint
}

export interface TxReceipt {
  txHash: string
  blockNumber: bigint
  gasUsed: bigint
  status: 'success' | 'reverted'
}

export interface WalletConnector {
  readonly chain: ChainId
  readonly name: string

  /** Fetch native + token balances for an address (read-only, no signing) */
  getBalances(address: string): Promise<TokenBalance[]>

  /** Get native balance only */
  getNativeBalance(address: string): Promise<bigint>

  /** Estimate gas for a transaction */
  estimateGas(request: TxRequest): Promise<bigint>

  /** Check if this connector is healthy / RPC reachable */
  ping(): Promise<boolean>
}

/** Connectors that can sign — requires a private key or connected wallet */
export interface SigningConnector extends WalletConnector {
  sendTransaction(request: TxRequest, privateKey: string): Promise<TxReceipt>
  signMessage(message: string, privateKey: string): Promise<string>
}
