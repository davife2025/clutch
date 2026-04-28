-- Clutch production database initialisation
-- Run automatically by the postgres Docker container on first start

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Performance indexes added post-migration
-- (Drizzle handles table creation; this file adds extras)

-- Partial index: only active subscriptions
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS sub_active_idx
--   ON subscriptions (user_id) WHERE status = 'active';

-- Partial index: only pending proposals
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS proposals_pending_idx
--   ON proposals (team_pocket_id) WHERE status = 'pending';

-- Audit log text search
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_description_idx
--   ON audit_log USING gin(to_tsvector('english', description));

COMMENT ON DATABASE clutch IS 'Clutch Solana wallet pocket — production database';
