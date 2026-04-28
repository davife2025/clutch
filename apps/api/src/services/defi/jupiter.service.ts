/**
 * JupiterService — Solana's primary DEX aggregator.
 * Uses Jupiter V6 API to get best-route swap quotes and build swap transactions.
 *
 * Docs: https://station.jup.ag/docs/apis/swap-api
 */

const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6'

export interface SwapQuote {
  inMint:         string
  outMint:        string
  inAmount:       string    // in smallest units
  outAmount:      string    // in smallest units
  otherAmountThreshold: string
  swapMode:       string
  slippageBps:    number
  priceImpactPct: string
  routePlan:      RoutePlan[]
  contextSlot:    number
  timeTaken:      number
}

export interface RoutePlan {
  swapInfo: {
    ammKey:    string
    label:     string
    inputMint: string
    outputMint: string
    inAmount:  string
    outAmount: string
    feeAmount: string
    feeMint:   string
  }
  percent: number
}

export interface SwapTransaction {
  swapTransaction:          string   // base64-encoded serialised transaction
  lastValidBlockHeight:     number
  prioritizationFeeLamports: number
}

/** Well-known Solana token mints */
export const SOLANA_MINTS: Record<string, string> = {
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
  PYTH:  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  JTO:   'jtojtomepa8bewqjBa6B7HnhGX2eMwcCQF9ERHh7o9E',
}

export function mintForToken(token: string): string {
  return SOLANA_MINTS[token.toUpperCase()] ?? token
}

export class JupiterService {
  /**
   * Get a swap quote from Jupiter.
   * @param inputToken  Token to swap from (symbol or mint)
   * @param outputToken Token to swap to (symbol or mint)
   * @param amount      Amount in smallest units (lamports / micro-USDC)
   * @param slippageBps Slippage tolerance in basis points (default 50 = 0.5%)
   */
  async getQuote(
    inputToken: string,
    outputToken: string,
    amount: string,
    slippageBps = 50,
  ): Promise<SwapQuote> {
    const inputMint  = mintForToken(inputToken)
    const outputMint = mintForToken(outputToken)

    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      slippageBps: String(slippageBps),
      onlyDirectRoutes: 'false',
      asLegacyTransaction: 'false',
    })

    const res = await fetch(`${JUPITER_QUOTE_API}/quote?${params}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Jupiter quote failed: ${err}`)
    }

    return res.json() as Promise<SwapQuote>
  }

  /**
   * Build a swap transaction from a quote.
   * Returns a base64-encoded, partially-signed transaction the user must sign + send.
   */
  async buildSwapTransaction(
    quote: SwapQuote,
    userPublicKey: string,
    opts?: {
      wrapAndUnwrapSol?: boolean
      priorityFee?: 'auto' | number
    },
  ): Promise<SwapTransaction> {
    const body = {
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol:         opts?.wrapAndUnwrapSol ?? true,
      dynamicComputeUnitLimit:  true,
      prioritizationFeeLamports: opts?.priorityFee === 'auto' ? 'auto' : (opts?.priorityFee ?? 'auto'),
    }

    const res = await fetch(`${JUPITER_QUOTE_API}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Jupiter swap build failed: ${err}`)
    }

    return res.json() as Promise<SwapTransaction>
  }

  /**
   * Get token price in USDC via a small swap quote.
   */
  async getTokenPriceInUsdc(token: string, decimals = 9): Promise<number | null> {
    try {
      const amount = String(10 ** decimals)  // 1 unit
      const quote  = await this.getQuote(token, 'USDC', amount)
      return Number(quote.outAmount) / 1e6   // USDC has 6 decimals
    } catch {
      return null
    }
  }
}

export const jupiterService = new JupiterService()
