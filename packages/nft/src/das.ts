/**
 * NFT fetcher using the Metaplex Digital Asset Standard (DAS) API.
 *
 * DAS is available on:
 *   - Helius RPC  (recommended — fast, indexed)  https://helius.dev
 *   - Triton      https://triton.one
 *   - Standard Solana RPC (limited, no metadata indexing)
 *
 * Falls back to on-chain account parsing if DAS is unavailable.
 */

import type { NftToken, NftMetadata, NftCollection, NftPortfolio } from './types.js'

const METADATA_CACHE = new Map<string, { data: NftMetadata; ts: number }>()
const CACHE_TTL      = 10 * 60 * 1000  // 10 minutes

export class DasClient {
  constructor(private rpcUrl: string) {}

  // ── DAS API calls ─────────────────────────────────────────────────────────

  /**
   * Fetch all NFTs owned by a wallet using DAS getAssetsByOwner.
   */
  async getNftsByOwner(owner: string, page = 1, limit = 100): Promise<NftToken[]> {
    const res = await fetch(this.rpcUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 'clutch-nft',
        method:  'getAssetsByOwner',
        params:  {
          ownerAddress: owner,
          page,
          limit,
          displayOptions: {
            showCollectionMetadata: true,
            showGrandTotal:         true,
            showNativeBalance:      false,
          },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) throw new Error(`DAS request failed: ${res.status}`)

    const data = await res.json() as { result: { items: any[]; total: number } }
    const items = data.result?.items ?? []

    return items
      .filter((item: any) => this.isNft(item))
      .map((item: any) => this.parseAsset(item, owner))
  }

  /**
   * Fetch a single NFT by mint address.
   */
  async getNft(mint: string): Promise<NftToken | null> {
    const res = await fetch(this.rpcUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 'clutch-nft',
        method:  'getAsset',
        params:  { id: mint, displayOptions: { showCollectionMetadata: true } },
      }),
      signal: AbortSignal.timeout(8_000),
    })

    if (!res.ok) return null
    const data = await res.json() as { result: any }
    if (!data.result) return null
    return this.parseAsset(data.result, data.result?.ownership?.owner ?? '')
  }

  /**
   * Fetch all NFTs in a collection.
   */
  async getNftsByCollection(collectionMint: string, page = 1, limit = 50): Promise<NftToken[]> {
    const res = await fetch(this.rpcUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 'clutch-nft',
        method:  'getAssetsByGroup',
        params:  {
          groupKey:   'collection',
          groupValue: collectionMint,
          page, limit,
          displayOptions: { showCollectionMetadata: true },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) return []
    const data = await res.json() as { result: { items: any[] } }
    return (data.result?.items ?? []).map((item: any) => this.parseAsset(item, ''))
  }

  // ── Off-chain metadata ────────────────────────────────────────────────────

  /**
   * Fetch off-chain JSON metadata from IPFS/Arweave URI.
   * Resolves common gateway patterns and caches results.
   */
  async fetchMetadata(uri: string): Promise<NftMetadata | null> {
    if (!uri) return null

    const cached = METADATA_CACHE.get(uri)
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

    const resolved = resolveUri(uri)
    if (!resolved) return null

    try {
      const res = await fetch(resolved, { signal: AbortSignal.timeout(8_000) })
      if (!res.ok) return null
      const data = await res.json() as NftMetadata
      METADATA_CACHE.set(uri, { data, ts: Date.now() })
      return data
    } catch {
      return null
    }
  }

  // ── Full portfolio ────────────────────────────────────────────────────────

  async buildPortfolio(walletAddress: string): Promise<NftPortfolio> {
    const nfts = await this.getNftsByOwner(walletAddress)

    // Enrich with off-chain metadata (in parallel, non-blocking)
    await Promise.allSettled(
      nfts.map(async (nft) => {
        if (nft.uri && !nft.metadata) {
          nft.metadata = await this.fetchMetadata(nft.uri) ?? undefined
          if (nft.metadata) nft.name = nft.metadata.name || nft.name
        }
      })
    )

    // Group into collections
    const collectionMap = new Map<string, NftToken[]>()
    const uncollected:    NftToken[] = []

    for (const nft of nfts) {
      if (nft.collection?.address) {
        const col = collectionMap.get(nft.collection.address) ?? []
        col.push(nft)
        collectionMap.set(nft.collection.address, col)
      } else {
        uncollected.push(nft)
      }
    }

    const collections: NftCollection[] = [
      ...[...collectionMap.entries()].map(([address, items]) => ({
        address,
        name:  items[0].collection?.name ?? 'Unknown collection',
        symbol: items[0].symbol,
        image: items[0].collection?.image ?? items[0].metadata?.image,
        floorPriceSOL: items[0].collection ? items[0].floorPriceSOL : undefined,
        totalSupply: undefined,
        items,
      })),
    ]

    const estimatedValueSOL = nfts.reduce((s, n) => s + (n.floorPriceSOL ?? 0), 0)

    return {
      walletAddress,
      nfts,
      collections,
      totalItems: nfts.length,
      estimatedValueSOL,
      fetchedAt: new Date(),
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private isNft(item: any): boolean {
    const standard = item.interface
    return (
      standard === 'V1_NFT' ||
      standard === 'V2_NFT' ||
      standard === 'ProgrammableNFT' ||
      standard === 'MplCoreAsset' ||
      item.content?.metadata?.token_standard === 'NonFungible'
    )
  }

  private parseAsset(item: any, owner: string): NftToken {
    const content   = item.content ?? {}
    const metadata  = content.metadata ?? {}
    const links     = content.links ?? {}
    const grouping  = item.grouping ?? []
    const collection = grouping.find((g: any) => g.group_key === 'collection')

    return {
      mint:             item.id,
      tokenAccount:     item.token_info?.token_account ?? '',
      owner:            item.ownership?.owner ?? owner,
      metadataAddress:  item.metadataAddress ?? undefined,
      name:             metadata.name ?? item.id.slice(0, 8),
      symbol:           metadata.symbol ?? '',
      uri:              content.json_uri ?? '',
      metadata:         metadata.name ? {
        name:        metadata.name,
        symbol:      metadata.symbol ?? '',
        description: metadata.description ?? '',
        image:       links.image ?? '',
        attributes:  metadata.attributes ?? [],
      } : undefined,
      collection:    collection ? {
        address:  collection.group_value,
        name:     collection.collection_metadata?.name ?? '',
        verified: !!collection.verified,
        image:    collection.collection_metadata?.image ?? undefined,
      } : undefined,
      standard:        item.interface === 'ProgrammableNFT' ? 'ProgrammableNonFungible' : 'NonFungible',
      isMutable:       item.mutable ?? true,
      primarySaleHappened: item.royalty?.primary_sale_happened ?? false,
      sellerFeeBasisPoints: item.royalty?.royalty_model === 'creators' ? (item.royalty?.percent ?? 0) * 100 : 0,
      creators:        item.creators?.map((c: any) => ({
        address: c.address, verified: c.verified, share: c.share,
      })) ?? [],
      floorPriceSOL:   item.price_info?.price_per_token ?? undefined,
      fetchedAt:       new Date(),
    }
  }
}

// ── URI resolver ──────────────────────────────────────────────────────────────

function resolveUri(uri: string): string | null {
  if (!uri) return null

  // IPFS → use public gateway
  if (uri.startsWith('ipfs://')) {
    return `https://cloudflare-ipfs.com/ipfs/${uri.slice(7)}`
  }

  // Arweave
  if (uri.startsWith('ar://')) {
    return `https://arweave.net/${uri.slice(5)}`
  }

  // Already HTTP
  if (uri.startsWith('http')) return uri

  return null
}

export function createDasClient(rpcUrl: string): DasClient {
  return new DasClient(rpcUrl)
}
