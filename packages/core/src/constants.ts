import { ChainId } from './types.js'

/** Solana is Clutch's primary chain. */
export const PRIMARY_CHAIN: ChainId = 'solana'

export const SUPPORTED_CHAINS: ChainId[] = [
  'solana',       // primary
  'ethereum',
  'base',
  'polygon',
  'arbitrum',
  'optimism',
]

export const CHAIN_NATIVE_TOKEN: Record<ChainId, string> = {
  solana:   'SOL',
  ethereum: 'ETH',
  base:     'ETH',
  polygon:  'MATIC',
  arbitrum: 'ETH',
  optimism: 'ETH',
}

export const CHAIN_DECIMALS: Record<ChainId, number> = {
  solana:   9,    // lamports
  ethereum: 18,
  base:     18,
  polygon:  18,
  arbitrum: 18,
  optimism: 18,
}

export const CHAIN_EXPLORER: Record<ChainId, string> = {
  solana:   'https://solscan.io',
  ethereum: 'https://etherscan.io',
  base:     'https://basescan.org',
  polygon:  'https://polygonscan.com',
  arbitrum: 'https://arbiscan.io',
  optimism: 'https://optimistic.etherscan.io',
}

export const CHAIN_LABEL: Record<ChainId, string> = {
  solana:   'Solana',
  ethereum: 'Ethereum',
  base:     'Base',
  polygon:  'Polygon',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism',
}

/** Clutch native balance is stored in lamports (SOL, 9 decimals). */
export const NATIVE_DECIMALS = 9
export const NATIVE_TOKEN    = 'SOL'
export const LAMPORTS_PER_SOL = 1_000_000_000n

export const MAX_WALLETS_PER_POCKET = 20

/** Well-known SPL token decimals */
export const SPL_DECIMALS: Record<string, number> = {
  SOL:  9,
  USDC: 6,
  USDT: 6,
  BONK: 5,
  JUP:  6,
  RAY:  6,
  ORCA: 6,
  mSOL: 9,
  stSOL: 9,
}
