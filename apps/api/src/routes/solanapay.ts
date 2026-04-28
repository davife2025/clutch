import { Hono } from 'hono'
import { db } from '../db/client.js'
import { pockets, wallets } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { priceService } from '../services/price.service.js'
import {
  buildTransferUri, parseUri, createPaymentLink,
  createPosSession, posSessionToUri, checkPaymentConfirmed,
  type TransferRequest, type PosItem,
} from '@clutch/solanapay'

export const solanaPayRoutes = new Hono()
solanaPayRoutes.use('*', authMiddleware)

// In-memory POS session store (move to DB in production)
const posSessions  = new Map<string, any>()
const paymentLinks = new Map<string, any>()

// ── Payment links ─────────────────────────────────────────────────────────────

/**
 * POST /pay/link
 * Create a Solana Pay payment link with a unique reference.
 */
solanaPayRoutes.post('/link', async (c) => {
  const userId = c.get('userId') as string
  const { recipient, amount, token = 'SOL', label, message, memo } = await c.req.json()

  if (!recipient) {
    return c.json({ error: { code: 'VALIDATION', message: 'recipient is required' } }, 400)
  }

  let splToken: string | undefined
  if (token === 'USDC') splToken = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  else if (token === 'USDT') splToken = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'

  const link = createPaymentLink({ recipient, amount, splToken, label, message, memo })

  // Store for status polling
  const record = {
    ...link,
    userId,
    recipient,
    amount,
    token,
    label,
    status:    'pending',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),  // 30 min
  }
  paymentLinks.set(link.uri, record)

  return c.json({ data: { link, token, amount } }, 201)
})

/**
 * GET /pay/link/status?uri=solana:...
 * Poll payment status — checks on-chain for the reference public key.
 */
solanaPayRoutes.get('/link/status', async (c) => {
  const uri = c.req.query('uri')
  if (!uri) return c.json({ error: { code: 'VALIDATION', message: 'uri required' } }, 400)

  const parsed = parseUri(uri)
  if (!parsed?.transfer?.reference) {
    return c.json({ error: { code: 'INVALID_URI', message: 'No reference found in URI' } }, 400)
  }

  const ref = Array.isArray(parsed.transfer.reference)
    ? parsed.transfer.reference[0]
    : parsed.transfer.reference

  const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com'
  const result = await checkPaymentConfirmed(ref, rpcUrl)

  const stored = paymentLinks.get(uri)
  if (stored && result.confirmed) {
    stored.status    = 'confirmed'
    stored.txHash    = result.txHash
    stored.confirmedAt = new Date()
  }

  return c.json({
    data: {
      confirmed: result.confirmed,
      txHash:    result.txHash ?? null,
      status:    stored?.status ?? (result.confirmed ? 'confirmed' : 'pending'),
    }
  })
})

/**
 * GET /pay/parse?uri=solana:...
 * Parse a Solana Pay URI into a human-readable object.
 */
solanaPayRoutes.get('/parse', async (c) => {
  const uri = c.req.query('uri')
  if (!uri) return c.json({ error: { code: 'VALIDATION', message: 'uri required' } }, 400)

  const parsed = parseUri(uri)
  if (!parsed) return c.json({ error: { code: 'INVALID_URI', message: 'Not a valid Solana Pay URI' } }, 400)

  return c.json({ data: { parsed } })
})

// ── Point of sale ─────────────────────────────────────────────────────────────

/**
 * POST /pay/pos
 * Create a new POS checkout session.
 */
solanaPayRoutes.post('/pos', async (c) => {
  const userId = c.get('userId') as string
  const { merchantName, merchantAddress, items, token = 'USDC' } = await c.req.json()

  if (!merchantName || !merchantAddress || !items?.length) {
    return c.json({ error: { code: 'VALIDATION', message: 'merchantName, merchantAddress, items required' } }, 400)
  }

  const solPrice  = await priceService.getUsdPrice('SOL') ?? 150
  const session   = createPosSession({ merchantName, merchantAddress, items, token, solPriceUsd: solPrice })
  const payLink   = posSessionToUri(session, solPrice)

  const stored = { ...session, paymentUri: payLink.uri, solPrice, userId }
  posSessions.set(session.id, stored)

  return c.json({ data: { session: stored, paymentUri: payLink.uri, qrData: payLink.qrData } }, 201)
})

/**
 * GET /pay/pos/:sessionId
 * Get a POS session and its current payment status.
 */
solanaPayRoutes.get('/pos/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')
  const session   = posSessions.get(sessionId)
  if (!session) return c.json({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, 404)
  return c.json({ data: { session } })
})

/**
 * POST /pay/pos/:sessionId/check
 * Poll for payment confirmation on a POS session.
 */
solanaPayRoutes.post('/pos/:sessionId/check', async (c) => {
  const sessionId = c.req.param('sessionId')
  const session   = posSessions.get(sessionId)
  if (!session) return c.json({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, 404)

  if (session.status === 'paid') {
    return c.json({ data: { paid: true, session } })
  }

  const parsed = parseUri(session.paymentUri)
  const ref    = parsed?.transfer?.reference
  if (!ref) return c.json({ data: { paid: false } })

  const refStr = Array.isArray(ref) ? ref[0] : ref
  const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com'
  const result = await checkPaymentConfirmed(refStr, rpcUrl)

  if (result.confirmed) {
    session.status      = 'paid'
    session.txHash      = result.txHash
    session.paidAt      = new Date()
    posSessions.set(sessionId, session)
  }

  return c.json({ data: { paid: result.confirmed, txHash: result.txHash ?? null, session } })
})

/**
 * DELETE /pay/pos/:sessionId
 * Cancel a POS session.
 */
solanaPayRoutes.delete('/pos/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')
  const session   = posSessions.get(sessionId)
  if (!session) return c.json({ error: { code: 'NOT_FOUND', message: 'Session not found' } }, 404)

  session.status = 'cancelled'
  posSessions.set(sessionId, session)
  return c.json({ data: { cancelled: true } })
})

// ── Transaction Request endpoint (merchant server) ────────────────────────────

/**
 * GET /pay/tx-request/:sessionId
 * Solana Pay Transaction Request — called by wallets to get the transaction.
 * Returns { label, icon } on GET, returns { transaction } on POST.
 */
solanaPayRoutes.get('/tx-request/:sessionId', (c) => {
  const sessionId = c.req.param('sessionId')
  const session   = posSessions.get(sessionId)
  if (!session) return c.json({ error: 'Session not found' }, 404)

  return c.json({
    label:   session.merchantName,
    icon:    `${process.env.API_URL ?? 'http://localhost:3001'}/icons/clutch.png`,
  })
})

solanaPayRoutes.post('/tx-request/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')
  const session   = posSessions.get(sessionId)
  if (!session) return c.json({ error: 'Session not found' }, 404)

  const { account } = await c.req.json()  // payer's public key

  // In production: build the actual transfer transaction here using @solana/web3.js
  // For now, return the payment URI as a transfer instruction hint
  return c.json({
    transaction: 'BASE64_TX_PLACEHOLDER_BUILD_WITH_SOLANA_WEB3',
    message:     `Pay ${session.total} ${session.token} to ${session.merchantName}`,
  })
})
