import { Wallet } from '@clutch/core'

export interface WalletConnector {
  name: string
  connect(): Promise<Wallet>
  disconnect(): Promise<void>
  getBalance(address: string): Promise<bigint>
  signMessage(message: string): Promise<string>
}
