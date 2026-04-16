import {
  createPublicClient, createWalletClient, http,
  formatUnits, parseUnits, encodeFunctionData,
  type Address, type PublicClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet, base, polygon, arbitrum, optimism } from 'viem/chains'
import type { WalletConnector, SigningConnector, TokenBalance, TxRequest, TxReceipt } from '../connector.js'
import { ChainId } from '@clutch/core'

// Standard ERC-20 ABI — just the functions we need
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

// Well-known ERC-20 token addresses per chain
const KNOWN_TOKENS: Partial<Record<ChainId, Array<{ symbol: string; address: Address; decimals: number }>>> = {
  ethereum: [
    { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    { symbol: 'DAI',  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
    { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
  ],
  base: [
    { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
    { symbol: 'DAI',  address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18 },
  ],
  polygon: [
    { symbol: 'USDC', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
    { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
  ],
  arbitrum: [
    { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
    { symbol: 'ARB',  address: '0x912CE59144191C1204E64559FE8253a0e49E6548', decimals: 18 },
  ],
  optimism: [
    { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6 },
    { symbol: 'OP',   address: '0x4200000000000000000000000000000000000042', decimals: 18 },
  ],
}

const VIEM_CHAINS: Record<string, typeof mainnet> = {
  ethereum: mainnet,
  base,
  polygon,
  arbitrum,
  optimism,
}

const CHAIN_NATIVE: Record<string, string> = {
  ethereum: 'ETH',
  base: 'ETH',
  polygon: 'MATIC',
  arbitrum: 'ETH',
  optimism: 'ETH',
}

export class EVMConnector implements SigningConnector {
  readonly chain: ChainId
  readonly name: string
  private client: PublicClient
  private rpcUrl: string

  constructor(chain: ChainId, rpcUrl: string) {
    this.chain = chain
    this.name = `EVM:${chain}`
    this.rpcUrl = rpcUrl
    this.client = createPublicClient({
      chain: VIEM_CHAINS[chain],
      transport: http(rpcUrl),
    })
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.getBlockNumber()
      return true
    } catch {
      return false
    }
  }

  async getNativeBalance(address: string): Promise<bigint> {
    return this.client.getBalance({ address: address as Address })
  }

  async getBalances(address: string): Promise<TokenBalance[]> {
    const addr = address as Address
    const results: TokenBalance[] = []

    // Native balance
    const nativeBalance = await this.getNativeBalance(address)
    results.push({
      token: CHAIN_NATIVE[this.chain] ?? 'ETH',
      amount: nativeBalance,
      decimals: 18,
    })

    // ERC-20 tokens
    const knownTokens = KNOWN_TOKENS[this.chain] ?? []
    const tokenResults = await Promise.allSettled(
      knownTokens.map(async (token) => {
        const balance = await this.client.readContract({
          address: token.address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [addr],
        })

        if (balance > BigInt(0)) {
          results.push({
            token: token.symbol,
            amount: balance,
            decimals: token.decimals,
            contractAddress: token.address,
          })
        }
      })
    )

    // Log any token fetch failures (non-fatal)
    tokenResults.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn(`[evm] failed to fetch token ${knownTokens[i]?.symbol}:`, r.reason)
      }
    })

    return results
  }

  async estimateGas(request: TxRequest): Promise<bigint> {
    return this.client.estimateGas({
      to: request.to as Address,
      value: request.token === (CHAIN_NATIVE[this.chain] ?? 'ETH') ? request.amount : undefined,
      data: request.data as `0x${string}` | undefined,
    })
  }

  async sendTransaction(request: TxRequest, privateKey: string): Promise<TxReceipt> {
    const account = privateKeyToAccount(privateKey as `0x${string}`)
    const walletClient = createWalletClient({
      account,
      chain: VIEM_CHAINS[this.chain],
      transport: http(this.rpcUrl),
    })

    let txHash: `0x${string}`
    const nativeToken = CHAIN_NATIVE[this.chain] ?? 'ETH'

    if (request.token === nativeToken) {
      // Native transfer
      txHash = await walletClient.sendTransaction({
        to: request.to as Address,
        value: request.amount,
      })
    } else {
      // ERC-20 transfer
      const knownTokens = KNOWN_TOKENS[this.chain] ?? []
      const tokenInfo = knownTokens.find((t) => t.symbol === request.token)
      if (!tokenInfo) throw new Error(`Unknown token: ${request.token}`)

      txHash = await walletClient.writeContract({
        address: tokenInfo.address,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [request.to as Address, request.amount],
      })
    }

    // Wait for receipt
    const receipt = await this.client.waitForTransactionReceipt({ hash: txHash })

    return {
      txHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      status: receipt.status === 'success' ? 'success' : 'reverted',
    }
  }

  async signMessage(message: string, privateKey: string): Promise<string> {
    const account = privateKeyToAccount(privateKey as `0x${string}`)
    const walletClient = createWalletClient({
      account,
      chain: VIEM_CHAINS[this.chain],
      transport: http(this.rpcUrl),
    })
    return walletClient.signMessage({ message })
  }
}
