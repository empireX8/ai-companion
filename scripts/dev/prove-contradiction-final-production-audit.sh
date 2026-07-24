#!/usr/bin/env bash
# CONTRADICTION-FINAL-PRODUCTION-AUDIT-001
#
# Prepares the isolated local PostgreSQL database
#   companion_contradiction_rt_test
# and runs the authenticated browser audit against a dedicated app instance.
#
# The runner target URL is IMMUTABLE. Caller override is refused unless the
# value is byte-for-byte identical to the fixed local URL.
#
# Safety:
# - never falls back to the normal app DATABASE_URL
# - never mutates .env / .env.local
# - refuses to reuse a pre-existing app listener on the dedicated audit port

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

ISOLATED_DB="companion_contradiction_rt_test"
IMMUTABLE_URL="postgresql://postgres:postgres@127.0.0.1:5432/${ISOLATED_DB}?schema=public"
NORMAL_DB="companion"
AUDIT_PORT="3123"
AUDIT_BASE_URL="http://localhost:${AUDIT_PORT}"
PROOF_TEST="scripts/contradiction-final-production-audit.playwright.ts"

echo "==> CONTRADICTION-FINAL-PRODUCTION-AUDIT-001"
echo "    isolated database: ${ISOLATED_DB}"
echo "    immutable DB URL only"
echo "    dedicated authenticated browser app port: ${AUDIT_PORT}"

resolve_env_source() {
  if [[ "${MINDLAB_ENV_FILE:-}" != "" ]]; then
    if [[ -f "${MINDLAB_ENV_FILE}" ]]; then
      printf '%s\n' "${MINDLAB_ENV_FILE}"
      return 0
    fi
    echo "REFUSED: MINDLAB_ENV_FILE must point to a regular file." >&2
    exit 1
  fi

  local worktree_env="${ROOT_DIR}/.env"
  if [[ -f "${worktree_env}" ]]; then
    printf '%s\n' "${worktree_env}"
    return 0
  fi

  local common_git_dir=""
  common_git_dir="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
  if [[ -n "${common_git_dir}" ]]; then
    local common_root
    common_root="$(cd "${common_git_dir}/.." && pwd)"
    local common_env="${common_root}/.env"
    if [[ -f "${common_env}" ]]; then
      printf '%s\n' "${common_env}"
      return 0
    fi
  fi

  echo "REFUSED: no local .env available for the authenticated app runtime." >&2
  echo "Checked:" >&2
  echo "  ${worktree_env}" >&2
  if [[ -n "${common_git_dir}" ]]; then
    echo "  $(cd "${common_git_dir}/.." && pwd)/.env" >&2
  fi
  exit 1
}

ENV_SOURCE="$(resolve_env_source)"

if [[ "${CONTRADICTION_REAL_DB_TEST_URL+x}" = "x" ]]; then
  if [[ "${CONTRADICTION_REAL_DB_TEST_URL}" != "${IMMUTABLE_URL}" ]]; then
    echo "REFUSED: CONTRADICTION_REAL_DB_TEST_URL must be unset or exactly:" >&2
    echo "  ${IMMUTABLE_URL}" >&2
    exit 1
  fi
fi

if [[ "${DATABASE_URL+x}" = "x" ]]; then
  if [[ "${DATABASE_URL}" != "${IMMUTABLE_URL}" ]]; then
    echo "REFUSED: DATABASE_URL must be unset or exactly equal to the immutable isolated URL." >&2
    echo "  expected: ${IMMUTABLE_URL}" >&2
    echo "Never use the normal companion DATABASE_URL for this audit." >&2
    exit 1
  fi
fi

if [[ "${DESKTOP_PARITY_BASE_URL+x}" = "x" ]]; then
  if [[ "${DESKTOP_PARITY_BASE_URL}" != "${AUDIT_BASE_URL}" ]]; then
    echo "REFUSED: DESKTOP_PARITY_BASE_URL must be unset or exactly:" >&2
    echo "  ${AUDIT_BASE_URL}" >&2
    exit 1
  fi
fi

if command -v lsof >/dev/null 2>&1; then
  if lsof -nP -iTCP:"${AUDIT_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "REFUSED: port ${AUDIT_PORT} is already in use." >&2
    echo "This audit requires a fresh dedicated app instance so reuseExistingServer cannot attach to an unrelated process." >&2
    exit 1
  fi
fi

export CONTRADICTION_REAL_DB_TEST_URL="${IMMUTABLE_URL}"
export DATABASE_URL="${IMMUTABLE_URL}"
export DESKTOP_PARITY_BASE_URL="${AUDIT_BASE_URL}"
export MINDLAB_ENV_FILE="${ENV_SOURCE}"

echo "==> Loading authenticated app env from ${ENV_SOURCE} (command-local only)"
set -a
# shellcheck disable=SC1090
source "${ENV_SOURCE}"
set +a
export CONTRADICTION_REAL_DB_TEST_URL="${IMMUTABLE_URL}"
export DATABASE_URL="${IMMUTABLE_URL}"
export DESKTOP_PARITY_BASE_URL="${AUDIT_BASE_URL}"
export MINDLAB_ENV_FILE="${ENV_SOURCE}"

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

echo "==> Applying current Prisma schema to isolated DB only"
DATABASE_URL="${IMMUTABLE_URL}" npx prisma db push --skip-generate --accept-data-loss

echo "==> Running authenticated contradiction browser audit"
env -u OPENAI_API_KEY \
  CONTRADICTION_REAL_DB_TEST_URL="${IMMUTABLE_URL}" \
  DATABASE_URL="${IMMUTABLE_URL}" \
  DESKTOP_PARITY_BASE_URL="${AUDIT_BASE_URL}" \
  npx playwright test "${PROOF_TEST}"

echo "==> PASS: contradiction final production browser audit completed"
