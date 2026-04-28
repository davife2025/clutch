import { Hono } from 'hono'
import { db } from '../db/client.js'
import { pockets, wallets, walletBalances } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { createRealmsClient } from '@clutch/governance'

export const governanceRoutes = new Hono()
governanceRoutes.use('*', authMiddleware)

const realms = createRealmsClient(
  process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com'
)

/**
 * GET /governance/featured
 * Well-known Solana DAOs.
 */
governanceRoutes.get('/featured', async (c) => {
  const featured = await realms.getFeaturedRealms()
  return c.json({ data: { realms: featured } })
})

/**
 * GET /governance/search?q=mango
 */
governanceRoutes.get('/search', async (c) => {
  const q = c.req.query('q')
  if (!q) return c.json({ error: { code: 'VALIDATION', message: 'q is required' } }, 400)
  const results = await realms.searchRealms(q)
  return c.json({ data: { realms: results } })
})

/**
 * GET /governance/realm/:address
 * Realm details + active proposals.
 */
governanceRoutes.get('/realm/:address', async (c) => {
  const address = c.req.param('address')
  const [realm, activeProposals] = await Promise.all([
    realms.getRealm(address),
    realms.getActiveProposals(address),
  ])
  if (!realm) return c.json({ error: { code: 'NOT_FOUND', message: 'Realm not found' } }, 404)
  return c.json({ data: { realm, activeProposals } })
})

/**
 * GET /governance/realm/:address/proposals?state=Voting
 */
governanceRoutes.get('/realm/:address/proposals', async (c) => {
  const address = c.req.param('address')
  const stateParam = c.req.query('state')
  const states = stateParam ? stateParam.split(',') as any[] : undefined
  const proposals = await realms.getProposals(address, states)
  return c.json({ data: { proposals } })
})

/**
 * GET /governance/pocket/:pocketId/power
 * Voting power across all DAOs for all wallets in a pocket.
 */
governanceRoutes.get('/pocket/:pocketId/power', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.param('pocketId')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
    with: { wallets: true },
  })
  if (!pocket) return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)

  const solanaWallets = (pocket as any).wallets.filter((w: any) => w.chain === 'solana')

  // Find all DAOs where any wallet holds voting power
  const allDaos = await Promise.allSettled(
    solanaWallets.map((w: any) => realms.getWalletRealms(w.address))
  )

  const combined: Record<string, any> = {}
  for (const result of allDaos) {
    if (result.status !== 'fulfilled') continue
    for (const entry of result.value) {
      const addr = entry.realm.address
      if (!combined[addr]) {
        combined[addr] = { realm: entry.realm, totalPower: BigInt(0), wallets: [] }
      }
      combined[addr].totalPower += BigInt(entry.power.communityPower)
      combined[addr].wallets.push({ power: entry.power })
    }
  }

  const daos = Object.values(combined).map((d: any) => ({
    ...d,
    totalPower: d.totalPower.toString(),
    canVote: d.totalPower > BigInt(0),
  }))

  return c.json({ data: { daos, count: daos.length } })
})

/**
 * GET /governance/wallet/:address/realms
 * All DAOs where a wallet has voting power.
 */
governanceRoutes.get('/wallet/:address/realms', async (c) => {
  const address = c.req.param('address')
  const daoList = await realms.getWalletRealms(address)
  return c.json({ data: { daos: daoList } })
})

/**
 * POST /governance/vote
 * Build a vote transaction. Client signs + broadcasts.
 */
governanceRoutes.post('/vote', async (c) => {
  const userId = c.get('userId') as string
  const { realmAddress, proposalAddress, voterAddress, vote } = await c.req.json()

  if (!realmAddress || !proposalAddress || !voterAddress || !vote) {
    return c.json({ error: { code: 'VALIDATION', message: 'realmAddress, proposalAddress, voterAddress, vote required' } }, 400)
  }

  if (!['Yes', 'No', 'Abstain'].includes(vote)) {
    return c.json({ error: { code: 'VALIDATION', message: 'vote must be Yes, No, or Abstain' } }, 400)
  }

  // Verify voter wallet is in user's pocket
  const wallet = await db.query.wallets.findFirst({ where: eq(wallets.address, voterAddress) })
  if (!wallet) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Wallet not found in your Clutch' } }, 403)
  }

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, wallet.pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Not your wallet' } }, 403)
  }

  const tx = await realms.buildCastVoteTx({ realmAddress, proposalAddress, voterAddress, vote })

  return c.json({
    data: {
      transaction: tx,
      vote,
      proposalAddress,
      realmAddress,
      voterAddress,
      message: 'Sign and broadcast this transaction to cast your vote',
    }
  })
})
