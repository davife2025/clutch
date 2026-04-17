import type { ToolExecutor } from './agent.js'
import { ConnectorRegistry } from '@clutch/wallet-connectors'
import { ChainId, CHAIN_NATIVE_TOKEN } from '@clutch/core'

interface ExecutorConfig {
  registry: ConnectorRegistry
  priceService: {
    getUsdPrice(token: string): Promise<number | null>
    getBatchPrices(tokens: string[]): Promise<Record<string, number>>
  }
}

export class ClutchToolExecutor implements ToolExecutor {
  constructor(private config: ExecutorConfig) {}

  async execute(toolName: string, input: Record<string, string>): Promise<unknown> {
    switch (toolName) {
      case 'get_wallet_balance':
        return this.getWalletBalance(input)
      case 'estimate_gas_fee':
        return this.estimateGasFee(input)
      case 'get_token_price':
        return this.getTokenPrice(input)
      default:
        return { error: `Unknown tool: ${toolName}` }
    }
  }

  private async getWalletBalance(input: Record<string, string>) {
    const { address, chain } = input
    try {
      const connector = this.config.registry.get(chain as ChainId)
      if (!connector) return { error: `No connector for chain: ${chain}` }

      const balances = await connector.getBalances(address)
      const tokens   = balances.map((b) => b.token)
      const prices   = await this.config.priceService.getBatchPrices(tokens)

      return {
        address,
        chain,
        balances: balances.map((b) => ({
          token:      b.token,
          amount:     (Number(b.amount) / 10 ** b.decimals).toFixed(6),
          decimals:   b.decimals,
          usdValue:   prices[b.token.toUpperCase()]
            ? ((Number(b.amount) / 10 ** b.decimals) * prices[b.token.toUpperCase()]).toFixed(2)
            : null,
        })),
      }
    } catch (err) {
      return { error: String(err) }
    }
  }

  private async estimateGasFee(input: Record<string, string>) {
    const { chain, token, amount, toAddress } = input
    try {
      const connector = this.config.registry.get(chain as ChainId)
      if (!connector) return { error: `No connector for chain: ${chain}` }

      const decimals  = token === 'SOL' ? 9 : 18
      const amountWei = BigInt(Math.floor(Number(amount) * 10 ** decimals))

      const gasUnits = await connector.estimateGas({
        to: toAddress,
        amount: amountWei,
        token,
        chain: chain as ChainId,
      })

      // Get ETH price for USD conversion
      const nativeToken = CHAIN_NATIVE_TOKEN[chain as ChainId] ?? 'ETH'
      const nativePrice = await this.config.priceService.getUsdPrice(nativeToken)
      const gasEth      = Number(gasUnits) / 1e18
      const gasUsd      = nativePrice ? gasEth * nativePrice : null

      return {
        chain,
        gasUnits:    gasUnits.toString(),
        gasEth:      gasEth.toFixed(8),
        gasUsd:      gasUsd?.toFixed(4) ?? 'unknown',
        nativeToken,
      }
    } catch (err) {
      return { error: String(err) }
    }
  }

  private async getTokenPrice(input: Record<string, string>) {
    const { token } = input
    const price = await this.config.priceService.getUsdPrice(token)
    return { token, usdPrice: price ?? 'unavailable' }
  }
}
