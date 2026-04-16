import { WalletConnector } from '../connector'
import { Wallet } from '@clutch/core'

export class SolanaConnector implements WalletConnector {
  name = 'solana'

  async connect(): Promise<Wallet> {
    // TODO: integrate with @solana/wallet-adapter
    throw new Error('Not implemented')
  }

  async disconnect(): Promise<void> {}

  async getBalance(address: string): Promise<bigint> {
    return BigInt(0)
  }

  async signMessage(message: string): Promise<string> {
    throw new Error('Not implemented')
  }
}
