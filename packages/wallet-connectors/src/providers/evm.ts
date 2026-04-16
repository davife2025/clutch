import { WalletConnector } from '../connector'
import { Wallet } from '@clutch/core'

export class EVMConnector implements WalletConnector {
  name = 'evm'

  async connect(): Promise<Wallet> {
    // TODO: integrate with wagmi / viem
    throw new Error('Not implemented')
  }

  async disconnect(): Promise<void> {}

  async getBalance(address: string): Promise<bigint> {
    // TODO: fetch on-chain balance
    return BigInt(0)
  }

  async signMessage(message: string): Promise<string> {
    throw new Error('Not implemented')
  }
}
