/**
 * Jupiter swap client — Solana's primary DEX aggregator.
 * Uses the Jupiter v6 Quote + Swap APIs (no SDK dependency needed).
 *
 * Docs: https://station.jup.ag/docs/apis/swap-api
 */

import { SPL_DECIMALS } from '@clutch/core'

const JUPITER_QUOTE_URL = 'https://quote-api.jup.ag/v6/quote'
const JUPITER_SWAP_URL  = 'https://quote-api.jup.ag/v6/swap'

// Well-known Solana token mint addresses
export const TOKEN_MINTS: Record<string, string> = {
  SOL:   'So11111111111111111111111111111111111111112',
  USDC:  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT:  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BONK:  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JUP:   'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  RAY:   '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  ORCA:  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  mSOL:  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  stSOL: '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj',
  WIF:   'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  PYTH:  'HZ1JovNiVvGrCs7KMhgDsJMXnFHJf9S19R3MJQbPyBU6',
  JTO:   'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
}

export interface SwapQuote {
  inputMint:        string
  outputMint:       string
  inputAmount:      string   // in smallest units (lamports / micro-USDC)
  outputAmount:     string
  otherAmountThreshold: string
  swapMode:         'ExactIn' | 'ExactOut'
  slippageBps:      number
  priceImpactPct:   string
  routePlan:        RoutePlan[]
  contextSlot:      number
  timeTaken:        number
}

export interface RoutePlan {
  swapInfo: {
    ammKey:      string
    label:       string
    inputMint:   string
    outputMint:  string
    inAmount:    string
    outAmount:   string
    feeAmount:   string
    feeMint:     string
  }
  percent: number
}

export interface SwapTransaction {
  swapTransaction: string  // base64-encoded versioned transaction
  lastValidBlockHeight: number
  prioritizationFeeLamports: number
}

export interface QuoteParams {
  inputToken:   string   // symbol e.g. 'SOL'
  outputToken:  string   // symbol e.g. 'USDC'
  amount:       number   // human-readable amount
  slippageBps?: number   // default 50 = 0.5%
}

export interface QuoteResult {
  quote:          SwapQuote
  inputSymbol:    string
  outputSymbol:   string
  inputAmount:    number    // human-readable
  outputAmount:   number    // human-readable
  priceImpact:    number    // %
  minimumReceived: number   // after slippage
  route:          string[]  // AMM names in the route
}

export class JupiterClient {
  private slippageBps: number

  constructor(defaultSlippageBps = 50) {
    this.slippageBps = defaultSlippageBps
  }

  /**
   * Get a swap quote from Jupiter.
   * Returns human-readable amounts alongside the raw quote object.
   */
  async getQuote(params: QuoteParams): Promise<QuoteResult> {
    const inputMint  = TOKEN_MINTS[params.inputToken]
    const outputMint = TOKEN_MINTS[params.outputToken]

    if (!inputMint)  throw new Error(`Unknown token: ${params.inputToken}`)
    if (!outputMint) throw new Error(`Unknown token: ${params.outputToken}`)

    const inputDecimals  = SPL_DECIMALS[params.inputToken]  ?? 9
    const outputDecimals = SPL_DECIMALS[params.outputToken] ?? 6
    const slippage       = params.slippageBps ?? this.slippageBps

    // Convert human amount to smallest units
    const rawAmount = Math.floor(params.amount * 10 ** inputDecimals).toString()

    const url = `${JUPITER_QUOTE_URL}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${rawAmount}&slippageBps=${slippage}`

    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal:  AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Jupiter quote failed: ${err}`)
    }

    const quote: SwapQuote = await res.json()

    const outputAmount   = Number(quote.outputAmount) / 10 ** outputDecimals
    const minReceived    = Number(quote.otherAmountThreshold) / 10 ** outputDecimals
    const priceImpact    = parseFloat(quote.priceImpactPct)
    const route          = quote.routePlan.map((r) => r.swapInfo.label)

    return {
      quote,
      inputSymbol:     params.inputToken,
      outputSymbol:    params.outputToken,
      inputAmount:     params.amount,
      outputAmount,
      priceImpact,
      minimumReceived: minReceived,
      route,
    }
  }

  /**
   * Build a swap transaction.
   * The caller must sign and broadcast it using their wallet.
   * Returns a base64-encoded versioned transaction.
   */
  async buildSwapTransaction(
    quote:             SwapQuote,
    userPublicKey:     string,
    priorityFeeLamports = 1000,
  ): Promise<SwapTransaction> {
    const res = await fetch(JUPITER_SWAP_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        quoteResponse:            quote,
        userPublicKey,
        wrapAndUnwrapSol:         true,
        dynamicComputeUnitLimit:  true,
        prioritizationFeeLamports: priorityFeeLamports,
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Jupiter swap build failed: ${err}`)
    }

    return res.json()
  }

  /**
   * Get the price of outputToken in terms of inputToken.
   * e.g. getPrice('SOL', 'USDC') → ~145 (USD per SOL)
   */
  async getPrice(inputToken: string, outputToken: string): Promise<number> {
    const result = await this.getQuote({
      inputToken,
      outputToken,
      amount: 1,
    })
    return result.outputAmount
  }

  /**
   * Get prices for multiple tokens vs USDC in a single batch.
   */
  async getBatchPrices(tokens: string[]): Promise<Record<string, number>> {
    const results = await Promise.allSettled(
      tokens
        .filter((t) => t !== 'USDC' && TOKEN_MINTS[t])
        .map(async (token) => {
          const price = await this.getPrice(token, 'USDC')
          return [token, price] as [string, number]
        })
    )

    const prices: Record<string, number> = { USDC: 1, USDT: 1 }
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const [token, price] = result.value
        prices[token] = price
      }
    }
    return prices
  }
}

export const jupiterClient = new JupiterClient()
