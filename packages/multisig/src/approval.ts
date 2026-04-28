import type {
  TeamPocket, Proposal, Approval, TeamMember,
  ProposalStatus, MemberRole, SpendingWindow,
} from './types.js'

// ── Approval engine ───────────────────────────────────────────────────────────

/**
 * Check whether a proposal has reached the approval threshold.
 */
export function isApproved(proposal: Proposal, pocket: TeamPocket): boolean {
  return proposal.approvals.length >= pocket.threshold
}

/**
 * Check whether a proposal has been rejected by enough members that it
 * can never reach threshold (strict majority of signers rejected).
 */
export function isRejectedIrrevocably(proposal: Proposal, pocket: TeamPocket): boolean {
  const signers   = pocket.members.filter((m) => canSign(m.role))
  const maxRemaining = signers.length - proposal.rejections.length
  return maxRemaining < pocket.threshold
}

/**
 * Check whether a proposal has expired.
 */
export function isExpired(proposal: Proposal): boolean {
  return new Date() > proposal.expiresAt
}

/**
 * Derive the current status of a proposal from its state.
 */
export function deriveStatus(proposal: Proposal, pocket: TeamPocket): ProposalStatus {
  if (proposal.status === 'executed') return 'executed'
  if (isExpired(proposal))              return 'expired'
  if (isRejectedIrrevocably(proposal, pocket)) return 'rejected'
  if (isApproved(proposal, pocket))     return 'approved'
  return 'pending'
}

/**
 * Add an approval to a proposal. Returns updated proposal.
 */
export function addApproval(
  proposal: Proposal,
  pocket:   TeamPocket,
  userId:   string,
  email:    string,
  signature?: string,
): Proposal {
  if (proposal.status !== 'pending') {
    throw new Error(`Cannot approve a ${proposal.status} proposal`)
  }
  if (isExpired(proposal)) {
    throw new Error('Proposal has expired')
  }
  if (proposal.approvals.some((a) => a.userId === userId)) {
    throw new Error('Already approved')
  }

  const member = pocket.members.find((m) => m.userId === userId)
  if (!member) throw new Error('Not a member of this pocket')
  if (!canSign(member.role)) throw new Error('Your role cannot approve proposals')

  const approval: Approval = { userId, email, signedAt: new Date(), signature }
  const updated: Proposal  = {
    ...proposal,
    approvals: [...proposal.approvals, approval],
  }

  updated.status = deriveStatus(updated, pocket)
  return updated
}

/**
 * Add a rejection to a proposal. Returns updated proposal.
 */
export function addRejection(
  proposal: Proposal,
  pocket:   TeamPocket,
  userId:   string,
  email:    string,
): Proposal {
  if (proposal.status !== 'pending') {
    throw new Error(`Cannot reject a ${proposal.status} proposal`)
  }

  const member = pocket.members.find((m) => m.userId === userId)
  if (!member) throw new Error('Not a member of this pocket')
  if (!canSign(member.role)) throw new Error('Your role cannot reject proposals')

  if (proposal.rejections.some((r) => r.userId === userId)) {
    throw new Error('Already rejected')
  }

  const rejection: Approval = { userId, email, signedAt: new Date() }
  const updated: Proposal   = {
    ...proposal,
    rejections: [...proposal.rejections, rejection],
  }

  updated.status = deriveStatus(updated, pocket)
  return updated
}

// ── Role helpers ──────────────────────────────────────────────────────────────

export function canSign(role: MemberRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'signer'
}

export function canPropose(role: MemberRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'signer'
}

export function canManageMembers(role: MemberRole): boolean {
  return role === 'owner' || role === 'admin'
}

export function canView(role: MemberRole): boolean {
  return true  // all roles can view
}

// ── Spending limits ───────────────────────────────────────────────────────────

/**
 * Check if a payment is within a member's daily spending limit.
 * Returns true if allowed (under limit or no limit set).
 */
export function isWithinSpendLimit(
  member:    TeamMember,
  amountUsd: number,
  window:    SpendingWindow | null,
): boolean {
  if (member.spendLimitUsd === null) return true  // unlimited

  const alreadySpent = window ? window.spentUsd : 0
  return alreadySpent + amountUsd <= member.spendLimitUsd
}

/**
 * Determine whether a payment needs multi-sig approval or can be executed
 * directly (within the proposer's spending limit).
 */
export function requiresApproval(
  member:    TeamMember,
  amountUsd: number,
  window:    SpendingWindow | null,
): boolean {
  // Owners and admins with no limit can transact directly
  if (canManageMembers(member.role) && member.spendLimitUsd === null) return false
  // Within spending limit → no approval needed
  if (isWithinSpendLimit(member, amountUsd, window)) return false
  // Over limit → needs approval
  return true
}

// ── Proposal defaults ─────────────────────────────────────────────────────────

export const DEFAULT_PROPOSAL_TTL_HOURS = 72

export function proposalExpiresAt(hours = DEFAULT_PROPOSAL_TTL_HOURS): Date {
  return new Date(Date.now() + hours * 3_600_000)
}
