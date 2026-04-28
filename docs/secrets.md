# Clutch — Secrets & Environment Management

## Required secrets

| Variable | Description | How to generate |
|---|---|---|
| `JWT_SECRET` | Signs auth tokens | `openssl rand -hex 64` |
| `ANTHROPIC_API_KEY` | Claude AI agent | [console.anthropic.com](https://console.anthropic.com) |
| `DATABASE_URL` | Supabase session pooler URL | Project Settings → Database |
| `DIRECT_URL` | Supabase direct connection URL | Project Settings → Database |
| `SUPABASE_URL` | Supabase project URL | Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (admin) | Project Settings → API |
| `REDIS_PASSWORD` | Redis auth | `openssl rand -base64 24` |
| `INTERNAL_SECRET` | Service-to-service auth | `openssl rand -hex 32` |
| `SOLANA_RPC_URL` | Solana RPC endpoint | See below |

## Solana RPC options

| Provider | Free tier | Recommended for |
|---|---|---|
| [Helius](https://helius.dev) | 100k credits/day | Production — best DAS + NFT support |
| [QuickNode](https://quicknode.com) | 50 req/s | Low-latency trading |
| [Triton One](https://triton.one) | Paid | High-throughput |
| Public (`https://api.mainnet-beta.solana.com`) | Rate-limited | Development only |

**Recommended**: Use Helius for production. It supports DAS (NFT indexing), has a generous free tier, and responds faster than the public RPC.

## Environment files

```
.env.example     — committed to git, no real values
.env             — local development, never committed
.env.production  — production values, stored in secrets manager
```

## Fly.io secrets

```bash
# Set all secrets at once
fly secrets set \
  JWT_SECRET="$(openssl rand -hex 64)" \
  ANTHROPIC_API_KEY="sk-ant-..." \
  DATABASE_URL="postgresql://..." \
  SOLANA_RPC_URL="https://mainnet.helius-rpc.com/?api-key=..." \
  INTERNAL_SECRET="$(openssl rand -hex 32)" \
  --app clutch-api

# List secrets (names only, not values)
fly secrets list --app clutch-api
```

## Railway secrets

Set environment variables in the Railway dashboard under
**Project → Service → Variables**, or use the CLI:

```bash
railway variables set JWT_SECRET="$(openssl rand -hex 64)"
railway variables set ANTHROPIC_API_KEY="sk-ant-..."
```

## Docker Compose / self-hosted

Create a `.env` file next to `docker-compose.prod.yml`:

```bash
# Generate all secrets in one command
cat > .env << EOF
POSTGRES_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 24)
JWT_SECRET=$(openssl rand -hex 64)
INTERNAL_SECRET=$(openssl rand -hex 32)
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
GRAFANA_PASSWORD=$(openssl rand -base64 16)
CORS_ORIGIN=https://clutch.app
PUBLIC_API_URL=https://api.clutch.app
PUBLIC_WS_URL=wss://api.clutch.app/ws
EOF
```

## Secret rotation

- Rotate `JWT_SECRET` by updating the secret and restarting the API. All existing sessions will be invalidated — users will need to log in again.
- Rotate `DATABASE_URL` with zero downtime by running the new DB in parallel, migrating, then switching.
- `ANTHROPIC_API_KEY` can be rotated without downtime — update the secret, restart the API.

## Never commit

```gitignore
.env
.env.local
.env.production
*.pem
*.key
secrets/
```
