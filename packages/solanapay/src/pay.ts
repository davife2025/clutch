/**
 * @clutch/solanapay — Solana Pay protocol implementation.
 *
 * Solana Pay is an open standard for point-of-sale and commerce payments on Solana.
 * Spec: https://docs.solanapay.com
 *
 * Two request types:
 *   1. Transfer Request  — simple SOL/SPL token transfer (URI encodes amount, recipient, memo)
 *   2. Transaction Request — arbitrary transaction from a server endpoint (NFT mints, swaps, etc.)
 */

import { SPL_DECIMALS, TOKEN_MINTS } from './constants.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TransferRequest {
  /** Recipient Solana address */
  recipient:   string
  /** Amount in token units (e.g. 1.5 SOL, 10 USDC) */
  amount?:     number
  /** SPL token mint. Omit for native SOL. */
  splToken?:   string
  /** Payment reference — random public key used to find the tx on-chain */
  reference?:  string | string[]
  /** Merchant / item label shown in wallet */
  label?:      string
  /** Short message shown in wallet */
  message?:    string
  /** Arbitrary memo written to the chain */
  memo?:       string
}

export interface TransactionRequest {
  /** HTTPS URL that returns a Solana transaction when POSTed to */
  link:        string
  /** Label shown in wallet */
  label?:      string
  /** Message shown in wallet */
  message?:    string
}

export interface PaymentLink {
  uri:         string     // solana:<recipient>[?amount=...&spl-token=...]
  qrData:      string     // same URI, encoded for QR
  shortUrl?:   string     // optional short link
}

export interface ParsedPaymentUri {
  type:        'transfer' | 'transaction'
  transfer?:   TransferRequest
  transaction?: TransactionRequest
}

export interface PaymentRecord {
  id:          string
  reference:   string   // on-chain reference public key
  recipient:   string
  amount:      number
  token:       string
  label?:      string
  memo?:       string
  status:      'pending' | 'confirmed' | 'expired'
  txHash?:     string
  createdAt:   Date
  confirmedAt?: Date
  expiresAt:   Date
}

export interface PosSession {
  id:          string
  merchantName: string
  merchantAddress: string
  items:       PosItem[]
  total:       number     // USD
  token:       'SOL' | 'USDC'
  createdAt:   Date
  status:      'open' | 'paid' | 'cancelled'
}

export interface PosItem {
  name:        string
  price:       number   // USD
  quantity:    number
  imageUrl?:   string
}

// ── URI builder ───────────────────────────────────────────────────────────────

/**
 * Build a Solana Pay Transfer Request URI.
 *
 * Format: solana:<recipient>?amount=<amount>&spl-token=<mint>&reference=<ref>&label=<label>&message=<msg>&memo=<memo>
 */
export function buildTransferUri(request: TransferRequest): string {
  const url = new URL(`solana:${request.recipient}`)

  if (request.amount !== undefined) {
    url.searchParams.set('amount', request.amount.toString())
  }
  if (request.splToken) {
    url.searchParams.set('spl-token', request.splToken)
  }
  if (request.reference) {
    const refs = Array.isArray(request.reference) ? request.reference : [request.reference]
    refs.forEach(r => url.searchParams.append('reference', r))
  }
  if (request.label)   url.searchParams.set('label',   encodeURIComponent(request.label))
  if (request.message) url.searchParams.set('message', encodeURIComponent(request.message))
  if (request.memo)    url.searchParams.set('memo',    encodeURIComponent(request.memo))

  return url.toString()
}

/**
 * Build a Solana Pay Transaction Request URI.
 *
 * Format: solana:<url>
 */
export function buildTransactionUri(request: TransactionRequest): string {
  const url = new URL(`solana:${encodeURIComponent(request.link)}`)
  if (request.label)   url.searchParams.set('label',   encodeURIComponent(request.label))
  if (request.message) url.searchParams.set('message', encodeURIComponent(request.message))
  return url.toString()
}

/**
 * Parse a Solana Pay URI into a typed request.
 */
