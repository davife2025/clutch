# Clutch — Supabase Setup Guide

Clutch uses Supabase as its managed Postgres database.
This gives you a hosted database, auto-generated REST API, Realtime, and Storage — all on top of Postgres.

---

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up / log in.
2. Click **New project**.
3. Choose an organisation, name the project `clutch`, and pick a region close to your users.
4. Set a strong database password and save it — you'll need it for the connection strings.
5. Wait ~2 minutes for the project to provision.

---

## 2. Get your connection strings

Go to **Project Settings → Database** and copy:

| Variable | Where to find it | Used for |
|---|---|---|
| `DATABASE_URL` | Connection string → **Session mode** (port 5432) | Running API server |
| `DIRECT_URL` | Connection string → **Direct connection** | `drizzle-kit migrate` |

Go to **Project Settings → API** and copy:

| Variable | Where to find it | Used for |
|---|---|---|
| `SUPABASE_URL` | Project URL | All Supabase SDK calls |
| `SUPABASE_ANON_KEY` | `anon` `public` key | Browser / mobile client |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key | Server admin operations (bypass RLS) |

Paste all five into your `.env` file.

---

## 3. Run migrations

Drizzle Kit will create all tables in your Supabase database:

```bash
# Uses DIRECT_URL — bypasses the pooler for multi-statement migrations
pnpm --filter @clutch/api drizzle-kit migrate
```

This creates all 20 tables: `users`, `pockets`, `wallets`, `wallet_balances`, `transactions`, `team_pockets`, `team_members`, `proposals`, `audit_log`, `spending_windows`, `subscription_plans`, `subscriptions`, `token_gates`, `usage_records`, `portfolio_snapshots`, `nft_cache`, and more.

You can also run:

```bash
./scripts/deploy.sh migrate
```

---

## 4. Row Level Security (RLS)

Supabase enforces RLS by default. Clutch uses its own JWT auth via Hono (not Supabase Auth), so the API runs with the **service_role key** to bypass RLS for all DB operations.

If you want to enable Supabase Auth instead (and use RLS policies), run the following SQL in the Supabase SQL editor:

```sql
-- Enable RLS on all user-scoped tables
ALTER TABLE pockets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_balances   ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE nft_cache         ENABLE ROW LEVEL SECURITY;

-- Example policy: users can only read their own pockets
CREATE POLICY "Users see own pockets" ON pockets
  FOR ALL USING (owner_id = auth.uid()::uuid);
```

---

## 5. Connection pooler modes

Supabase provides PgBouncer connection pooling:

| Mode | Port | Use for |
|---|---|---|
| **Session** (default) | 5432 | Long-running Node.js servers (Clutch API) |
| **Transaction** | 6543 | Serverless functions (Vercel Edge, Cloudflare Workers) |
| **Direct** | 5432 (no pooler) | Migrations (`drizzle-kit migrate`) |

Clutch's API uses **Session mode** — it maintains persistent connections via `pg.Pool`.

---

## 6. Local development with Supabase

Option A — Use a free Supabase cloud project (simplest):
```bash
# Just fill in your cloud project URLs in .env and run
pnpm dev
```

Option B — Run Supabase locally with the CLI:
```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Start local Supabase (PostgreSQL + Auth + Studio)
supabase start

# Copy the local URLs printed by `supabase start` into .env:
# DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
# DIRECT_URL=postgresql://postgres:postgres@localhost:54322/postgres
# SUPABASE_URL=http://localhost:54321
# SUPABASE_ANON_KEY=<printed by supabase start>
# SUPABASE_SERVICE_ROLE_KEY=<printed by supabase start>

# Run migrations
pnpm --filter @clutch/api drizzle-kit migrate

# Open Supabase Studio
supabase studio
```

---

## 7. Supabase Realtime (optional upgrade)

Clutch uses its own WebSocket server for real-time balance updates. Optionally, you can switch to Supabase Realtime for table change subscriptions:

```typescript
// Subscribe to balance changes for a pocket
supabaseAnon
  .channel('balances')
  .on('postgres_changes', {
    event:  'UPDATE',
    schema: 'public',
    table:  'wallet_balances',
  }, (payload) => {
    console.log('Balance updated:', payload.new)
  })
  .subscribe()
```

---

## 8. Supabase Storage (optional)

For storing NFT images, user avatars, or POS receipts:

```typescript
// Upload an image via the admin client
const { data, error } = await supabaseAdmin.storage
  .from('nft-images')
  .upload(`${mint}.png`, imageBuffer, { contentType: 'image/png', upsert: true })
```

Create a bucket in **Storage → New bucket** in the Supabase dashboard.

---

## Environment variables reference

```bash
# Supabase (required)
DATABASE_URL=postgresql://postgres.[ref]:[pw]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
DIRECT_URL=postgresql://postgres:[pw]@db.[ref].supabase.co:5432/postgres
SUPABASE_URL=https://[ref].supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Server only — never expose to browser

# Next.js public (safe for browser)
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Expo public (safe for mobile)
EXPO_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```
