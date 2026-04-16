import { ChainId } from './types.js'

export const SUPPORTED_CHAINS: ChainId[] = [
  'ethereum',
  'base',
  'polygon',
  'solana',
  'arbitrum',
  'optimism',
]

export const CHAIN_NATIVE_TOKEN: Record<ChainId, string> = {
  ethereum: 'ETH',
  base: 'ETH',
  polygon: 'MATIC',
  solana: 'SOL',
  arbitrum: 'ETH',
  optimism: 'ETH',
}

export const CHAIN_DECIMALS: Record<ChainId, number> = {
  ethereum: 18,
  base: 18,
  polygon: 18,
  solana: 9,
  arbitrum: 18,
  optimism: 18,
}

export const CHAIN_EXPLORER: Record<ChainId, string> = {
  ethereum: 'https://etherscan.io',
  base: 'https://basescan.org',
  polygon: 'https://polygonscan.com',
  solana: 'https://solscan.io',
  arbitrum: 'https://arbiscan.io',
  optimism: 'https://optimistic.etherscan.io',
}

export const NATIVE_BALANCE_DECIMALS = 18
export const MAX_WALLETS_PER_POCKET = 20
