import { Hono } from 'hono'
import { db } from '../db/client.js'
import { pockets, wallets, nftCache } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { createDasClient, magicEdenClient, buildNftTransfer } from '@clutch/nft'

export const nftRoutes = new Hono()
nftRoutes.use('*', authMiddleware)

const RPC_URL = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com'
const das     = createDasClient(RPC_URL)

// ── Fetch NFTs for a pocket ───────────────────────────────────────────────────

/**
 * GET /nfts/:pocketId
 * Returns cached NFTs across all Solana wallets in a pocket.
 */
nftRoutes.get('/:pocketId', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.param('pocketId')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
    with: { wallets: true },
  })
  if (!pocket) return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)

  const solanaWallets = (pocket as any).wallets.filter((w: any) => w.chain === 'solana')

  const allNfts = await Promise.all(
    solanaWallets.map(async (w: any) => {
      const cached = await db.query.nftCache.findMany({
        where: eq(nftCache.walletId, w.id),
      })
      return cached.map((n) => ({
        ...n,
        walletAddress: w.address,
        metadata: n.metadataJson ? JSON.parse(n.metadataJson) : null,
      }))
    })
  )

  const nfts      = allNfts.flat()
  const totalItems = nfts.length
  const estValueSol = nfts.reduce((s, n) => s + parseFloat(n.floorPriceSol ?? '0'), 0)

  return c.json({ data: { nfts, totalItems, estimatedValueSOL: estValueSol } })
})

/**
 * POST /nfts/:pocketId/sync
 * Refresh NFTs from chain for all Solana wallets — runs in background.
 */
nftRoutes.post('/:pocketId/sync', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.param('pocketId')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
    with: { wallets: true },
  })
  if (!pocket) return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)

  const solanaWallets = (pocket as any).wallets.filter((w: any) => w.chain === 'solana')

  // Background sync
  ;(async () => {
    for (const wallet of solanaWallets) {
      try {
        const portfolio = await das.buildPortfolio(wallet.address)

        for (const nft of portfolio.nfts) {
          await db
            .insert(nftCache)
            .values({
              walletId:          wallet.id,
              mint:              nft.mint,
              name:              nft.name,
              symbol:            nft.symbol,
              uri:               nft.uri,
              imageUrl:          nft.metadata?.image ?? null,
              collectionAddress: nft.collection?.address ?? null,
              collectionName:    nft.collection?.name ?? null,
              floorPriceSol:     nft.floorPriceSOL?.toString() ?? null,
              metadataJson:      nft.metadata ? JSON.stringify(nft.metadata) : null,
              fetchedAt:         new Date(),
            })
            .onConflictDoUpdate({
              target: [nftCache.mint, nftCache.walletId],
              set: {
                name:              nft.name,
                imageUrl:          nft.metadata?.image ?? null,
                collectionAddress: nft.collection?.address ?? null,
                collectionName:    nft.collection?.name ?? null,
                floorPriceSol:     nft.floorPriceSOL?.toString() ?? null,
                metadataJson:      nft.metadata ? JSON.stringify(nft.metadata) : null,
                fetchedAt:         new Date(),
              },
            })
        }
      } catch (err) {
        console.error(`[nft-sync] failed for wallet ${wallet.id}:`, err)
      }
    }
  })().catch(console.error)

  return c.json({ data: { message: 'NFT sync started', wallets: solanaWallets.length } })
})

/**
 * GET /nfts/:pocketId/collections
 * Returns NFTs grouped by collection.
 */
nftRoutes.get('/:pocketId/collections', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.param('pocketId')

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, pocketId), eq(pockets.ownerId, userId)),
    with: { wallets: true },
  })
  if (!pocket) return c.json({ error: { code: 'NOT_FOUND', message: 'Pocket not found' } }, 404)

  const walletIds = (pocket as any).wallets
    .filter((w: any) => w.chain === 'solana')
    .map((w: any) => w.id)

  const allNfts = await Promise.all(
    walletIds.map((wid: string) => db.query.nftCache.findMany({ where: eq(nftCache.walletId, wid) }))
  )

  const flat = allNfts.flat()

  // Group by collection
  const collectionMap: Record<string, any[]> = {}
  const uncollected: any[] = []

  for (const nft of flat) {
    if (nft.collectionAddress) {
      if (!collectionMap[nft.collectionAddress]) collectionMap[nft.collectionAddress] = []
      collectionMap[nft.collectionAddress].push(nft)
    } else {
      uncollected.push(nft)
    }
  }

  const collections = Object.entries(collectionMap).map(([address, items]) => ({
    address,
    name:  items[0].collectionName ?? 'Unknown',
    count: items.length,
    items,
  }))

  return c.json({ data: { collections, uncollected } })
})

/**
 * GET /nfts/token/:mint
 * Get details for a specific NFT by mint address.
 */
nftRoutes.get('/token/:mint', async (c) => {
  const mint = c.req.param('mint')

  // Check cache first
  const cached = await db.query.nftCache.findFirst({ where: eq(nftCache.mint, mint) })

  if (cached && Date.now() - cached.fetchedAt.getTime() < 10 * 60 * 1000) {
    return c.json({ data: { nft: { ...cached, metadata: cached.metadataJson ? JSON.parse(cached.metadataJson) : null } } })
  }

  // Fetch live
  const nft = await das.getNft(mint)
  if (!nft) return c.json({ error: { code: 'NOT_FOUND', message: 'NFT not found' } }, 404)

  return c.json({ data: { nft } })
})

/**
 * GET /nfts/marketplace/:collectionSymbol
 * Get Magic Eden floor price + recent sales for a collection.
 */
nftRoutes.get('/marketplace/:collectionSymbol', async (c) => {
  const symbol = c.req.param('collectionSymbol')

  const [stats, recentSales] = await Promise.all([
    magicEdenClient.getCollectionStats(symbol),
    magicEdenClient.getRecentSales(symbol, 5),
  ])

  return c.json({ data: { stats, recentSales } })
})

/**
 * POST /nfts/transfer
 * Build an NFT transfer transaction. Returns base64 tx for client to sign.
 */
nftRoutes.post('/transfer', async (c) => {
  const userId = c.get('userId') as string
  const { mint, fromAddress, toAddress } = await c.req.json()

  if (!mint || !fromAddress || !toAddress) {
    return c.json({ error: { code: 'VALIDATION', message: 'mint, fromAddress, toAddress required' } }, 400)
  }

  // Verify the from address belongs to this user
  const wallet = await db.query.wallets.findFirst({ where: eq(wallets.address, fromAddress) })
  if (!wallet) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Wallet not found in your Clutch' } }, 403)
  }

  const pocket = await db.query.pockets.findFirst({
    where: and(eq(pockets.id, wallet.pocketId), eq(pockets.ownerId, userId)),
  })
  if (!pocket) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Not your wallet' } }, 403)
  }

  // Get NFT to check if it's programmable
  const nftInfo = await db.query.nftCache.findFirst({ where: eq(nftCache.mint, mint) })

  const result = await buildNftTransfer(
    { mint, fromAddress, toAddress },
    RPC_URL,
  )

  return c.json({
    data: {
      ...result,
      nftName: nftInfo?.name ?? mint.slice(0, 8),
      message: 'Sign and broadcast this transaction with your wallet',
    }
  })
})
