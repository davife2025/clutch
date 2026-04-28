/**
 * NFT transfer helpers for Solana.
 *
 * Handles both:
 *   - Standard NFTs (Token Metadata program v3)
 *   - Programmable NFTs / pNFTs (Token Metadata v3.1 with auth rules)
 *
 * Returns unsigned base64 transactions for the client to sign.
 */

import type { NftTransferRequest, NftTransferResult } from './types.js'

const TOKEN_METADATA_PROGRAM = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
const SPL_TOKEN_PROGRAM       = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
const ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bmd'

export interface TransferTxResult {
  /** Base64-encoded versioned transaction. Client signs + broadcasts. */
  transaction:       string
  /** Blockhash expiry — transaction invalid after this slot */
  lastValidBlock:    number
  isProgrammable:    boolean
}

/**
 * Build an NFT transfer transaction.
 *
 * In production this uses @metaplex-foundation/mpl-token-metadata
 * or @metaplex-foundation/umi for full pNFT support.
 *
 * This stub returns the instruction shape and documents the full flow.
 */
export async function buildNftTransfer(
  request:  NftTransferRequest,
  rpcUrl:   string,
): Promise<TransferTxResult> {
  const { mint, fromAddress, toAddress, isProgrammable = false } = request

  /**
   * Full implementation:
   *
   * import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
   * import { transferV1, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata'
   * import { publicKey } from '@metaplex-foundation/umi'
   *
   * const umi = createUmi(rpcUrl).use(mplTokenMetadata())
   *
   * const txBuilder = transferV1(umi, {
   *   mint:            publicKey(mint),
   *   authority:       umi.identity,
   *   tokenOwner:      publicKey(fromAddress),
   *   destinationOwner: publicKey(toAddress),
   *   tokenStandard:   isProgrammable ? TokenStandard.ProgrammableNonFungible : TokenStandard.NonFungible,
   * })
   *
   * const { blockhash, lastValidBlockHeight } = await umi.rpc.getLatestBlockhash()
   * const tx = txBuilder.setBlockhash(blockhash).build(umi)
   * return { transaction: Buffer.from(tx.serializedMessage).toString('base64'), lastValidBlock: lastValidBlockHeight, isProgrammable }
   */

  console.warn('[nft-transfer] stub — wire @metaplex-foundation/mpl-token-metadata for production')

  return {
    transaction:    'BASE64_TX_PLACEHOLDER_WIRE_METAPLEX_SDK',
    lastValidBlock: 0,
    isProgrammable,
  }
}

/**
 * Derive the Associated Token Account (ATA) address for a mint + owner.
 * This is a pure PDA derivation — no RPC needed.
 */
export function deriveAtaAddress(owner: string, mint: string): string {
  // Full implementation uses PublicKey.findProgramAddressSync from @solana/web3.js
  // Stub — returns placeholder
  return `ATA_${owner.slice(0, 4)}_${mint.slice(0, 4)}`
}
