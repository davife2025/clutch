/**
 * Database client — Drizzle ORM over Supabase Postgres.
 *
 * Supabase provides three connection modes:
 *
 *   1. Transaction pooler  (port 6543) — best for serverless / short-lived
 *      DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
 *
 *   2. Session pooler     (port 5432) — best for long-running Node.js servers
 *      DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
 *
 *   3. Direct connection  (port 5432, no pooler) — required for migrations
 *      DIRECT_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
 *
 * For Clutch's Hono API (long-running server), we use the Session pooler (mode 2)
 * for DATABASE_URL and the Direct connection for DIRECT_URL (Drizzle migrations).
 *
 * Find both URLs in your Supabase dashboard → Project Settings → Database.
 */

import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool }    from 'pg'
import * as schema    from './schema.js'
import * as relations from './relations.js'

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) throw new Error('DATABASE_URL is required — use the Supabase session pooler URL')

/**
 * Connection pool configured for the Supabase session pooler.
 *
 * Supabase session pooler supports up to 200 concurrent connections on Pro,
 * 500 on Team. We keep max low to avoid saturating it across multiple replicas.
 */
const pool = new Pool({
  connectionString: dbUrl,
  max:                    10,   // per-process limit; scale with replicas
  idleTimeoutMillis:   30_000,
  connectionTimeoutMillis: 5_000,
  // Required for Supabase's TLS-enforced connections
  ssl: dbUrl.includes('supabase.com') ? { rejectUnauthorized: false } : false,
})

pool.on('error', (err) => {
  console.error('[db] pool error:', err.message)
})

export const db = drizzle(pool, { schema: { ...schema, ...relations } })
export type DB  = typeof db

// ── Supabase Admin client ─────────────────────────────────────────────────────
// Use for server-side operations that need service_role (bypass RLS).
// NEVER expose SUPABASE_SERVICE_ROLE_KEY to the client.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
const supabaseSvcKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Supabase Admin client — service_role key, bypasses RLS.
 * Use for: storage uploads, sending emails, reading any row.
 */
export const supabaseAdmin = supabaseUrl && supabaseSvcKey
  ? createClient(supabaseUrl, supabaseSvcKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

/**
 * Supabase Anon client — safe for user-scoped operations (respects RLS).
 */
export const supabaseAnon = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