export function parseUri(uri: string): ParsedPaymentUri | null {
  if (!uri.startsWith('solana:')) return null

  const withoutScheme = uri.slice(7)

  // Transaction request: starts with https://
  if (withoutScheme.startsWith('https%3A') || withoutScheme.startsWith('https://')) {
    const decoded = decodeURIComponent(withoutScheme.split('?')[0])
    return {
      type: 'transaction',
      transaction: { link: decoded },
    }
  }

  // Transfer request: starts with a public key (base58)
  const qmarkIdx  = withoutScheme.indexOf('?')
  const recipient = qmarkIdx >= 0 ? withoutScheme.slice(0, qmarkIdx) : withoutScheme
  const params    = new URLSearchParams(qmarkIdx >= 0 ? withoutScheme.slice(qmarkIdx + 1) : '')

  const refs = params.getAll('reference')

  return {
    type: 'transfer',
    transfer: {
      recipient,
      amount:    params.get('amount') ? parseFloat(params.get('amount')!) : undefined,
      splToken:  params.get('spl-token') ?? undefined,
      reference: refs.length === 1 ? refs[0] : refs.length > 1 ? refs : undefined,
      label:     params.get('label')   ? decodeURIComponent(params.get('label')!)   : undefined,
      message:   params.get('message') ? decodeURIComponent(params.get('message')!) : undefined,
      memo:      params.get('memo')    ? decodeURIComponent(params.get('memo')!)    : undefined,
    },
  }
}

// ── Payment link factory ──────────────────────────────────────────────────────

/**
 * Create a complete payment link with a unique reference key.
 * The reference is used to find the transaction on-chain after payment.
 */
export function createPaymentLink(request: TransferRequest): PaymentLink {
  // Generate a reference if not provided
  const reference = request.reference ?? generateReference()
  const withRef   = { ...request, reference }
  const uri       = buildTransferUri(withRef)

  return {
    uri,
    qrData:   uri,   // QR code libraries accept the raw URI
  }
}

function generateReference(): string {
  // In production: use Keypair.generate().publicKey.toBase58() from @solana/web3.js
  // Stub — returns a random-looking base58 string
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  return Array.from({ length: 44 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ── POS session builder ───────────────────────────────────────────────────────

export function createPosSession(params: {
  merchantName:    string
  merchantAddress: string
  items:           PosItem[]
  token:           'SOL' | 'USDC'
  solPriceUsd?:    number
}): PosSession {
  const totalUsd = params.items.reduce((s, i) => s + i.price * i.quantity, 0)

  return {
    id:               generateReference().slice(0, 12),
    merchantName:     params.merchantName,
    merchantAddress:  params.merchantAddress,
    items:            params.items,
    total:            totalUsd,
    token:            params.token,
    createdAt:        new Date(),
    status:           'open',
  }
}

/**
 * Convert a POS session total to a Solana Pay transfer URI.
 */
export function posSessionToUri(
  session:     PosSession,
  solPriceUsd: number,
): PaymentLink {
  let amount: number
  let splToken: string | undefined

  if (session.token === 'USDC') {
    amount   = session.total
    splToken = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'  // USDC mainnet
  } else {
    amount   = session.total / solPriceUsd
  }

  return createPaymentLink({
    recipient: session.merchantAddress,
    amount,
    splToken,
    label:   session.merchantName,
    message: `Payment #${session.id}`,
    memo:    `clutch-pos:${session.id}`,
  })
}

// ── Transaction verification ───────────────────────────────────────────────────

/**
 * Check if a Solana Pay payment has been confirmed on-chain.
 * Looks for a transaction containing the reference public key.
 *
 * Full implementation uses @solana/pay:
 *   import { findReference, validateTransfer } from '@solana/pay'
 */
export async function checkPaymentConfirmed(
  reference: string,
  rpcUrl:    string,
): Promise<{ confirmed: boolean; txHash?: string }> {
  try {
    const res = await fetch(rpcUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method:  'getSignaturesForAddress',
        params:  [reference, { limit: 5, commitment: 'confirmed' }],
      }),
      signal: AbortSignal.timeout(8000),
    })

    const data = await res.json() as { result: any[] }
    const sigs = data.result ?? []

    if (sigs.length > 0 && !sigs[0].err) {
      return { confirmed: true, txHash: sigs[0].signature }
    }

    return { confirmed: false }
  } catch {
    return { confirmed: false }
  }
}
