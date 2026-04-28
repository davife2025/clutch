import Anthropic from '@anthropic-ai/sdk'
import type {
  PocketContext, AgentDecision, AgentAnalysis,
  AgentInsight, PaymentRequest,
} from './types.js'
import { AGENT_TOOLS } from './tools.js'
import { ChainId } from '@clutch/core'

const MODEL = 'claude-opus-4-5'
const MAX_TOOL_ROUNDS = 6

export class PocktAgent {
  private client: Anthropic

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY })
  }

  // ── Payment routing ────────────────────────────────────────────────────────

  async resolvePayment(
    context: PocketContext,
    request: PaymentRequest,
    toolExecutor: ToolExecutor,
  ): Promise<AgentDecision> {
    const messages: Anthropic.Messages.MessageParam[] = [
      { role: 'user', content: buildPaymentUserMessage(request) },
    ]

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: buildPaymentSystemPrompt(context),
        tools: AGENT_TOOLS as any,
        messages,
      })

      messages.push({ role: 'assistant', content: response.content })

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []
      let selectedDecision: AgentDecision | null = null

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue

        if (block.name === 'select_payment_wallet') {
          const input = block.input as any
          selectedDecision = {
            walletId:        input.walletId,
            chain:           input.chain as ChainId,
            token:           input.token,
            reasoning:       input.reasoning,
            confidence:      input.confidence,
            estimatedGasFee: input.estimatedGasFee,
          }
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ confirmed: true }) })
        } else {
          const result = await toolExecutor.execute(block.name, block.input as Record<string, string>)
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
        }
      }

      messages.push({ role: 'user', content: toolResults })
      if (selectedDecision) return selectedDecision
    }

    throw new Error('Agent exceeded max tool rounds without selecting a wallet')
  }

  // ── Analysis ───────────────────────────────────────────────────────────────

  async analyzePocket(context: PocketContext): Promise<AgentAnalysis> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: `You are Clutch's AI portfolio analyst. Clutch is a Solana-first wallet pocket.
Analyse the user's Solana and multi-chain wallet portfolio and return ONLY valid JSON — no markdown, no preamble.`,
      messages: [{ role: 'user', content: buildAnalysisPrompt(context) }],
    })

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.Messages.TextBlock).text)
      .join('')

    try {
      return JSON.parse(text.trim()) as AgentAnalysis
    } catch {
      return { summary: text.slice(0, 200), insights: [], totalUsdValue: context.totalUsdValue, healthScore: 50, suggestedActions: [] }
    }
  }

  // ── Chat ───────────────────────────────────────────────────────────────────

  async *chat(
    context: PocketContext,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    toolExecutor: ToolExecutor,
  ): AsyncGenerator<string> {
    const stream = this.client.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system: buildChatSystemPrompt(context),
      tools: AGENT_TOOLS as any,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text
      }
    }
  }
}

export interface ToolExecutor {
  execute(toolName: string, input: Record<string, string>): Promise<unknown>
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildPaymentSystemPrompt(ctx: PocketContext): string {
  const walletSummary = ctx.wallets.map((w) => {
    const bals = w.balances.map((b) =>
      `    ${b.token}: ${(Number(b.amount) / 10 ** b.decimals).toFixed(6)} (~$${b.usdValue ?? '?'})`
    ).join('\n')
    return `  Wallet ${w.wallet.id} [${w.wallet.chain}] ${w.wallet.label ?? w.wallet.address.slice(0, 8)}...
    Type: ${w.wallet.type}${w.wallet.isDefault ? ' (default)' : ''}
${bals || '    (no balances cached)'}`
  }).join('\n\n')

  return `You are Clutch's AI payment router for a Solana-first wallet pocket.

POCKET: "${ctx.pocketName}"
Native SOL balance (in pocket): ${ctx.nativeBalanceEth} SOL (~$${ctx.nativeBalanceUsd.toFixed(2)})
Total portfolio value: $${ctx.totalUsdValue.toFixed(2)}

WALLETS:
${walletSummary}

YOUR JOB:
1. Understand the payment request
2. Use tools to check balances and estimate fees when needed
3. Select the optimal wallet:
   - Prefer Solana wallets — lower fees, faster finality
   - Prefer USDC on Solana for USD-denominated payments
   - Prefer native SOL for SOL payments
   - Fall back to EVM chains only if no Solana option has sufficient balance
   - Prefer the default wallet when it has enough funds
4. Call select_payment_wallet with your final decision

Be decisive. Explain your chain/token choice clearly.`
}

function buildPaymentUserMessage(req: PaymentRequest): string {
  return `Pay ${req.amount} ${req.token} to ${req.to}${req.chain ? ` on ${req.chain}` : ' (pick best chain — prefer Solana)'}${req.memo ? `\nMemo: ${req.memo}` : ''}`
}

function buildAnalysisPrompt(ctx: PocketContext): string {
  const walletDetails = ctx.wallets.map((w) => ({
    id:       w.wallet.id,
    chain:    w.wallet.chain,
    type:     w.wallet.type,
    label:    w.wallet.label,
    balances: w.balances.map((b) => ({
      token:    b.token,
      amount:   (Number(b.amount) / 10 ** b.decimals).toFixed(6),
      usdValue: b.usdValue,
    })),
    totalUsd: w.totalUsdValue,
  }))

  return `Analyse this Clutch pocket (Solana-first) and return JSON:
{
  "summary": "2-3 sentence overview focusing on Solana holdings",
  "insights": [
    { "type": "low_balance|diversification|gas_optimization|rebalance|info", "severity": "info|warning|critical", "title": "...", "message": "...", "walletId": "optional", "chain": "optional" }
  ],
  "totalUsdValue": ${ctx.totalUsdValue},
  "healthScore": 0-100,
  "suggestedActions": ["..."]
}

POCKET: ${JSON.stringify({ name: ctx.pocketName, totalUsd: ctx.totalUsdValue, nativeSol: ctx.nativeBalanceEth, wallets: walletDetails }, null, 2)}`
}

function buildChatSystemPrompt(ctx: PocketContext): string {
  const solanaWallets = ctx.wallets.filter((w) => w.wallet.chain === 'solana')
  return `You are Clutch's AI assistant — a Solana-first wallet agent.

POCKET: "${ctx.pocketName}"
Total value: $${ctx.totalUsdValue.toFixed(2)}
Solana wallets: ${solanaWallets.length} · Other chains: ${ctx.wallets.length - solanaWallets.length}
Native SOL in pocket: ${ctx.nativeBalanceEth} SOL

You specialise in Solana — SPL tokens, Solana DeFi, transaction fees in lamports, and the Solana ecosystem.
Use tools when you need live data. Be concise and practical.`
}
