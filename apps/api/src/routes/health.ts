import { Hono } from 'hono'
import { ConnectorRegistry } from '@clutch/wallet-connectors'

export const healthRoutes = new Hono()

healthRoutes.get('/chains', async (c) => {
  const registry = new ConnectorRegistry({
    ethRpcUrl:      process.env.ETH_RPC_URL,
    baseRpcUrl:     process.env.BASE_RPC_URL,
    polygonRpcUrl:  process.env.POLYGON_RPC_URL,
    arbitrumRpcUrl: process.env.ARBITRUM_RPC_URL,
    optimismRpcUrl: process.env.OPTIMISM_RPC_URL,
    solanaRpcUrl:   process.env.SOLANA_RPC_URL,
  })

  const results = await registry.pingAll()

  return c.json({
    data: {
      chains: results,
      healthy: Object.values(results).filter(Boolean).length,
      total: Object.keys(results).length,
    }
  })
})
