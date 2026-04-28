import { db } from '../../db/client.js'
import { pockets } from '../../db/schema.js'
import {
  pocketMembers, spendingLimits, approvalRequests, approvalVotes, auditLog,
} from '../../db/schema-multisig.js'
import { eq, and, gte, count } from 'drizzle-orm'
import { notificationsService } from '../notifications.service.js'

export class MultisigService {

  // ── Membership ──────────────────────────────────────────────────────────────

  async inviteMember(pocketId: string, invitedByUserId: string, targetUserId: string, role = 'member') {
    const [member] = await db.insert(pocketMembers)
      .values({ pocketId, userId: targetUserId, role: role as any, invitedBy: invitedByUserId })
      .onConflictDoNothing()
      .returning()

    await this.log(pocketId, invitedByUserId, 'member.invite', { targetUserId, role })
    return member
  }

  async getMembers(pocketId: string) {
    return db.query.pocketMembers.findMany({
      where: eq(pocketMembers.pocketId, pocketId),
      with: { user: { columns: { id: true, email: true } } },
    })
  }

  async removeMember(pocketId: string, removedByUserId: string, targetUserId: string) {
    await db.delete(pocketMembers)
      .where(and(eq(pocketMembers.pocketId, pocketId), eq(pocketMembers.userId, targetUserId)))
    await this.log(pocketId, removedByUserId, 'member.remove', { targetUserId })
  }

  async getMemberRole(pocketId: string, userId: string): Promise<string | null> {
    const member = await db.query.pocketMembers.findFirst({
      where: and(eq(pocketMembers.pocketId, pocketId), eq(pocketMembers.userId, userId)),
    })
    return member?.role ?? null
  }

  // ── Spending limits ─────────────────────────────────────────────────────────

  async setSpendingLimit(
    pocketId: string,
    createdBy: string,
    maxAmountUsd: number,
    windowHours = 24,
    targetUserId?: string,
    token?: string,
  ) {
    const [limit] = await db.insert(spendingLimits)
      .values({
        pocketId,
        userId:       targetUserId,
        maxAmountUsd: String(maxAmountUsd),
        windowHours,
        token,
        createdBy,
      })
      .returning()

    await this.log(pocketId, createdBy, 'limit.set', { maxAmountUsd, windowHours, targetUserId, token })
    return limit
  }

  async getLimits(pocketId: string) {
    return db.query.spendingLimits.findMany({ where: eq(spendingLimits.pocketId, pocketId) })
  }

  // ── Approval requests ────────────────────────────────────────────────────────

  async createApprovalRequest(
    pocketId: string,
    requestedBy: string,
    type: string,
    payload: object,
    requiredApprovals = 2,
  ) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)  // 24h TTL

    const [request] = await db.insert(approvalRequests)
      .values({
        pocketId,
        requestedBy,
        type,
        payload:           JSON.stringify(payload),
        requiredApprovals,
        expiresAt,
      })
      .returning()

    await this.log(pocketId, requestedBy, `${type}.requested`, payload)

    // Notify all admins/owners
    const admins = await db.query.pocketMembers.findMany({
      where: and(eq(pocketMembers.pocketId, pocketId)),
    })
    for (const admin of admins.filter((m) => m.role === 'admin' || m.role === 'owner')) {
      await notificationsService.sendToUser(admin.userId, {
        title: 'Approval required',
        body:  `A ${type} request needs your approval in ${(await this.getPocketName(pocketId))}`,
        data:  { type: 'approval_required', requestId: request.id, pocketId },
      })
    }

    return request
  }

  async vote(requestId: string, userId: string, vote: 'approve' | 'reject', reason?: string) {
    const request = await db.query.approvalRequests.findFirst({
      where: and(eq(approvalRequests.id, requestId), eq(approvalRequests.status, 'pending')),
    })
    if (!request) throw new Error('Request not found or already resolved')
    if (new Date() > request.expiresAt) throw new Error('Request has expired')

    await db.insert(approvalVotes)
      .values({ requestId, userId, vote, reason })
      .onConflictDoUpdate({ target: [approvalVotes.requestId, approvalVotes.userId], set: { vote, reason } })

    await this.log(request.pocketId, userId, `approval.${vote}`, { requestId })

    // Check if threshold reached
    const approveCount = await db.select({ count: count() })
      .from(approvalVotes)
      .where(and(eq(approvalVotes.requestId, requestId), eq(approvalVotes.vote, 'approve')))

    const rejectCount = await db.select({ count: count() })
      .from(approvalVotes)
      .where(and(eq(approvalVotes.requestId, requestId), eq(approvalVotes.vote, 'reject')))

    const approved = Number(approveCount[0].count)
    const rejected = Number(rejectCount[0].count)

    if (approved >= request.requiredApprovals) {
      await db.update(approvalRequests)
        .set({ status: 'approved', resolvedAt: new Date() })
        .where(eq(approvalRequests.id, requestId))
      return { status: 'approved', payload: JSON.parse(request.payload) }
    }

    if (rejected > 0) {
      await db.update(approvalRequests)
        .set({ status: 'rejected', resolvedAt: new Date() })
        .where(eq(approvalRequests.id, requestId))
      return { status: 'rejected' }
    }

    return { status: 'pending', approvals: approved, needed: request.requiredApprovals }
  }

  async getPendingRequests(pocketId: string) {
    return db.query.approvalRequests.findMany({
      where: and(eq(approvalRequests.pocketId, pocketId), eq(approvalRequests.status, 'pending')),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    })
  }

  // ── Audit log ────────────────────────────────────────────────────────────────

  async getAuditLog(pocketId: string, limit = 50) {
    return db.query.auditLog.findMany({
      where: eq(auditLog.pocketId, pocketId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit,
    })
  }

  async log(pocketId: string, userId: string | null, action: string, details: object, ip?: string) {
    await db.insert(auditLog).values({
      pocketId,
      userId:   userId ?? undefined,
      action,
      details: JSON.stringify(details),
      ip,
    })
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async getPocketName(pocketId: string): Promise<string> {
    const pocket = await db.query.pockets.findFirst({ where: eq(pockets.id, pocketId) })
    return pocket?.name ?? 'Pocket'
  }
}

export const multisigService = new MultisigService()
