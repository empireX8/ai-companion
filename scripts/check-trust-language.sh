#!/usr/bin/env bash
# check-trust-language.sh — P4-09
#
# Scans V1-visible UI surface files for banned language in rendered copy.
# Exits 1 if any real match is found.
#
# Scope: V1 core + secondary routes + shared components only.
# Exclusions: trust registry files, import lines, comment lines, test files.

set -euo pipefail

# V1-visible surface directories only (core + secondary routes + shared components)
SCAN_DIRS=(
  "app/(root)/(routes)/chat"
  "app/(root)/(routes)/check-ins"
  "app/(root)/(routes)/timeline"
  "app/(root)/(routes)/patterns"
  "app/(root)/(routes)/history"
  "app/(root)/(routes)/actions"
  "app/(root)/(routes)/context"
  "app/(root)/(routes)/memories"
  "app/(root)/(routes)/import"
  "app/(root)/(routes)/settings"
  "app/(root)/(routes)/help"
  "components"
)

# Lines to skip: TypeScript imports, JSDoc/inline comments
SKIP_LINES_PATTERN='^\s*(import |//|\*|/\*)'

BANNED_TERMS=(
  "double app"
  "the double"
  "diagnos"
  "symptom"
  "patholog"
  "disorder"
  "therapy"
  "therapeutic"
  "clinical trial"
  "mental health condition"
  "psychological disorder"
  "confidence score"
  "numeric score"
  "confidence %"
  "rating score"
  "save forecast"
  "your forecasts"
  "active forecasts"
  "ContradictionNode"
  "ReferenceItem"
  "escalation level"
  "salience score"
  "definitively proves"
  "always does this"
  "always will"
  "this proves"
)

FOUND=0

for term in "${BANNED_TERMS[@]}"; do
  for dir in "${SCAN_DIRS[@]}"; do
    [[ -d "$dir" ]] || continue

    # Find files containing the term, then filter out import/comment lines
    while IFS= read -r file; do
      # Check if any non-import, non-comment line contains the term
      hits=$(grep -i "$term" "$file" \
        | grep -Ev "$SKIP_LINES_PATTERN" || true)

      if [[ -n "$hits" ]]; then
        echo "BANNED TERM: \"$term\" in $file"
        echo "$hits" | head -3 | sed 's/^/  /'
        FOUND=1
      fi
    done < <(grep -r -i -l "$term" "$dir" \
        --include="*.tsx" --include="*.ts" \
        2>/dev/null || true)
  done
done

if [[ "$FOUND" -eq 0 ]]; then
  echo "check:trust PASSED — no banned terms found in V1-visible surfaces."
  exit 0
else
  echo ""
  echo "check:trust FAILED — banned language detected in visible copy. Fix before shipping."
  exit 1
fi
