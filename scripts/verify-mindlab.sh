#!/usr/bin/env bash
# verify-mindlab.sh — Unified verification script for MindLab repo
#
# Runs all standard verification commands in sequence.
# Reports results honestly — if a command is unavailable or fails,
# it says so rather than hiding the failure.
#
# Usage:
#   bash scripts/verify-mindlab.sh
#
# Exit codes:
#   0 — all checks pass
#   1 — one or more checks failed

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
SKIP=0

check() {
  local name="$1"
  local cmd="$2"
  local optional="${3:-false}"

  echo ""
  echo "━━━ [$name] ━━━"
  echo "  Running: $cmd"

  if [[ "$optional" == "true" ]]; then
    # Check if the command exists before running
    local cmd_base
    cmd_base=$(echo "$cmd" | awk '{print $1}')
    if ! command -v "$cmd_base" &>/dev/null && ! type "$cmd_base" &>/dev/null 2>&1; then
      echo -e "  ${YELLOW}SKIP${NC} — command not available: $cmd_base"
      SKIP=$((SKIP + 1))
      return 0
    fi
  fi

  if eval "$cmd" 2>&1; then
    echo -e "  ${GREEN}PASS${NC}"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC}"
    FAIL=$((FAIL + 1))
  fi
}

echo "=========================================="
echo "  MindLab Verification Suite"
echo "=========================================="
echo "  Started: $(date)"
echo "  Repo:    $(git rev-parse --show-toplevel 2>/dev/null || echo 'unknown')"
echo "  Branch:  $(git branch --show-current 2>/dev/null || echo 'unknown')"
echo "=========================================="

# ── 1. Git whitespace check ────────────────────────────────────────────────────
check "git diff --check" "git diff --check"

# ── 2. TypeScript compilation ──────────────────────────────────────────────────
check "TypeScript (tsc --noEmit)" "npx tsc --noEmit"

# ── 3. Vitest tests ────────────────────────────────────────────────────────────
check "Vitest" "npx vitest run"

# ── 4. Production build ────────────────────────────────────────────────────────
check "Next.js build" "npm run build"

# ── 5. Trust language check ────────────────────────────────────────────────────
check "Trust language" "bash scripts/check-trust-language.sh"

# ── 6. Legacy surfaces check ───────────────────────────────────────────────────
check "Legacy surfaces" "bash scripts/check-legacy-surfaces.sh"

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo "=========================================="
echo "  Results"
echo "=========================================="
echo -e "  ${GREEN}PASS${NC}:  $PASS"
echo -e "  ${RED}FAIL${NC}:  $FAIL"
echo -e "  ${YELLOW}SKIP${NC}:  $SKIP"
echo "=========================================="

if [[ "$FAIL" -gt 0 ]]; then
  echo -e "${RED}  ❌ Some checks failed. Review output above.${NC}"
  exit 1
else
  echo -e "${GREEN}  ✅ All checks passed.${NC}"
  exit 0
fi
