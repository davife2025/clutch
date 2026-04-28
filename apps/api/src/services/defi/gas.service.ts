/**
 * Gas / Fee Tracker
 * Solana: fee in lamports (very cheap — typically 5000 lamports = 0.000005 SOL)
 * EVM: gas price in gwei
 */

import { Connection } from '@solana/web3.js'
import { ChainId, CHAIN_NATIVE_TOKEN } from '@clutch/core'

export interface FeeEstimate {
  chain:         ChainId
  nativeToken:   string
  feeNative:     string       // in native token units
  feeUsd?:       string
  speed:         'slow' | 'normal' | 'fast'
  estimatedTime: string       // human readable
}

export interface SolanaFeeStats {
  minFee:    number    // lamports
  medianFee: number
  maxFee:    number
  unit:      'lamports'
}

export class GasTrackerService {
  private solanaConnection: Connection

  constructor(solanaRpcUrl: string) {
    this.solanaConnection = new Connection(solanaRpcUrl, 'confirmed')
  }

  async getSolanaFeeStats(): Promise<SolanaFeeStats> {
    try {
      const { feeCalculator } = await this.solanaConnection.getRecentBlockhash()
      const baseFee = feeCalculator?.lamportsPerSignature ?? 5000

      return {
        minFee:    baseFee,
        medianFee: baseFee,       // Solana fees are deterministic
        maxFee:    baseFee * 10,  // with priority fee
        unit:      'lamports',
      }
    } catch {
      // Fallback to known typical values
      return { minFee: 5000, medianFee: 5000, maxFee: 50000, unit: 'lamports' }
    }
  }

  async getEVMGasPrice(chain: ChainId): Promise<{ gwei: number; slow: number; fast: number }> {
    const RPC_URLS: Partial<Record<ChainId, string>> = {
      ethereum: process.env.ETH_RPC_URL ?? 'https://eth.llamarpc.com',
      base:     process.env.BASE_RPC_URL ?? 'https://mainnet.base.org',
      polygon:  process.env.POLYGON_RPC_URL ?? 'https://polygon-rpc.com',
      arbitrum: process.env.ARBITRUM_RPC_URL ?? 'https://arb1.arbitrum.io/rpc',
      optimism: process.env.OPTIMISM_RPC_URL ?? 'https://mainnet.optimism.io',
    }

    const rpc = RPC_URLS[chain]
    if (!rpc) throw new Error(`No RPC for chain: ${chain}`)

    try {
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_gasPrice', params: [], id: 1 }),
        signal: AbortSignal.timeout(5000),
      })
      const data  = await res.json()
      const gwei  = parseInt(data.result, 16) / 1e9
      return { gwei, slow: gwei * 0.9, fast: gwei * 1.2 }
    } catch {
      const defaults: Partial<Record<ChainId, number>> = {
        ethereum: 20, base: 0.1, polygon: 100, arbitrum: 0.1, optimism: 0.1,
      }
      const gwei = defaults[chain] ?? 1
      return { gwei, slow: gwei * 0.9, fast: gwei * 1.2 }
    }
  }

  async getAllFees(solPrice: number): Promise<FeeEstimate[]> {
    const [solFees, baseFees] = await Promise.allSettled([
      this.getSolanaFeeStats(),
      this.getEVMGasPrice('base'),
    ])

    const estimates: FeeEstimate[] = []

    // Solana — the cheapest
    if (solFees.status === 'fulfilled') {
      const feeSol = solFees.value.medianFee / 1e9
      estimates.push({
        chain:         'solana',
        nativeToken:   'SOL',
        feeNative:     feeSol.toFixed(8),
        feeUsd:        (feeSol * solPrice).toFixed(6),
        speed:         'normal',
        estimatedTime: '~400ms',
      })
    }

    // Base — cheapest EVM
    if (baseFees.status === 'fulfilled') {
      const gasUsed = 21000
      const feeEth  = (baseFees.value.gwei * gasUsed) / 1e9
      estimates.push({
        chain:         'base',
        nativeToken:   'ETH',
        feeNative:     feeEth.toFixed(8),
        feeUsd:        (feeEth * 2500).toFixed(4),  // rough ETH price
        speed:         'normal',
        estimatedTime: '~2s',
      })
    }

    return estimates
  }
}
