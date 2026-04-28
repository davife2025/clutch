import {
  pgTable, text, timestamp, boolean, bigint, integer,
  uuid, pgEnum, index, uniqueIndex,
} from 'drizzle-orm/pg-core'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const walletTypeEnum = pgEnum('wallet_type', ['hot', 'cold', 'hardware', 'native'])

/** Solana is the primary chain. */
export const chainIdEnum = pgEnum('chain_id', [
  'solana',     // primary
  'ethereum', 'base', 'polygon', 'arbitrum', 'optimism',
])

export const txStatusEnum = pgEnum('tx_status', ['pending', 'confirmed', 'failed'])
export const txTypeEnum   = pgEnum('tx_type',   ['deposit', 'withdraw', 'payment', 'transfer'])

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id:           uuid('id').primaryKey().defaultRandom(),
  email:        text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
}, (t) => [uniqueIndex('users_email_idx').on(t.email)])

// ─── Pockets ──────────────────────────────────────────────────────────────────

export const pockets = pgTable('pockets', {
  id:      uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name:    text('name').notNull().default('My Pocket'),
  /** Native balance in lamports (9 decimals). 1 SOL = 1_000_000_000 lamports. */
  nativeBalance: bigint('native_balance', { mode: 'bigint' }).notNull().default(BigInt(0)),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('pockets_owner_idx').on(t.ownerId)])

// ─── Wallets ──────────────────────────────────────────────────────────────────

export const wallets = pgTable('wallets', {
  id:        uuid('id').primaryKey().defaultRandom(),
  pocketId:  uuid('pocket_id').notNull().references(() => pockets.id, { onDelete: 'cascade' }),
  type:      walletTypeEnum('type').notNull(),
  address:   text('address').notNull(),
  /** Default chain is solana. */
  chain:     chainIdEnum('chain').notNull().default('solana'),
  label:     text('label'),
  isDefault: boolean('is_default').notNull().default(false),
  addedAt:   timestamp('added_at').defaultNow().notNull(),
}, (t) => [
  index('wallets_pocket_idx').on(t.pocketId),
  uniqueIndex('wallets_address_chain_idx').on(t.address, t.chain),
])

// ─── Wallet balances (cached) ─────────────────────────────────────────────────

export const walletBalances = pgTable('wallet_balances', {
  id:        uuid('id').primaryKey().defaultRandom(),
  walletId:  uuid('wallet_id').notNull().references(() => wallets.id, { onDelete: 'cascade' }),
  chain:     chainIdEnum('chain').notNull(),
  token:     text('token').notNull(),             // 'SOL', 'USDC', 'BONK', etc.
  amount:    bigint('amount', { mode: 'bigint' }).notNull().default(BigInt(0)),
  decimals:  integer('decimals').notNull().default(9),  // Solana default = 9
  usdValue:  text('usd_value'),
  fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
}, (t) => [
  index('balances_wallet_idx').on(t.walletId),
  uniqueIndex('balances_wallet_token_idx').on(t.walletId, t.token),
])

// ─── Transactions ─────────────────────────────────────────────────────────────

