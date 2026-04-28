/**
 * NFT marketplace pricing client.
 * Fetches floor prices and recent sales from Magic Eden (Solana's largest NFT marketplace).
 *
 * Magic Eden v2 API: https://api.magiceden.dev/v2
 */

export interface CollectionStats {
  symbol:          string
  floorPrice:      number   // SOL
  listedCount:     number
  avgPrice24hr:    number
  volumeAll:       number
  updatedAt:       Date
}

export interface RecentSale {
  mint:        string
  price:       number   // SOL
  buyer:       string
  seller:      string
  blockTime:   number
  txHash:      string
}

const ME_BASE = 'https://api-mainnet.magiceden.dev/v2'
const STATS_CACHE = new Map<string, { data: CollectionStats; ts: number }>()
const CACHE_TTL   = 5 * 60 * 1000

export class MagicEdenClient {

  async getCollectionStats(collectionSymbol: string): Promise<CollectionStats | null> {
    const cached = STATS_CACHE.get(collectionSymbol)
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

    try {
      const res = await fetch(
        `${ME_BASE}/collections/${collectionSymbol}/stats`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) }
      )
      if (!res.ok) return null

      const data = await res.json() as any
      const stats: CollectionStats = {
        symbol:       collectionSymbol,
        floorPrice:   (data.floorPrice ?? 0) / 1e9,   // lamports → SOL
        listedCount:  data.listedCount ?? 0,
        avgPrice24hr: (data.avgPrice24hr ?? 0) / 1e9,
        volumeAll:    (data.volumeAll ?? 0) / 1e9,
        updatedAt:    new Date(),
      }

      STATS_CACHE.set(collectionSymbol, { data: stats, ts: Date.now() })
      return stats
    } catch {
      return null
    }
  }

  async getRecentSales(collectionSymbol: string, limit = 10): Promise<RecentSale[]> {
    try {
      const res = await fetch(
        `${ME_BASE}/collections/${collectionSymbol}/activities?offset=0&limit=${limit}&type=buyNow`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) }
      )
      if (!res.ok) return []

      const data = await res.json() as any[]
      return (data ?? []).map((sale: any): RecentSale => ({
        mint:      sale.mintAddress,
        price:     (sale.price ?? 0),
        buyer:     sale.buyer ?? '',
        seller:    sale.seller ?? '',
        blockTime: sale.blockTime ?? 0,
        txHash:    sale.signature ?? '',
      }))
    } catch {
      return []
    }
  }

  /**
   * Get the listing price for a specific NFT, if it's listed.
   */
  async getNftListing(mint: string): Promise<{ price: number; seller: string } | null> {
    try {
      const res = await fetch(
        `${ME_BASE}/tokens/${mint}/listings`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) }
      )
      if (!res.ok) return null
      const data = await res.json() as any[]
      if (!data?.length) return null
      return { price: data[0].price ?? 0, seller: data[0].seller ?? '' }
    } catch {
      return null
    }
  }
}

export const magicEdenClient = new MagicEdenClient()
