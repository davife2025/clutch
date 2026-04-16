import { ChainId } from '@clutch/core'
import { EVMConnector } from './providers/evm.js'
import { SolanaConnector } from './providers/solana.js'
import type { WalletConnector } from './connector.js'

export interface RegistryConfig {
  ethRpcUrl?: string
  baseRpcUrl?: string
  polygonRpcUrl?: string
  arbitrumRpcUrl?: string
  optimismRpcUrl?: string
  solanaRpcUrl?: string
}

const DEFAULT_RPCS: Record<string, string> = {
  ethereum: 'https://eth.llamarpc.com',
  base: 'https://mainnet.base.org',
  polygon: 'https://polygon-rpc.com',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  optimism: 'https://mainnet.optimism.io',
  solana: 'https://api.mainnet-beta.solana.com',
}

export class ConnectorRegistry {
  private connectors = new Map<ChainId, WalletConnector>()

  constructor(config: RegistryConfig = {}) {
    const rpcs: Partial<Record<ChainId, string>> = {
      ethereum:  config.ethRpcUrl       ?? DEFAULT_RPCS.ethereum,
      base:      config.baseRpcUrl      ?? DEFAULT_RPCS.base,
      polygon:   config.polygonRpcUrl   ?? DEFAULT_RPCS.polygon,
      arbitrum:  config.arbitrumRpcUrl  ?? DEFAULT_RPCS.arbitrum,
      optimism:  config.optimismRpcUrl  ?? DEFAULT_RPCS.optimism,
      solana:    config.solanaRpcUrl    ?? DEFAULT_RPCS.solana,
    }

    // Register EVM chains
    for (const chain of ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism'] as ChainId[]) {
      if (rpcs[chain]) {
        this.connectors.set(chain, new EVMConnector(chain, rpcs[chain]!))
      }
    }

    // Register Solana
    if (rpcs.solana) {
      this.connectors.set('solana', new SolanaConnector(rpcs.solana))
    }
  }

  get(chain: ChainId): WalletConnector | undefined {
    return this.connectors.get(chain)
  }

  getOrThrow(chain: ChainId): WalletConnector {
    const connector = this.connectors.get(chain)
    if (!connector) throw new Error(`No connector registered for chain: ${chain}`)
    return connector
  }

  all(): WalletConnector[] {
    return [...this.connectors.values()]
  }

  async pingAll(): Promise<Record<ChainId, boolean>> {
    const results: Partial<Record<ChainId, boolean>> = {}
    await Promise.allSettled(
      [...this.connectors.entries()].map(async ([chain, connector]) => {
        results[chain] = await connector.ping()
      })
    )
    return results as Record<ChainId, boolean>
  }
}
