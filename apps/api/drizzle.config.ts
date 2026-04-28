/**
 * Drizzle Kit config — Supabase Postgres.
 *
 * Uses DIRECT_URL (not DATABASE_URL) for schema migrations.
 * The pooler (DATABASE_URL) does not support multi-statement transactions
 * needed by `drizzle-kit migrate`.
 *
 * Set DIRECT_URL to your Supabase direct connection string:
 *   postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
 *
 * Find it in: Supabase dashboard → Project Settings → Database → Direct connection
 */
import type { Config } from 'drizzle-kit'

const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL

if (!migrationUrl) {
  throw new Error('DIRECT_URL (or DATABASE_URL) is required for Drizzle migrations')
}

export default {
  schema:  './src/db/schema.ts',
  out:     './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: migrationUrl,
    ssl: migrationUrl.includes('supabase.co')
      ? { rejectUnauthorized: false }
      : undefined,
  },
  verbose: true,
  strict:  true,
} satisfies Config
