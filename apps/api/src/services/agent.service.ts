import { PocktAgent, ClutchToolExecutor, PocketContext, WalletContext, AgentDecision, AgentAnalysis, PaymentRequest } from '@clutch/ai-agent'
import { ConnectorRegistry } from '@clutch/wallet-connectors'
import { priceService } from './price.service.js'
import { db } from '../db/client.js'
import { pockets, wallets, walletBalances } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { weiToEth, ChainId } from '@clutch/core'

const registry = new ConnectorRegistry({
  ethRpcUrl:      process.env.ETH_RPC_URL,
  baseRpcUrl:     process.env.BASE_RPC_URL,
  polygonRpcUrl:  process.env.POLYGON_RPC_URL,
  arbitrumRpcUrl: process.env.ARBITRUM_RPC_URL,
  optimismRpcUrl: process.env.OPTIMISM_RPC_URL,
  solanaRpcUrl:   process.env.SOLANA_RPC_URL,
})

const executor = new ClutchToolExecutor({ registry, priceService })

export class AgentService {
  private agent: PocktAgent

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required for AI agent features')
    }
    this.agent = new PocktAgent(process.env.ANTHROPIC_API_KEY)
  }

  // ── Build pocket context from DB ──────────────────────────────────────────

  async buildPocketContext(pocketId: string): Promise<PocketContext> {
    const pocket = await db.query.pockets.findFirst({
      where: eq(pockets.id, pocketId),
      with: {
        wallets: {
          with: { balances: true },
        },
      },
    })

    if (!pocket) throw new Error('Pocket not found')

    const nativeEth = weiToEth(pocket.nativeBalance)
    const nativeUsd = Number(nativeEth) * (await priceService.getUsdPrice('ETH') ?? 0)

    const walletContexts: WalletContext[] = pocket.wallets.map((w) => {
      const totalUsd = w.balances.reduce((s, b) => s + parseFloat(b.usdValue ?? '0'), 0)
      return {
        wallet: {
          id:        w.id,
          pocketId:  w.pocketId,
          type:      w.type as any,
          address:   w.address,
          chain:     w.chain as ChainId,
          label:     w.label ?? undefined,
          isDefault: w.isDefault,
          addedAt:   w.addedAt,
        },
        balances: w.balances.map((b) => ({
          walletId:    w.id,
          chain:       w.chain as ChainId,
          token:       b.token,
          amount:      b.amount,
          decimals:    b.decimals,
          usdValue:    b.usdValue ? parseFloat(b.usdValue) : undefined,
          fetchedAt:   b.fetchedAt,
        })),
        totalUsdValue: totalUsd,
      }
    })

    const totalUsd = walletContexts.reduce((s, w) => s + w.totalUsdValue, 0) + nativeUsd

    return {
      pocketId:         pocket.id,
      pocketName:       pocket.name,
      nativeBalanceEth: nativeEth,
      nativeBalanceUsd: nativeUsd,
      wallets:          walletContexts,
      totalUsdValue:    totalUsd,
    }
  }

  // ── Public agent actions ──────────────────────────────────────────────────

  async analyzeP(pocketId: string): Promise<AgentAnalysis> {
    const ctx = await this.buildPocketContext(pocketId)
    return this.agent.analyzePocket(ctx)
  }

  async resolvePayment(pocketId: string, request: PaymentRequest): Promise<AgentDecision> {
    const ctx = await this.buildPocketContext(pocketId)
    return this.agent.resolvePayment(ctx, request, executor)
  }

  async *chat(
    pocketId: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): AsyncGenerator<string> {
    const ctx = await this.buildPocketContext(pocketId)
    yield* this.agent.chat(ctx, messages, executor)
  }
}

let _agentService: AgentService | null = null

export function getAgentService(): AgentService {
  if (!_agentService) _agentService = new AgentService()
  return _agentService
}
