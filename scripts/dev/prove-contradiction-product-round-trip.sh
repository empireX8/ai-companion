#!/usr/bin/env bash
# CONTRADICTION-PRODUCT-ROUND-TRIP-PROOF-001
#
# Prepares the isolated local PostgreSQL database
#   companion_contradiction_rt_test
# and runs the product lifecycle Vitest proof (Message route → candidate →
# confirm → Map → Inspector → refresh).
#
# The runner target URL is IMMUTABLE. Caller override is refused unless the
# value is byte-for-byte identical to the fixed local URL.
#
# For the real app Prisma singleton (prismadb), command-local DATABASE_URL must
# equal the same immutable URL. Never falls back to a normal app DATABASE_URL.
#
# Never writes credentials into .env / .env.local.
# Uses command-local environment variables only.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

ISOLATED_DB="companion_contradiction_rt_test"
IMMUTABLE_URL="postgresql://postgres:postgres@127.0.0.1:5432/${ISOLATED_DB}?schema=public"
NORMAL_DB="companion"
PROOF_TEST="lib/__tests__/contradiction-product-round-trip.integration.test.ts"

echo "==> CONTRADICTION-PRODUCT-ROUND-TRIP-PROOF-001"
echo "    isolated database: ${ISOLATED_DB}"
echo "    immutable URL only (no caller override)"

# ---------------------------------------------------------------------------
# IMMUTABLE TARGET: refuse before any DB / Docker / Prisma / Vitest side effects
# ---------------------------------------------------------------------------
if [[ "${CONTRADICTION_REAL_DB_TEST_URL+x}" = "x" ]]; then
  if [[ "${CONTRADICTION_REAL_DB_TEST_URL}" != "${IMMUTABLE_URL}" ]]; then
    echo "REFUSED: CONTRADICTION_REAL_DB_TEST_URL must be unset or exactly:" >&2
    echo "  ${IMMUTABLE_URL}" >&2
    echo "Caller-supplied value is not byte-for-byte identical; refusing before any side effects." >&2
    exit 1
  fi
fi

if [[ "${DATABASE_URL+x}" = "x" ]]; then
  if [[ "${DATABASE_URL}" != "${IMMUTABLE_URL}" ]]; then
    echo "REFUSED: DATABASE_URL must be unset or exactly equal to the immutable isolated URL." >&2
    echo "  expected: ${IMMUTABLE_URL}" >&2
    echo "Never use the normal companion DATABASE_URL for this proof." >&2
    exit 1
  fi
fi

export CONTRADICTION_REAL_DB_TEST_URL="${IMMUTABLE_URL}"
export DATABASE_URL="${IMMUTABLE_URL}"

echo "==> Starting/reusing local companion-db PostgreSQL container"
npm run db:local >/dev/null

echo "==> Waiting for Postgres readiness"
for _ in $(seq 1 30); do
  if docker exec companion-db pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec companion-db pg_isready -U postgres >/dev/null

echo "==> Ensuring isolated database ${ISOLATED_DB} exists (never touching ${NORMAL_DB} data)"
EXISTS="$(docker exec companion-db psql -U postgres -Atc "SELECT 1 FROM pg_database WHERE datname='${ISOLATED_DB}'" || true)"
if [[ "${EXISTS}" != "1" ]]; then
  docker exec companion-db psql -U postgres -c "CREATE DATABASE ${ISOLATED_DB};" >/dev/null
  echo "    created ${ISOLATED_DB}"
else
  echo "    ${ISOLATED_DB} already present"
fi

echo "==> Applying current Prisma schema to isolated DB only (command-local DATABASE_URL)"
DATABASE_URL="${IMMUTABLE_URL}" npx prisma db push --skip-generate --accept-data-loss

echo "==> Running product round-trip Vitest proof (fake providers; no OpenAI network)"
# prismadb singleton requires DATABASE_URL == CONTRADICTION_REAL_DB_TEST_URL.
env -u OPENAI_API_KEY \
  CONTRADICTION_REAL_DB_TEST_URL="${IMMUTABLE_URL}" \
  DATABASE_URL="${IMMUTABLE_URL}" \
  RUN_PRODUCTION_CONTRADICTION_INGESTION=1 \
  npx vitest run "${PROOF_TEST}"

echo "==> PASS: contradiction product round-trip proof completed"
