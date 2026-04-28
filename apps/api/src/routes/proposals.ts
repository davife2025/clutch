import { Hono } from 'hono'
import { db } from '../db/client.js'
import { teamMembers, proposals, auditLog, users } from '../db/schema.js'
import { eq, and, desc } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { priceService } from '../services/price.service.js'
import { pushService } from '../services/push.service.js'
import {
  addApproval, addRejection, deriveStatus,
  canPropose, canSign, proposalExpiresAt,
  isWithinSpendLimit, requiresApproval,
  type TeamPocket, type Proposal, type TeamMember,
} from '@clutch/multisig'

export const proposalRoutes = new Hono()
proposalRoutes.use('*', authMiddleware)

// ── Create proposal ───────────────────────────────────────────────────────────

proposalRoutes.post('/:pocketId', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.param('pocketId')
  const { type, title, description, payload, ttlHours = 72 } = await c.req.json()

  if (!type || !title || !payload) {
    return c.json({ error: { code: 'VALIDATION', message: 'type, title, payload required' } }, 400)
  }

  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamPocketId, pocketId), eq(teamMembers.userId, userId)),
  })
  if (!membership || !canPropose(membership.role)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Your role cannot create proposals' } }, 403)
  }

  const [proposal] = await db.insert(proposals).values({
    teamPocketId: pocketId,
    type,
    title: title.trim(),
    description,
    proposedBy:   userId,
    payload:      JSON.stringify(payload),
    approvals:    '[]',
    rejections:   '[]',
    expiresAt:    proposalExpiresAt(ttlHours),
  }).returning()

  // Notify all signers
  const signers = await db.query.teamMembers.findMany({
    where: and(eq(teamMembers.teamPocketId, pocketId)),
  })
  for (const s of signers) {
    if (s.userId !== userId) {
      pushService.notifyUser(s.userId, 'New proposal', `"${title}" needs your approval`, { proposalId: proposal.id })
        .catch(() => {})
    }
  }

  // Write audit log entry
  await writeAudit(pocketId, userId, 'proposal_created', { title })

  return c.json({ data: { proposal: parseProposal(proposal) } }, 201)
})

// ── List proposals ────────────────────────────────────────────────────────────

proposalRoutes.get('/:pocketId', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.param('pocketId')
  const status   = c.req.query('status')  // optional filter

  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamPocketId, pocketId), eq(teamMembers.userId, userId)),
  })
  if (!membership) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Not a member' } }, 403)
  }

  const rows = await db.query.proposals.findMany({
    where: eq(proposals.teamPocketId, pocketId),
    orderBy: [desc(proposals.createdAt)],
    limit: 50,
  })

  let parsed = rows.map(parseProposal)
  if (status) parsed = parsed.filter((p) => p.status === status)

  return c.json({ data: { proposals: parsed } })
})

// ── Approve proposal ──────────────────────────────────────────────────────────

proposalRoutes.post('/:pocketId/:proposalId/approve', async (c) => {
  const userId     = c.get('userId') as string
  const { pocketId, proposalId } = c.req.param()
  const { signature } = await c.req.json().catch(() => ({}))

  const [membership, proposalRow, pocket] = await Promise.all([
    db.query.teamMembers.findFirst({ where: and(eq(teamMembers.teamPocketId, pocketId), eq(teamMembers.userId, userId)) }),
    db.query.proposals.findFirst({ where: eq(proposals.id, proposalId) }),
    db.query.teamPockets.findFirst({ where: eq((await import('../db/schema.js')).teamPockets.id, pocketId), with: { members: true } }),
  ])

  if (!membership || !canSign(membership.role)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Your role cannot approve proposals' } }, 403)
  }
  if (!proposalRow) return c.json({ error: { code: 'NOT_FOUND', message: 'Proposal not found' } }, 404)

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404)

  const pocketObj = buildPocketObject(pocket!)

  let proposal = parseProposal(proposalRow)
  proposal = addApproval(proposal, pocketObj, userId, user.email, signature)

  await db.update(proposals).set({
    approvals: JSON.stringify(proposal.approvals),
    status:    proposal.status,
    executedAt: proposal.status === 'executed' ? new Date() : undefined,
  }).where(eq(proposals.id, proposalId))

  await writeAudit(pocketId, userId, 'proposal_approved', { proposalId, email: user.email })

  // Notify proposer
  if (proposal.status === 'approved') {
    pushService.notifyUser(proposalRow.proposedBy, 'Proposal approved', `"${proposalRow.title}" has enough signatures`, { proposalId })
      .catch(() => {})
  }

  return c.json({ data: { proposal } })
})

