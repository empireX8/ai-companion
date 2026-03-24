#!/usr/bin/env bash
# check-legacy-surfaces.sh
#
# Scans legacy-reachable and hidden-internal surfaces for trust-language
# violations that are not covered by check-trust-language.sh.
#
# Checks:
#   1. Numeric score/confidence badges in rendered JSX
#   2. Forecast / prediction language in user-visible strings
#   3. Old product naming ("Mind Lab" with space)
#
# Exits 0 if clean; exits 1 with failure details if any check fails.

set -euo pipefail

FAIL=0

# ── Surface directories ────────────────────────────────────────────────────────
LEGACY_DIRS=(
  "app/(root)/(routes)/projections"
  "app/(root)/(routes)/help"
)

HIDDEN_DIRS=(
  "app/(root)/(routes)/contradictions"
  "app/(root)/(routes)/references"
  "app/(root)/(routes)/audit"
  "app/(root)/(routes)/evidence"
  "app/(root)/(routes)/metrics"
)

ALL_DIRS=("${LEGACY_DIRS[@]}" "${HIDDEN_DIRS[@]}")

echo "=== Legacy + hidden surface trust audit ==="
echo ""

# ── Check 1: Numeric score patterns ───────────────────────────────────────────
# Catches: Math.round(.*100)% style numeric confidence badges
echo "--- 1. Numeric score / confidence badges ---"
NUMERIC_FAIL=0
for dir in "${ALL_DIRS[@]}"; do
  if [ ! -d "$dir" ]; then continue; fi
  hits=$(grep -rn "Math\.round[^)]*100[^)]*)[^}]*%" "$dir" --include="*.tsx" 2>/dev/null || true)
  if [ -n "$hits" ]; then
    echo "FAIL [numeric score]: $dir"
    echo "$hits"
    NUMERIC_FAIL=1
    FAIL=1
  fi
done
[ "$NUMERIC_FAIL" -eq 0 ] && echo "  OK — no numeric score badges"
echo ""

# ── Check 2: Forecast / prediction language in rendered copy ──────────────────
# Looks for the words in JSX text nodes (between > and <) and string literals
echo "--- 2. Forecast / prediction language ---"
FORECAST_FAIL=0
for dir in "${ALL_DIRS[@]}"; do
  if [ ! -d "$dir" ]; then continue; fi
  # Only flag files that are NOT pure redirects (have no "redirect(" call that
  # is the only logic; i.e. skip files whose only non-comment content is redirect)
  while IFS= read -r -d '' file; do
    # Skip pure-redirect files (content is just: import redirect + redirect("..."))
    if grep -q 'redirect("/patterns")' "$file" && [ "$(grep -c 'return\|useState\|useEffect\|className' "$file")" -eq 0 ]; then
      continue
    fi
    hits=$(grep -n '"[^"]*[Ff]orecast\|>[[:space:]]*[Ff]orecast[^<]*<\|{[^}]*[Ff]orecast[^}]*}' "$file" 2>/dev/null || true)
    if [ -n "$hits" ]; then
      echo "FAIL [forecast language]: $file"
      echo "$hits"
      FORECAST_FAIL=1
      FAIL=1
    fi
  done < <(find "$dir" -name "*.tsx" -print0 2>/dev/null)
done
[ "$FORECAST_FAIL" -eq 0 ] && echo "  OK — no forecast/prediction language"
echo ""

# ── Check 3: Old product naming ───────────────────────────────────────────────
# Catches: "Mind Lab" with a space (correct is "MindLab")
echo "--- 3. Old product naming (Mind Lab with space) ---"
NAMING_FAIL=0
for dir in "${ALL_DIRS[@]}"; do
  if [ ! -d "$dir" ]; then continue; fi
  hits=$(grep -rn "Mind Lab[^s]" "$dir" --include="*.tsx" 2>/dev/null || true)
  if [ -n "$hits" ]; then
    echo "FAIL [old naming]: $dir"
    echo "$hits"
    NAMING_FAIL=1
    FAIL=1
  fi
done
[ "$NAMING_FAIL" -eq 0 ] && echo "  OK — no old product naming"
echo ""

# ── Result ────────────────────────────────────────────────────────────────────
if [ "$FAIL" -eq 0 ]; then
  echo "check:legacy PASSED — legacy and hidden surfaces are clean."
else
  echo "check:legacy FAILED — fix the issues listed above."
  exit 1
fi
