#!/bin/bash
set -e

echo "🫙 Setting up Clutch..."

pnpm install

if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ Created .env — update your DATABASE_URL before continuing"
fi

docker compose up -d postgres
echo "⏳ Waiting for Postgres to be ready..."
sleep 4

pnpm db:generate
pnpm db:migrate

echo ""
echo "✅ Clutch is ready! Run: pnpm dev"
