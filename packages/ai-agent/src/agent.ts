import Anthropic from '@anthropic-ai/sdk'
import type {
  PocketContext, AgentDecision, AgentAnalysis,
  AgentInsight, PaymentRequest, WalletContext,
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

  /**
   * Given a pocket and a payment request, use Claude to decide which
   * wallet, chain, and token to use. Runs a full tool-use loop.
   */
  async resolvePayment(
    context: PocketContext,
    request: PaymentRequest,
    toolExecutor: ToolExecutor,
  ): Promise<AgentDecision> {
    const systemPrompt = buildPaymentSystemPrompt(context)
    const userMessage  = buildPaymentUserMessage(request)

    const messages: Anthropic.Messages.MessageParam[] = [
      { role: 'user', content: userMessage },
    ]

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        tools: AGENT_TOOLS as any,
        messages,
      })

      // Append assistant response
      messages.push({ role: 'assistant', content: response.content })

      // If no tool use, agent is done
      if (response.stop_reason === 'end_turn') {
        throw new Error('Agent ended without calling select_payment_wallet')
      }

      // Process tool calls
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []
      let selectedDecision: AgentDecision | null = null

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue

        if (block.name === 'select_payment_wallet') {
          // Final decision — extract and return
          const input = block.input as any
          selectedDecision = {
            walletId:         input.walletId,
            chain:            input.chain as ChainId,
            token:            input.token,
            reasoning:        input.reasoning,
            confidence:       input.confidence,
            estimatedGasFee:  input.estimatedGasFee,
          }
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify({ confirmed: true }),
          })
        } else {
          // Execute the tool and return result
          const result = await toolExecutor.execute(block.name, block.input as Record<string, string>)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          })
        }
      }

      // Append tool results
      messages.push({ role: 'user', content: toolResults })

      if (selectedDecision) return selectedDecision
    }

    throw new Error('Agent exceeded max tool rounds without selecting a wallet')
  }

  // ── Pocket analysis ────────────────────────────────────────────────────────

  /**
   * Analyse a pocket and return structured insights + health score.
   * Uses a single Claude call with a structured JSON response.
   */
  async analyzePocket(context: PocketContext): Promise<AgentAnalysis> {
    const prompt = buildAnalysisPrompt(context)

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: `You are Clutch's AI financial analyst. You analyse crypto wallet portfolios and provide actionable insights.
Always respond with valid JSON matching the AgentAnalysis schema exactly. No markdown, no explanation outside JSON.`,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.Messages.TextBlock).text)
      .join('')

    try {
      const parsed = JSON.parse(text.trim())
      return parsed as AgentAnalysis
    } catch {
      // Fallback if JSON parsing fails
      return {
        summary: text.slice(0, 200),
        insights: [],
        totalUsdValue: context.totalUsdValue,
        healthScore: 50,
        suggestedActions: [],
      }
    }
  }

  // ── Chat ───────────────────────────────────────────────────────────────────

  /**
   * Free-form chat with awareness of the user's pocket context.
   * Streams the response.
   */
  async *chat(
    context: PocketContext,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    toolExecutor: ToolExecutor,
  ): AsyncGenerator<string> {
    const system = buildChatSystemPrompt(context)

    const anthropicMessages: Anthropic.Messages.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const stream = this.client.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system,
      tools: AGENT_TOOLS as any,
      messages: anthropicMessages,
    })

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text
      }
    }
  }
}

// ── Tool executor interface ───────────────────────────────────────────────────

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

  return `You are Clutch's AI payment router — a smart financial agent that decides which wallet to use for a crypto payment.

POCKET: "${ctx.pocketName}" (total value: $${ctx.totalUsdValue.toFixed(2)})
Native ETH balance in pocket: ${ctx.nativeBalanceEth} ETH (~$${ctx.nativeBalanceUsd.toFixed(2)})

WALLETS:
${walletSummary}

YOUR JOB:
1. Understand the payment request
2. Use tools to check balances and estimate gas if needed
3. Select the optimal wallet that:
   - Has sufficient balance for the payment + gas
   - Minimises gas fees (prefer L2s like Base, Arbitrum, Optimism over mainnet)
   - Uses stablecoins (USDC/USDT) for USD-denominated payments when available
   - Prefers the default wallet if it has sufficient funds
4. Call select_payment_wallet with your decision

Be decisive. Don't ask for clarification. If multiple wallets work, pick the cheapest option.`
}

function buildPaymentUserMessage(req: PaymentRequest): string {
  return `Pay ${req.amount} ${req.token} to ${req.to}${req.chain ? ` on ${req.chain}` : ' (you pick the best chain)'}${req.memo ? `\nMemo: ${req.memo}` : ''}`
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

  return `Analyse this Clutch pocket and return a JSON object with this exact structure:
{
  "summary": "2-3 sentence overview of the portfolio",
  "insights": [
    {
      "type": "low_balance|diversification|gas_optimization|rebalance|info",
      "severity": "info|warning|critical",
      "title": "Short title",
      "message": "Detailed actionable message",
      "walletId": "optional wallet id if insight is about a specific wallet",
      "chain": "optional chain id"
    }
  ],
  "totalUsdValue": ${ctx.totalUsdValue},
  "healthScore": 0-100,
  "suggestedActions": ["action 1", "action 2"]
}

POCKET DATA:
${JSON.stringify({ name: ctx.pocketName, totalUsd: ctx.totalUsdValue, nativeEth: ctx.nativeBalanceEth, wallets: walletDetails }, null, 2)}`
}

function buildChatSystemPrompt(ctx: PocketContext): string {
  return `You are Clutch's AI assistant — a knowledgeable crypto wallet agent helping the user manage their Clutch pocket.

CURRENT POCKET: "${ctx.pocketName}"
Total value: $${ctx.totalUsdValue.toFixed(2)}
Wallets: ${ctx.wallets.length} connected across ${[...new Set(ctx.wallets.map((w) => w.wallet.chain))].join(', ')}
Native ETH: ${ctx.nativeBalanceEth}

You can check balances, estimate gas, and help the user make smart decisions about payments and portfolio management.
Be concise, practical, and proactive with insights. Use tools when you need fresh data.`
}
