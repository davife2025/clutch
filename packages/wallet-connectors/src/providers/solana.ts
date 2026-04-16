import {
  Connection, PublicKey, LAMPORTS_PER_SOL,
  Transaction, SystemProgram, sendAndConfirmTransaction,
  Keypair,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddress, getAccount,
  createTransferInstruction, TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import type { WalletConnector, SigningConnector, TokenBalance, TxRequest, TxReceipt } from '../connector.js'
import { ChainId } from '@clutch/core'
import bs58 from 'bs58'

// Well-known SPL token mints on mainnet
const KNOWN_SPL_TOKENS: Array<{ symbol: string; mint: string; decimals: number }> = [
  { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  { symbol: 'USDT', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
  { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 },
  { symbol: 'JUP',  mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',  decimals: 6 },
]

export class SolanaConnector implements SigningConnector {
  readonly chain: ChainId = 'solana'
  readonly name = 'Solana'
  private connection: Connection

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, 'confirmed')
  }

  async ping(): Promise<boolean> {
    try {
      await this.connection.getSlot()
      return true
    } catch {
      return false
    }
  }

  async getNativeBalance(address: string): Promise<bigint> {
    const pubkey = new PublicKey(address)
    const lamports = await this.connection.getBalance(pubkey)
    return BigInt(lamports)
  }

  async getBalances(address: string): Promise<TokenBalance[]> {
    const pubkey = new PublicKey(address)
    const results: TokenBalance[] = []

    // SOL native balance (in lamports, 9 decimals)
    const lamports = await this.connection.getBalance(pubkey)
    results.push({
      token: 'SOL',
      amount: BigInt(lamports),
      decimals: 9,
    })

    // SPL tokens
    const tokenResults = await Promise.allSettled(
      KNOWN_SPL_TOKENS.map(async (token) => {
        try {
          const mint = new PublicKey(token.mint)
          const ata = await getAssociatedTokenAddress(mint, pubkey)
          const account = await getAccount(this.connection, ata)

          if (account.amount > BigInt(0)) {
            results.push({
              token: token.symbol,
              amount: account.amount,
              decimals: token.decimals,
              contractAddress: token.mint,
            })
          }
        } catch {
          // Token account doesn't exist — wallet doesn't hold this token
        }
      })
    )

    return results
  }

  async estimateGas(_request: TxRequest): Promise<bigint> {
    // Solana uses a flat fee model (~5000 lamports per signature)
    const { feeCalculator } = await this.connection.getRecentBlockhash()
    return BigInt(feeCalculator?.lamportsPerSignature ?? 5000)
  }

  async sendTransaction(request: TxRequest, privateKeyBase58: string): Promise<TxReceipt> {
    const secretKey = bs58.decode(privateKeyBase58)
    const keypair = Keypair.fromSecretKey(secretKey)
    const toPubkey = new PublicKey(request.to)

    const transaction = new Transaction()

    if (request.token === 'SOL') {
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey,
          lamports: Number(request.amount),
        })
      )
    } else {
      // SPL token transfer
      const tokenInfo = KNOWN_SPL_TOKENS.find((t) => t.symbol === request.token)
      if (!tokenInfo) throw new Error(`Unknown SPL token: ${request.token}`)

      const mint = new PublicKey(tokenInfo.mint)
      const fromAta = await getAssociatedTokenAddress(mint, keypair.publicKey)
      const toAta = await getAssociatedTokenAddress(mint, toPubkey)

      transaction.add(
        createTransferInstruction(
          fromAta,
          toAta,
          keypair.publicKey,
          request.amount,
          [],
          TOKEN_PROGRAM_ID
        )
      )
    }

    const txHash = await sendAndConfirmTransaction(this.connection, transaction, [keypair])
    const txInfo = await this.connection.getTransaction(txHash, { commitment: 'confirmed' })

    return {
      txHash,
      blockNumber: BigInt(txInfo?.slot ?? 0),
      gasUsed: BigInt(txInfo?.meta?.fee ?? 5000),
      status: txInfo?.meta?.err ? 'reverted' : 'success',
    }
  }

  async signMessage(message: string, privateKeyBase58: string): Promise<string> {
    const secretKey = bs58.decode(privateKeyBase58)
    const keypair = Keypair.fromSecretKey(secretKey)
    const encoded = new TextEncoder().encode(message)
    const signature = keypair.sign(encoded)
    return bs58.encode(signature)
  }
}
