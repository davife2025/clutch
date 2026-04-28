import { Hono } from 'hono'
import { db } from '../db/client.js'
import { users, teamPockets, teamMembers } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { canManageMembers, canView } from '@clutch/multisig'

export const teamRoutes = new Hono()
teamRoutes.use('*', authMiddleware)

// ── Create team pocket ────────────────────────────────────────────────────────

teamRoutes.post('/', async (c) => {
  const userId = c.get('userId') as string
  const { name, description, threshold = 2, chain = 'solana' } = await c.req.json()

  if (!name?.trim()) {
    return c.json({ error: { code: 'VALIDATION', message: 'name is required' } }, 400)
  }
  if (threshold < 1) {
    return c.json({ error: { code: 'VALIDATION', message: 'threshold must be at least 1' } }, 400)
  }

  const [pocket] = await db.insert(teamPockets)
    .values({ name: name.trim(), description, threshold, createdBy: userId, chain })
    .returning()

  // Creator is automatically an owner member
  await db.insert(teamMembers).values({
    teamPocketId: pocket.id,
    userId,
    role: 'owner',
    spendLimitUsd: null,
  })

  return c.json({ data: { pocket } }, 201)
})

// ── List team pockets for user ────────────────────────────────────────────────

teamRoutes.get('/', async (c) => {
  const userId = c.get('userId') as string

  const memberships = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    with: {
      teamPocket: {
        with: { members: true }
      }
    },
  })

  const pockets = memberships.map((m) => ({
    ...(m as any).teamPocket,
    myRole: m.role,
    mySpendLimit: m.spendLimitUsd,
  }))

  return c.json({ data: { pockets } })
})

// ── Get team pocket ───────────────────────────────────────────────────────────

teamRoutes.get('/:id', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.param('id')

  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamPocketId, pocketId), eq(teamMembers.userId, userId)),
  })
  if (!membership) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Team pocket not found or not a member' } }, 404)
  }

  const pocket = await db.query.teamPockets.findFirst({
    where: eq(teamPockets.id, pocketId),
    with: { members: true },
  })

  return c.json({ data: { pocket, myRole: membership.role } })
})

// ── Update team pocket ────────────────────────────────────────────────────────

teamRoutes.patch('/:id', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.param('id')
  const { name, description } = await c.req.json()

  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamPocketId, pocketId), eq(teamMembers.userId, userId)),
  })
  if (!membership || !canManageMembers(membership.role)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only owners and admins can edit the pocket' } }, 403)
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (name)        updates.name        = name.trim()
  if (description !== undefined) updates.description = description

  const [updated] = await db.update(teamPockets).set(updates).where(eq(teamPockets.id, pocketId)).returning()
  return c.json({ data: { pocket: updated } })
})

// ── Delete team pocket ────────────────────────────────────────────────────────

teamRoutes.delete('/:id', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.param('id')

  const pocket = await db.query.teamPockets.findFirst({
    where: and(eq(teamPockets.id, pocketId), eq(teamPockets.createdBy, userId)),
  })
  if (!pocket) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only the creator can delete the pocket' } }, 403)
  }

  await db.delete(teamPockets).where(eq(teamPockets.id, pocketId))
  return c.json({ data: { deleted: true } })
})

// ── Add member ────────────────────────────────────────────────────────────────

teamRoutes.post('/:id/members', async (c) => {
  const userId   = c.get('userId') as string
  const pocketId = c.req.param('id')
  const { email, role = 'signer', spendLimitUsd = null } = await c.req.json()

  if (!email) {
    return c.json({ error: { code: 'VALIDATION', message: 'email is required' } }, 400)
  }

  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamPocketId, pocketId), eq(teamMembers.userId, userId)),
  })
  if (!membership || !canManageMembers(membership.role)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only owners and admins can add members' } }, 403)
  }

  const invitee = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (!invitee) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found — they must register first' } }, 404)
  }

  const existing = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamPocketId, pocketId), eq(teamMembers.userId, invitee.id)),
  })
  if (existing) {
    return c.json({ error: { code: 'CONFLICT', message: 'User is already a member' } }, 409)
  }

  const [member] = await db.insert(teamMembers)
    .values({ teamPocketId: pocketId, userId: invitee.id, role, spendLimitUsd })
    .returning()

  return c.json({ data: { member } }, 201)
})

// ── Remove member ─────────────────────────────────────────────────────────────

teamRoutes.delete('/:id/members/:memberId', async (c) => {
  const userId   = c.get('userId') as string
  const { id: pocketId, memberId } = c.req.param()

  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamPocketId, pocketId), eq(teamMembers.userId, userId)),
  })
  if (!membership || !canManageMembers(membership.role)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only owners and admins can remove members' } }, 403)
  }

  const target = await db.query.teamMembers.findFirst({ where: eq(teamMembers.id, memberId) })
  if (target?.role === 'owner') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Cannot remove the pocket owner' } }, 403)
  }

  await db.delete(teamMembers).where(eq(teamMembers.id, memberId))
  return c.json({ data: { removed: true } })
})

// ── Update member role / limit ────────────────────────────────────────────────

teamRoutes.patch('/:id/members/:memberId', async (c) => {
  const userId   = c.get('userId') as string
  const { id: pocketId, memberId } = c.req.param()
  const { role, spendLimitUsd } = await c.req.json()

  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamPocketId, pocketId), eq(teamMembers.userId, userId)),
  })
  if (!membership || !canManageMembers(membership.role)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Only owners and admins can update members' } }, 403)
  }

  const updates: Record<string, unknown> = {}
  if (role !== undefined)          updates.role          = role
  if (spendLimitUsd !== undefined) updates.spendLimitUsd = spendLimitUsd

  const [updated] = await db.update(teamMembers).set(updates).where(eq(teamMembers.id, memberId)).returning()
  return c.json({ data: { member: updated } })
})
