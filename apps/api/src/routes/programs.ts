import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import {
  KNOWN_PROGRAMS, fetchIdl, createAccountReader,
  type KnownProgram,
} from '@clutch/anchor'

export const programRoutes = new Hono()
programRoutes.use('*', authMiddleware)

const RPC    = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com'
const reader = createAccountReader(RPC)

// ── Known programs ────────────────────────────────────────────────────────────

/**
 * GET /programs
 * List all pre-integrated known programs.
 */
programRoutes.get('/', (c) => {
  const category = c.req.query('category')
  const programs = category
    ? KNOWN_PROGRAMS.filter(p => p.category === category)
    : KNOWN_PROGRAMS
  return c.json({ data: { programs } })
})

/**
 * GET /programs/categories
 * Distinct program categories.
 */
programRoutes.get('/categories', (c) => {
  const categories = [...new Set(KNOWN_PROGRAMS.map(p => p.category))]
  return c.json({ data: { categories } })
})

// ── IDL explorer ──────────────────────────────────────────────────────────────

/**
 * GET /programs/idl/:programId
 * Fetch the Anchor IDL for any program.
 */
programRoutes.get('/idl/:programId', async (c) => {
  const programId = c.req.param('programId')

  const idl = await fetchIdl(programId, RPC)

  if (!idl) {
    return c.json({
      error: {
        code:    'IDL_NOT_FOUND',
        message: 'No IDL found for this program. It may not be an Anchor program, or the IDL may not be on-chain.',
      }
    }, 404)
  }

  const known = KNOWN_PROGRAMS.find(p => p.programId === programId)

  return c.json({
    data: {
      idl,
      known:        known ?? null,
      instructions: idl.instructions.map(ix => ({
        name:     ix.name,
        argCount: ix.args.length,
        accounts: ix.accounts.length,
        docs:     ix.docs?.[0] ?? null,
      })),
      accountTypes: (idl.accounts ?? []).map(a => ({
        name:       a.name,
        fieldCount: a.type.fields.length,
      })),
    }
  })
})

// ── Account reader ────────────────────────────────────────────────────────────

/**
 * GET /programs/account/:address
 * Fetch raw account data for any on-chain address.
 */
programRoutes.get('/account/:address', async (c) => {
  const address   = c.req.param('address')
  const withDecode = c.req.query('decode') === 'true'

  const account = await reader.getAccount(address)
  if (!account) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Account not found or empty' } }, 404)
  }

  // Try to identify the owner program
  const known = KNOWN_PROGRAMS.find(p => p.programId === account.owner)

  return c.json({ data: { account, owner: known ?? { programId: account.owner } } })
})

/**
 * POST /programs/accounts
 * Fetch multiple accounts at once.
 * Body: { addresses: string[] }
 */
programRoutes.post('/accounts', async (c) => {
  const { addresses } = await c.req.json()

  if (!Array.isArray(addresses) || addresses.length === 0) {
    return c.json({ error: { code: 'VALIDATION', message: 'addresses array required' } }, 400)
  }

  if (addresses.length > 100) {
    return c.json({ error: { code: 'VALIDATION', message: 'Max 100 addresses per request' } }, 400)
  }

  const accounts = await reader.getMultipleAccounts(addresses)
  return c.json({ data: { accounts } })
})

/**
 * GET /programs/:programId/accounts?limit=20
 * List accounts owned by a program.
 */
programRoutes.get('/:programId/accounts', async (c) => {
  const programId = c.req.param('programId')
  const limit     = Math.min(parseInt(c.req.query('limit') ?? '20'), 100)

  const result = await reader.getProgramAccounts(programId, [], limit)
  return c.json({ data: result })
})

/**
 * GET /programs/search?q=drift
 * Search known programs by name.
 */
programRoutes.get('/search', (c) => {
  const q = (c.req.query('q') ?? '').toLowerCase()
  if (!q) return c.json({ data: { programs: KNOWN_PROGRAMS } })

  const results = KNOWN_PROGRAMS.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.description.toLowerCase().includes(q) ||
    p.programId.toLowerCase().includes(q)
  )
  return c.json({ data: { programs: results } })
})
