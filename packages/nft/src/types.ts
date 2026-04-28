// ── Metaplex / Solana NFT types ───────────────────────────────────────────────

export interface NftAttribute {
  trait_type: string
  value:      string | number
}

export interface NftFile {
  uri:  string
  type: string   // 'image/png' | 'video/mp4' | etc.
}

export interface NftMetadata {
  name:        string
  symbol:      string
  description: string
  image:       string         // IPFS / Arweave URI
  animationUrl?: string
  externalUrl?: string
  attributes:  NftAttribute[]
  properties?: {
    files?:    NftFile[]
    category?: string         // 'image' | 'video' | 'audio' | 'vr'
  }
}

export interface NftToken {
  /** Mint address (unique identifier on Solana) */
  mint:            string
  /** Token account holding the NFT */
  tokenAccount:    string
  /** Owner wallet address */
  owner:           string
  /** Metaplex metadata account address */
  metadataAddress?: string
  /** On-chain metadata */
  name:            string
  symbol:          string
  uri:             string    // points to off-chain JSON
  /** Resolved off-chain metadata */
  metadata?:       NftMetadata
  /** Collection this NFT belongs to */
  collection?: {
    address:  string
    name:     string
    verified: boolean
    image?:   string
  }
  /** Metaplex token standard */
  standard:        'NonFungible' | 'ProgrammableNonFungible' | 'FungibleAsset' | 'Fungible'
  isMutable:       boolean
  primarySaleHappened: boolean
  sellerFeeBasisPoints: number   // royalty in basis points
  creators?:       Array<{ address: string; verified: boolean; share: number }>
  /** Floor price from marketplace (if available) */
  floorPriceSOL?:  number
  /** Last sale price */
  lastSaleSOL?:    number
  fetchedAt:       Date
}

export interface NftCollection {
  address:    string
  name:       string
  symbol:     string
  image?:     string
  description?: string
  floorPriceSOL?: number
  totalSupply?: number
  items:      NftToken[]
}

export interface NftPortfolio {
  walletAddress: string
  nfts:          NftToken[]
  collections:   NftCollection[]
  totalItems:    number
  estimatedValueSOL: number
  fetchedAt:     Date
}

// ── Transfer ──────────────────────────────────────────────────────────────────

export interface NftTransferRequest {
  mint:        string
  fromAddress: string
  toAddress:   string
  /** For pNFTs (Programmable NFTs) — must go through Metaplex auth rules */
  isProgrammable?: boolean
}

export interface NftTransferResult {
  txHash:      string
  mint:        string
  fromAddress: string
  toAddress:   string
  confirmedAt: Date
}
