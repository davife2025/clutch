#!/usr/bin/env bash
# deploy.sh — deploy Clutch to production
# Usage: ./scripts/deploy.sh [fly|railway|docker|extension]
set -euo pipefail

PLATFORM=${1:-fly}
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🫙  Clutch — deploying to ${PLATFORM}"
echo ""

check_env() {
  local missing=()
  for var in JWT_SECRET ANTHROPIC_API_KEY DATABASE_URL SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY; do
    [[ -z "${!var:-}" ]] && missing+=("$var")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "❌ Missing required env vars: ${missing[*]}"
    echo "   Copy .env.example → .env and fill in Supabase + other values."
    exit 1
  fi
}

run_migrations() {
  echo "⏳ Running Drizzle migrations against Supabase..."
  local url="${DIRECT_URL:-$DATABASE_URL}"
  if [[ -z "$url" ]]; then
    echo "❌ Set DIRECT_URL (Supabase direct connection) for migrations"
    exit 1
  fi
  cd "${ROOT_DIR}"
  DIRECT_URL="$url" pnpm --filter @clutch/api drizzle-kit migrate
  echo "✅ Migrations complete"
}

deploy_fly() {
  check_env
  echo "🚀 Deploying API to Fly.io..."
  cd "${ROOT_DIR}"

  fly secrets set \
    JWT_SECRET="${JWT_SECRET}" \
    ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
    DATABASE_URL="${DATABASE_URL}" \
    SUPABASE_URL="${SUPABASE_URL}" \
    SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}" \
    SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}" \
    SOLANA_RPC_URL="${SOLANA_RPC_URL:-https://api.mainnet-beta.solana.com}" \
    INTERNAL_SECRET="${INTERNAL_SECRET:-$(openssl rand -hex 32)}" \
    --app clutch-api

  fly deploy --config infra/fly.toml --remote-only
  echo "✅ API deployed to Fly.io"
  fly status --app clutch-api
}

deploy_railway() {
  check_env
  echo "🚀 Deploying to Railway..."
  railway variables set DATABASE_URL="${DATABASE_URL}"
  railway variables set SUPABASE_URL="${SUPABASE_URL}"
  railway variables set SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"
  railway variables set JWT_SECRET="${JWT_SECRET}"
  railway variables set ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}"
  railway up --service clutch-api
  echo "✅ Deployed to Railway"
}

deploy_docker() {
  check_env
  echo "🐳 Deploying with Docker Compose (Supabase for DB)..."
  cd "${ROOT_DIR}"
  docker compose -f infra/docker/docker-compose.prod.yml pull redis nginx
  docker compose -f infra/docker/docker-compose.prod.yml build api web
  docker compose -f infra/docker/docker-compose.prod.yml up -d --no-deps --scale api=2 api
  sleep 10
  docker compose -f infra/docker/docker-compose.prod.yml up -d --no-deps web nginx
  echo "✅ Docker deployment complete"
  docker compose -f infra/docker/docker-compose.prod.yml ps
}

build_extension() {
  echo "📦 Building Chrome extension..."
  cd "${ROOT_DIR}/apps/extension"
  pnpm build
  cd dist && zip -r "../clutch-extension-$(date +%Y%m%d).zip" . && cd ..
  echo "✅ Extension zip in apps/extension/"
}

case "$PLATFORM" in
  fly)       run_migrations && deploy_fly       ;;
  railway)   run_migrations && deploy_railway   ;;
  docker)    run_migrations && deploy_docker    ;;
  extension) build_extension                    ;;
  migrate)   run_migrations                     ;;
  *)
    echo "Usage: $0 [fly|railway|docker|extension|migrate]"
    exit 1
    ;;
esac

echo ""
echo "🫙  Clutch v0.24.0 deployed successfully!"
