import { ChainId } from '@clutch/core'

// ── Team pocket ───────────────────────────────────────────────────────────────

export type MemberRole = 'owner' | 'admin' | 'signer' | 'viewer'

export interface TeamMember {
  userId:    string
  email:     string
  role:      MemberRole
  joinedAt:  Date
  /** Daily spending limit in USD. null = unlimited (owners/admins only). */
  spendLimitUsd: number | null
}

export interface TeamPocket {
  id:           string
  name:         string
  description?: string
  members:      TeamMember[]
  /** M-of-N threshold — how many signers must approve a tx */
  threshold:    number
  createdBy:    string
  createdAt:    Date
  updatedAt:    Date
  /** Squads / Safe program address if using on-chain multisig */
  onChainAddress?: string
  chain:        ChainId
}

// ── Approval flow ─────────────────────────────────────────────────────────────

export type ProposalStatus =
  | 'pending'     // waiting for approvals
  | 'approved'    // threshold met — ready to execute
  | 'executed'    // tx broadcast
  | 'rejected'    // majority rejected or expired
  | 'expired'     // past expiry without threshold

export type ProposalType = 'payment' | 'add_member' | 'remove_member' | 'change_threshold' | 'change_limit'

export interface Proposal {
  id:          string
  teamPocketId: string
  type:        ProposalType
  status:      ProposalStatus
  title:       string
  description?: string
  proposedBy:  string
  proposedAt:  Date
  expiresAt:   Date
  approvals:   Approval[]
  rejections:  Approval[]
  /** Serialised payload — depends on type */
  payload:     ProposalPayload
  txHash?:     string
  executedAt?: Date
}

export interface Approval {
  userId:   string
  email:    string
  signedAt: Date
  signature?: string  // on-chain sig for Squads
}

// ── Proposal payloads ─────────────────────────────────────────────────────────

export type ProposalPayload =
  | PaymentPayload
  | AddMemberPayload
  | RemoveMemberPayload
  | ChangeThresholdPayload
  | ChangeLimitPayload

export interface PaymentPayload {
  type:       'payment'
  to:         string
  amount:     string  // human-readable
  token:      string
  chain:      ChainId
  memo?:      string
}

export interface AddMemberPayload {
  type:   'add_member'
  email:  string
  role:   MemberRole
  spendLimitUsd: number | null
}

export interface RemoveMemberPayload {
  type:   'remove_member'
  userId: string
}

export interface ChangeThresholdPayload {
  type:         'change_threshold'
  newThreshold: number
}

export interface ChangeLimitPayload {
  type:           'change_limit'
  targetUserId:   string
  newLimitUsd:    number | null
}

// ── Audit log ─────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'pocket_created'
  | 'member_added'
  | 'member_removed'
  | 'proposal_created'
  | 'proposal_approved'
  | 'proposal_rejected'
  | 'proposal_executed'
  | 'threshold_changed'
  | 'limit_changed'
  | 'wallet_added'
  | 'wallet_removed'

export interface AuditEntry {
  id:          string
  teamPocketId: string
  action:      AuditAction
  actorId:     string
  actorEmail:  string
  description: string
  metadata?:   Record<string, unknown>
  ts:          Date
}

// ── Spending tracker ──────────────────────────────────────────────────────────

export interface SpendingWindow {
  userId:    string
  pocketId:  string
  periodStart: Date   // start of 24h window
  spentUsd:  number
  limitUsd:  number | null
}