// ── Reject proposal ───────────────────────────────────────────────────────────

proposalRoutes.post('/:pocketId/:proposalId/reject', async (c) => {
  const userId     = c.get('userId') as string
  const { pocketId, proposalId } = c.req.param()

  const [membership, proposalRow, pocket] = await Promise.all([
    db.query.teamMembers.findFirst({ where: and(eq(teamMembers.teamPocketId, pocketId), eq(teamMembers.userId, userId)) }),
    db.query.proposals.findFirst({ where: eq(proposals.id, proposalId) }),
    db.query.teamPockets.findFirst({ where: eq((await import('../db/schema.js')).teamPockets.id, pocketId), with: { members: true } }),
  ])

  if (!membership || !canSign(membership.role)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Your role cannot reject proposals' } }, 403)
  }
  if (!proposalRow) return c.json({ error: { code: 'NOT_FOUND', message: 'Proposal not found' } }, 404)

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user) return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404)

  let proposal = parseProposal(proposalRow)
  proposal = addRejection(proposal, buildPocketObject(pocket!), userId, user.email)

  await db.update(proposals).set({
    rejections: JSON.stringify(proposal.rejections),
    status:     proposal.status,
  }).where(eq(proposals.id, proposalId))

  await writeAudit(pocketId, userId, 'proposal_rejected', { proposalId, email: user.email })

  return c.json({ data: { proposal } })
})

// ── Get audit log ─────────────────────────────────────────────────────────────

proposalRoutes.get('/:pocketId/audit', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.param('pocketId')

  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamPocketId, pocketId), eq(teamMembers.userId, userId)),
  })
  if (!membership) return c.json({ error: { code: 'FORBIDDEN', message: 'Not a member' } }, 403)

  const entries = await db.query.auditLog.findMany({
    where: eq(auditLog.teamPocketId, pocketId),
    orderBy: [desc(auditLog.ts)],
    limit: 100,
  })

  return c.json({ data: { entries } })
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseProposal(row: any): Proposal {
  return {
    ...row,
    payload:    typeof row.payload    === 'string' ? JSON.parse(row.payload)    : row.payload,
    approvals:  typeof row.approvals  === 'string' ? JSON.parse(row.approvals)  : (row.approvals  ?? []),
    rejections: typeof row.rejections === 'string' ? JSON.parse(row.rejections) : (row.rejections ?? []),
  }
}

function buildPocketObject(row: any): TeamPocket {
  return {
    id:        row.id,
    name:      row.name,
    threshold: row.threshold,
    createdBy: row.createdBy,
    chain:     row.chain,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    members:   (row.members ?? []).map((m: any): TeamMember => ({
      userId:        m.userId,
      email:         '',
      role:          m.role,
      joinedAt:      m.joinedAt,
      spendLimitUsd: m.spendLimitUsd ?? null,
    })),
  }
}

async function writeAudit(
  teamPocketId: string,
  actorId: string,
  action: string,
  metadata: Record<string, unknown> = {},
) {
  const actor = await db.query.users.findFirst({ where: eq(users.id, actorId) })
  if (!actor) return
  await db.insert(auditLog).values({
    teamPocketId,
    action,
    actorId,
    actorEmail: actor.email,
    description: `${action.replace(/_/g, ' ')} by ${actor.email}`,
    metadata: JSON.stringify(metadata),
  })
}