export const transactions = pgTable('transactions', {
  id:          uuid('id').primaryKey().defaultRandom(),
  pocketId:    uuid('pocket_id').notNull().references(() => pockets.id, { onDelete: 'cascade' }),
  walletId:    uuid('wallet_id').references(() => wallets.id, { onDelete: 'set null' }),
  type:        txTypeEnum('type').notNull(),
  status:      txStatusEnum('status').notNull().default('pending'),
  fromAddress: text('from_address').notNull(),
  toAddress:   text('to_address').notNull(),
  /** Amount in the token's smallest unit (lamports for SOL, micro-USDC for USDC, etc.) */
  amount:      bigint('amount', { mode: 'bigint' }).notNull(),
  token:       text('token').notNull(),
  chain:       chainIdEnum('chain').notNull().default('solana'),
  txHash:      text('tx_hash'),
  memo:        text('memo'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  confirmedAt: timestamp('confirmed_at'),
}, (t) => [
  index('txns_pocket_idx').on(t.pocketId),
  index('txns_status_idx').on(t.status),
  index('txns_hash_idx').on(t.txHash),
])

// ─── Type exports ─────────────────────────────────────────────────────────────

export type UserRow        = typeof users.$inferSelect
export type NewUserRow     = typeof users.$inferInsert
export type PocketRow      = typeof pockets.$inferSelect
export type NewPocketRow   = typeof pockets.$inferInsert
export type WalletRow      = typeof wallets.$inferSelect
export type NewWalletRow   = typeof wallets.$inferInsert
export type TransactionRow = typeof transactions.$inferSelect
export type NewTransactionRow = typeof transactions.$inferInsert

// ─── Team pockets (Session 12) ────────────────────────────────────────────────

export const memberRoleEnum = pgEnum('member_role', ['owner', 'admin', 'signer', 'viewer'])
export const proposalStatusEnum = pgEnum('proposal_status', ['pending', 'approved', 'rejected', 'expired', 'executed'])
export const proposalTypeEnum   = pgEnum('proposal_type',   ['payment', 'add_member', 'remove_member', 'change_threshold', 'change_limit'])

export const teamPockets = pgTable('team_pockets', {
  id:              uuid('id').primaryKey().defaultRandom(),
  name:            text('name').notNull(),
  description:     text('description'),
  threshold:       integer('threshold').notNull().default(2),
  createdBy:       uuid('created_by').notNull().references(() => users.id),
  onChainAddress:  text('on_chain_address'),
  chain:           chainIdEnum('chain').notNull().default('solana'),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
  updatedAt:       timestamp('updated_at').defaultNow().notNull(),
})

export const teamMembers = pgTable('team_members', {
  id:           uuid('id').primaryKey().defaultRandom(),
  teamPocketId: uuid('team_pocket_id').notNull().references(() => teamPockets.id, { onDelete: 'cascade' }),
  userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role:         memberRoleEnum('role').notNull().default('signer'),
  /** Daily USD spending limit. null = unlimited */
  spendLimitUsd: integer('spend_limit_usd'),
  joinedAt:     timestamp('joined_at').defaultNow().notNull(),
}, (t) => [
  index('team_members_pocket_idx').on(t.teamPocketId),
  uniqueIndex('team_members_unique_idx').on(t.teamPocketId, t.userId),
])

export const proposals = pgTable('proposals', {
  id:            uuid('id').primaryKey().defaultRandom(),
  teamPocketId:  uuid('team_pocket_id').notNull().references(() => teamPockets.id, { onDelete: 'cascade' }),
  type:          proposalTypeEnum('type').notNull(),
  status:        proposalStatusEnum('status').notNull().default('pending'),
  title:         text('title').notNull(),
  description:   text('description'),
  proposedBy:    uuid('proposed_by').notNull().references(() => users.id),
  payload:       text('payload').notNull(),  // JSON
  approvals:     text('approvals').notNull().default('[]'),    // JSON array
  rejections:    text('rejections').notNull().default('[]'),   // JSON array
  txHash:        text('tx_hash'),
  expiresAt:     timestamp('expires_at').notNull(),
  executedAt:    timestamp('executed_at'),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('proposals_pocket_idx').on(t.teamPocketId),
  index('proposals_status_idx').on(t.status),
])

export const auditLog = pgTable('audit_log', {
  id:           uuid('id').primaryKey().defaultRandom(),
  teamPocketId: uuid('team_pocket_id').notNull().references(() => teamPockets.id, { onDelete: 'cascade' }),
  action:       text('action').notNull(),
  actorId:      uuid('actor_id').notNull().references(() => users.id),
  actorEmail:   text('actor_email').notNull(),
  description:  text('description').notNull(),
  metadata:     text('metadata'),   // JSON
  ts:           timestamp('ts').defaultNow().notNull(),
}, (t) => [
  index('audit_pocket_idx').on(t.teamPocketId),
  index('audit_ts_idx').on(t.ts),
])

export const spendingWindows = pgTable('spending_windows', {
  id:          uuid('id').primaryKey().defaultRandom(),
  userId:      uuid('user_id').notNull().references(() => users.id),
  pocketId:    uuid('pocket_id').notNull().references(() => teamPockets.id, { onDelete: 'cascade' }),
  periodStart: timestamp('period_start').notNull(),
  spentUsd:    integer('spent_usd').notNull().default(0),
}, (t) => [
  uniqueIndex('spending_window_unique_idx').on(t.userId, t.pocketId, t.periodStart),
])

export type TeamPocketRow  = typeof teamPockets.$inferSelect
export type TeamMemberRow  = typeof teamMembers.$inferSelect
export type ProposalRow    = typeof proposals.$inferSelect
export type AuditLogRow    = typeof auditLog.$inferSelect

// ─── Subscriptions + token gating (Session 13) ────────────────────────────────

export const subscriptionStatusEnum = pgEnum('subscription_status', ['active','past_due','cancelled','trialing','expired'])
export const billingPeriodEnum       = pgEnum('billing_period',      ['daily','weekly','monthly','annual'])

export const subscriptionPlans = pgTable('subscription_plans', {
  id:            uuid('id').primaryKey().defaultRandom(),
  name:          text('name').notNull(),
  description:   text('description'),
  priceUsd:      integer('price_usd').notNull(),         // cents
  billingPeriod: billingPeriodEnum('billing_period').notNull(),
  token:         text('token').notNull().default('USDC'),
  priceRaw:      text('price_raw').notNull(),
  chain:         chainIdEnum('chain').notNull().default('solana'),
  payTo:         text('pay_to').notNull(),
  features:      text('features').notNull().default('[]'),   // JSON
  active:        boolean('active').notNull().default(true),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
})

export const subscriptions = pgTable('subscriptions', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  userId:             uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  planId:             uuid('plan_id').notNull().references(() => subscriptionPlans.id),
  status:             subscriptionStatusEnum('status').notNull().default('active'),
  currentPeriodStart: timestamp('current_period_start').notNull(),
  currentPeriodEnd:   timestamp('current_period_end').notNull(),
  cancelAtPeriodEnd:  boolean('cancel_at_period_end').notNull().default(false),
  payerAddress:       text('payer_address').notNull(),
  lastTxHash:         text('last_tx_hash'),
  createdAt:          timestamp('created_at').defaultNow().notNull(),
  updatedAt:          timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('sub_user_idx').on(t.userId),
  index('sub_status_idx').on(t.status),
])

