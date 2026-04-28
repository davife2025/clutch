/**
 * Multi-sig + team pocket schema additions.
 * Append these tables to the main schema.
 */
import {
  pgTable, text, timestamp, integer, uuid, pgEnum, index, uniqueIndex, boolean,
} from 'drizzle-orm/pg-core'
import { users, pockets } from './schema.js'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const memberRoleEnum    = pgEnum('member_role', ['owner', 'admin', 'member', 'viewer'])
export const approvalStatusEnum = pgEnum('approval_status', ['pending', 'approved', 'rejected', 'expired'])

// ─── Pocket members ───────────────────────────────────────────────────────────

export const pocketMembers = pgTable('pocket_members', {
  id:        uuid('id').primaryKey().defaultRandom(),
  pocketId:  uuid('pocket_id').notNull().references(() => pockets.id, { onDelete: 'cascade' }),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role:      memberRoleEnum('role').notNull().default('member'),
  invitedBy: uuid('invited_by').references(() => users.id),
  joinedAt:  timestamp('joined_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('members_pocket_user_idx').on(t.pocketId, t.userId),
  index('members_pocket_idx').on(t.pocketId),
])

// ─── Spending limits ──────────────────────────────────────────────────────────

export const spendingLimits = pgTable('spending_limits', {
  id:           uuid('id').primaryKey().defaultRandom(),
  pocketId:     uuid('pocket_id').notNull().references(() => pockets.id, { onDelete: 'cascade' }),
  userId:       uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),  // null = applies to all members
  maxAmountUsd: text('max_amount_usd').notNull(),  // stored as string for precision
  windowHours:  integer('window_hours').notNull().default(24),
  token:        text('token'),                     // null = all tokens
  createdBy:    uuid('created_by').references(() => users.id),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('limits_pocket_idx').on(t.pocketId)])

// ─── Approval requests ────────────────────────────────────────────────────────

export const approvalRequests = pgTable('approval_requests', {
  id:               uuid('id').primaryKey().defaultRandom(),
  pocketId:         uuid('pocket_id').notNull().references(() => pockets.id, { onDelete: 'cascade' }),
  requestedBy:      uuid('requested_by').notNull().references(() => users.id),
  type:             text('type').notNull(),               // 'payment' | 'wallet_add' | 'wallet_remove'
  payload:          text('payload').notNull(),            // JSON: { to, amount, token, chain }
  requiredApprovals: integer('required_approvals').notNull().default(2),
  status:           approvalStatusEnum('status').notNull().default('pending'),
  expiresAt:        timestamp('expires_at').notNull(),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
  resolvedAt:       timestamp('resolved_at'),
}, (t) => [
  index('approvals_pocket_idx').on(t.pocketId),
  index('approvals_status_idx').on(t.status),
])

// ─── Approval votes ───────────────────────────────────────────────────────────

export const approvalVotes = pgTable('approval_votes', {
  id:        uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().references(() => approvalRequests.id, { onDelete: 'cascade' }),
  userId:    uuid('user_id').notNull().references(() => users.id),
  vote:      text('vote').notNull(),   // 'approve' | 'reject'
  reason:    text('reason'),
  votedAt:   timestamp('voted_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('votes_request_user_idx').on(t.requestId, t.userId),
])

// ─── Audit log ────────────────────────────────────────────────────────────────

export const auditLog = pgTable('audit_log', {
  id:        uuid('id').primaryKey().defaultRandom(),
  pocketId:  uuid('pocket_id').notNull().references(() => pockets.id, { onDelete: 'cascade' }),
  userId:    uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action:    text('action').notNull(),    // e.g. 'wallet.add', 'payment.sent', 'member.invite'
  details:   text('details').notNull(),   // JSON
  ip:        text('ip'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('audit_pocket_idx').on(t.pocketId)])

// ─── Types ────────────────────────────────────────────────────────────────────

export type PocketMemberRow    = typeof pocketMembers.$inferSelect
export type SpendingLimitRow   = typeof spendingLimits.$inferSelect
export type ApprovalRequestRow = typeof approvalRequests.$inferSelect
export type AuditLogRow        = typeof auditLog.$inferSelect
