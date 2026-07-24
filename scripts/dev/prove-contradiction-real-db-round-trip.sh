#!/usr/bin/env bash
# CONTRADICTION-REAL-DB-ROUND-TRIP-PROOF-001
#
# Prepares the isolated local PostgreSQL database
#   companion_contradiction_rt_test
# and runs only the real-DB round-trip Vitest proof.
#
# The runner target URL is IMMUTABLE. Caller override is refused unless the
# value is byte-for-byte identical to the fixed local URL.
#
# Never mutates the normal companion DATABASE_URL database.
# Never writes credentials into .env / .env.local.
# Uses command-local environment variables only.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

ISOLATED_DB="companion_contradiction_rt_test"
# Immutable proof target — no ports/hosts/users/schemas/db-name variants.
IMMUTABLE_URL="postgresql://postgres:postgres@127.0.0.1:5432/${ISOLATED_DB}?schema=public"
NORMAL_DB="companion"
PROOF_TEST="lib/__tests__/contradiction-real-db-round-trip.integration.test.ts"

echo "==> CONTRADICTION-REAL-DB-ROUND-TRIP-PROOF-001"
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

# Export the exact immutable URL only after the refusal check.
export CONTRADICTION_REAL_DB_TEST_URL="${IMMUTABLE_URL}"

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
# Prisma reads DATABASE_URL for db push; bind ONLY the immutable isolated URL.
# Do not export DATABASE_URL into the shell session permanently.
# Never fall back to the caller's DATABASE_URL.
DATABASE_URL="${IMMUTABLE_URL}" npx prisma db push --skip-generate --accept-data-loss

echo "==> Running isolated real-DB Vitest proof (gate + fake providers; no OpenAI)"
# Vitest inherits CONTRADICTION_REAL_DB_TEST_URL. Do not pass DATABASE_URL.
env -u DATABASE_URL \
  CONTRADICTION_REAL_DB_TEST_URL="${IMMUTABLE_URL}" \
  RUN_PRODUCTION_CONTRADICTION_INGESTION=1 \
  npx vitest run "${PROOF_TEST}"

echo "==> PASS: contradiction real-DB round-trip proof completed"