export const tokenGates = pgTable('token_gates', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  name:               text('name').notNull(),
  condition:          text('condition').notNull(),  // GateCondition
  token:              text('token'),
  mintAddress:        text('mint_address'),
  minAmount:          text('min_amount'),
  collectionAddress:  text('collection_address'),
  planId:             uuid('plan_id').references(() => subscriptionPlans.id),
  createdAt:          timestamp('created_at').defaultNow().notNull(),
})

export const usageRecords = pgTable('usage_records', {
  id:             uuid('id').primaryKey().defaultRandom(),
  subscriptionId: uuid('subscription_id').notNull().references(() => subscriptions.id, { onDelete: 'cascade' }),
  userId:         uuid('user_id').notNull().references(() => users.id),
  metric:         text('metric').notNull(),
  quantity:       integer('quantity').notNull().default(1),
  recordedAt:     timestamp('recorded_at').defaultNow().notNull(),
}, (t) => [index('usage_sub_idx').on(t.subscriptionId)])

// ─── Portfolio snapshots (Session 14) ─────────────────────────────────────────

export const portfolioSnapshots = pgTable('portfolio_snapshots', {
  id:           uuid('id').primaryKey().defaultRandom(),
  pocketId:     uuid('pocket_id').notNull().references(() => pockets.id, { onDelete: 'cascade' }),
  totalUsd:     integer('total_usd').notNull(),      // stored as cents
  nativeSol:    text('native_sol').notNull(),         // lamports as string
  balances:     text('balances').notNull(),           // JSON snapshot
  takenAt:      timestamp('taken_at').defaultNow().notNull(),
}, (t) => [
  index('snapshots_pocket_idx').on(t.pocketId),
  index('snapshots_taken_idx').on(t.takenAt),
])
