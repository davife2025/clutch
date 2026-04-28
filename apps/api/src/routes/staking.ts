import { Hono } from 'hono'
import { db } from '../db/client.js'
import { pockets, wallets, walletBalances } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { priceService } from '../services/price.service.js'
import { StakingService } from '../services/staking.service.js'

export const stakingRoutes = new Hono()
stakingRoutes.use('*', authMiddleware)

const stakingService = new StakingService(
  process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com'
)

/**
 * GET /staking/validators?limit=20
 * Top Solana validators by activated stake.
 */
stakingRoutes.get('/validators', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100)
  const validators = await stakingService.getTopValidators(limit)
  return c.json({ data: { validators } })
})

/**
 * GET /staking/liquid-options
 * Live APYs for liquid staking protocols.
 */
stakingRoutes.get('/liquid-options', async (c) => {
  const options = await stakingService.getLiquidStakingOptions()
  return c.json({ data: { options } })
})

/**
 * GET /staking/:pocketId/portfolio
 * Full staking portfolio for all Solana wallets in a pocket.
 */
stakingRoutes.get('/:pocketId/portfolio', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.param('pocketId')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
    with: { wallets: { with: { balances: true } } },
  })
  if (!pocket) return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)

  const solanaWallets = (pocket as any).wallets.filter((w: any) => w.chain === 'solana')
  if (solanaWallets.length === 0) {
    return c.json({ data: { portfolios: [], message: 'No Solana wallets in this pocket' } })
  }

  const solPrice = await priceService.getUsdPrice('SOL') ?? 150

  const portfolios = await Promise.allSettled(
    solanaWallets.map(async (w: any) => {
      // Build token balances map from cached balances
      const tokenBalances: Record<string, number> = {}
      for (const b of w.balances ?? []) {
        tokenBalances[b.token] = Number(b.amount) / 10 ** b.decimals
      }
      return stakingService.buildStakingPortfolio(w.address, tokenBalances, solPrice)
    })
  )

  const results = portfolios
    .filter((p) => p.status === 'fulfilled')
    .map((p) => (p as PromiseFulfilledResult<any>).value)

  const totalStakedSOL = results.reduce(
    (s, p) => s + p.totalNativeStakedSOL + p.totalLiquidSOL, 0
  )

  return c.json({ data: { portfolios: results, totalStakedSOL } })
})

/**
 * GET /staking/:walletAddress/accounts
 * Raw stake accounts for a specific address.
 */
stakingRoutes.get('/accounts/:walletAddress', async (c) => {
  const walletAddress = c.req.param('walletAddress')
  const accounts = await stakingService.getStakeAccounts(walletAddress)
  return c.json({ data: { accounts, count: accounts.length } })
})
