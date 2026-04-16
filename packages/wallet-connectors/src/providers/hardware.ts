/**
 * Hardware wallet connector stub.
 * Full Ledger + Trezor integration coming in Session 8.
 * This exposes the interface so the rest of the system can reference it today.
 */
import type { WalletConnector, TokenBalance, TxRequest } from '../connector.js'
import { ChainId } from '@clutch/core'

export type HardwareWalletType = 'ledger' | 'trezor'

export class HardwareWalletConnector implements WalletConnector {
  readonly chain: ChainId
  readonly name: string
  private hwType: HardwareWalletType

  constructor(chain: ChainId, hwType: HardwareWalletType) {
    this.chain = chain
    this.hwType = hwType
    this.name = `HW:${hwType}:${chain}`
  }

  async ping(): Promise<boolean> {
    // Will attempt USB/BT device detection in Session 8
    return false
  }

  async getNativeBalance(_address: string): Promise<bigint> {
    throw new Error(`Hardware wallet balance reading coming in Session 8`)
  }

  async getBalances(_address: string): Promise<TokenBalance[]> {
    throw new Error(`Hardware wallet balance reading coming in Session 8`)
  }

  async estimateGas(_request: TxRequest): Promise<bigint> {
    throw new Error(`Hardware wallet tx support coming in Session 8`)
  }
}
