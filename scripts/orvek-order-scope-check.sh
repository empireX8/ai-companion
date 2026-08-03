#!/usr/bin/env bash
# ORVEK MINIMAL ORDER AND SCOPE GATE (SUBSYS-000)
#
# Static check only. Declares one subsystem, checks upstream ledger status
# from the BASE commit/ref, and enforces scope for paths reported by Git,
# including both sides of reported renames. Copy-source provenance is NOT_BUILT.
#
# Never inspects, transforms, logs or blocks user/product data.
#
# Config claim: config/orvek-subsystem-scope.json is loaded from the evaluated
# tree (typically HEAD). It is not self-protected and is not base-owned
# enforcement. Modifications to the gate or config require manual review.
# Guard self-protection remains NOT_BUILT. Repository-admin resistance
# remains NOT_BUILT.
#
# Usage:
#   bash scripts/orvek-order-scope-check.sh [--base=<ref>] [--head=<ref>] [--subsystem=SUBSYS-NNN]
#   bash scripts/orvek-order-scope-check.sh --pr-body-file=<path> [--base=<ref>] [--head=<ref>]
#   bash scripts/orvek-order-scope-check.sh self-test
#
# Exit 0 on PASS, 1 on FAIL.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONFIG_REL="config/orvek-subsystem-scope.json"

MODE="check"
BASE_REF=""
HEAD_REF="HEAD"
SUBSYSTEM=""
PR_BODY_FILE=""
REPO="${REPO_ROOT}"

fail() {
  echo "ORVEK ORDER/SCOPE: FAIL — $*" >&2
  exit 1
}

pass() {
  echo "ORVEK ORDER/SCOPE: PASS — $*"
}

usage() {
  fail "usage: $0 [--base=<ref>] [--head=<ref>] [--subsystem=SUBSYS-NNN] [--pr-body-file=<path>] | self-test"
}

for arg in "$@"; do
  case "$arg" in
    self-test) MODE="self-test" ;;
    --base=*) BASE_REF="${arg#--base=}" ;;
    --head=*) HEAD_REF="${arg#--head=}" ;;
    --subsystem=*) SUBSYSTEM="${arg#--subsystem=}" ;;
    --pr-body-file=*) PR_BODY_FILE="${arg#--pr-body-file=}" ;;
    --repo=*) REPO="${arg#--repo=}" ;;
    --config=*) CONFIG_REL="${arg#--config=}" ;;
    -h|--help) usage ;;
    *) fail "unknown argument: $arg" ;;
  esac
done

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

path_matches_allowed_entry() {
  local path="$1"
  local allowed="$2"
  if [[ "$allowed" == */ ]]; then
    [[ "$path" == "$allowed"* ]]
  else
    [[ "$path" == "$allowed" ]]
  fi
}

path_allowed() {
  local path="$1"
  local allowed_json="$2"
  local entry
  while IFS= read -r entry; do
    [[ -z "$entry" ]] && continue
    if path_matches_allowed_entry "$path" "$entry"; then
      return 0
    fi
  done < <(printf '%s' "$allowed_json" | jq -r '.[]')
  return 1
}

path_forbidden() {
  local path="$1"
  local forbidden_json="$2"
  local entry
  while IFS= read -r entry; do
    [[ -z "$entry" ]] && continue
    # Same exact-vs-directory rule as the allowlist.
    if path_matches_allowed_entry "$path" "$entry"; then
      return 0
    fi
  done < <(printf '%s' "$forbidden_json" | jq -r '.[]')
  return 1
}

read_json_status() {
  local ledger_json="$1"
  local id="$2"
  jq -r --arg id "$id" '
    (.subsystems // [])
    | map(select(.id == $id))
    | if length == 0 then empty else .[0].status end
  ' "$ledger_json"
}

read_markdown_status() {
  local ledger_md="$1"
  local id="$2"
  # Matches headings like: ### SUBSYS-003 — ... followed later by **Status:** `FOO`
  awk -v id="$id" '
    $0 ~ "^### " id "([^0-9]|$)" { in_section=1; next }
    in_section && /^### / { exit }
    in_section && /\*\*Status:\*\*/ {
      if (match($0, /`[^`]+`/)) {
        status=substr($0, RSTART+1, RLENGTH-2)
        gsub(/\.$/, "", status)
        print status
        exit
      }
    }
  ' "$ledger_md"
}

extract_subsystems_from_text() {
  # Unique SUBSYS-NNN tokens from declaration text.
  grep -oE 'SUBSYS-[0-9]{3}' <<<"$1" | sort -u
}

load_pr_body() {
  if [[ -n "$PR_BODY_FILE" ]]; then
    [[ -f "$PR_BODY_FILE" ]] || fail "PR body file not found: $PR_BODY_FILE"
    cat "$PR_BODY_FILE"
  elif [[ -n "${ORVEK_PR_BODY:-}" ]]; then
    printf '%s' "$ORVEK_PR_BODY"
  fi
}

maybe_skip_non_orvek() {
  [[ -z "$SUBSYSTEM" ]] || return 1

  local body
  body="$(load_pr_body)"
  [[ -n "$body" ]] || return 1

  local applicability_count applicability_line applicability
  applicability_count="$(grep -c -E '^\*\*Orvek applicability:\*\*' <<<"$body" || true)"
  [[ "$applicability_count" -le 1 ]] \
    || fail "PR body must contain at most one Orvek applicability field (found ${applicability_count})"
  [[ "$applicability_count" -eq 1 ]] || return 1

  applicability_line="$(grep -E '^\*\*Orvek applicability:\*\*' <<<"$body")"
  applicability="$(sed -E 's/^\*\*Orvek applicability:\*\*[[:space:]]*//' <<<"$applicability_line")"

  case "$applicability" in
    APPLICABLE) return 1 ;;
    NOT_APPLICABLE)
      local reason_count reason_line reason
      reason_count="$(grep -c -E '^\*\*Why not Orvek work:\*\*' <<<"$body" || true)"
      [[ "$reason_count" -eq 1 ]] \
        || fail "NOT_APPLICABLE requires exactly one Why not Orvek work field (found ${reason_count})"
      reason_line="$(grep -E '^\*\*Why not Orvek work:\*\*' <<<"$body")"
      reason="$(sed -E 's/^\*\*Why not Orvek work:\*\*[[:space:]]*//' <<<"$reason_line")"
      [[ -n "$reason" && "$reason" != "NOT_APPLICABLE" && "$reason" != REPLACE_* ]] \
        || fail "NOT_APPLICABLE requires a concrete reason"
      return 0
      ;;
    *) fail "Orvek applicability must be APPLICABLE or NOT_APPLICABLE" ;;
  esac
}

resolve_subsystem() {
  if [[ -n "$SUBSYSTEM" ]]; then
    printf '%s' "$SUBSYSTEM"
    return
  fi

  local body
  body="$(load_pr_body)"
  [[ -n "$body" ]] \
    || fail "no subsystem declared: pass --subsystem=SUBSYS-NNN or --pr-body-file=..."

  local active_count active ids count
  active_count="$(grep -c -E '^\*\*Active subsystem:\*\*' <<<"$body" || true)"
  [[ "$active_count" -eq 1 ]] \
    || fail "PR body must contain exactly one Active subsystem field (found ${active_count})"

  active="$(grep -E '^\*\*Active subsystem:\*\*' <<<"$body")"
  ids="$(extract_subsystems_from_text "$active")"
  count="$(grep -c . <<<"$ids" || true)"
  [[ "$count" -eq 1 ]] \
    || fail "Active subsystem field must declare exactly one SUBSYS-NNN (found ${count:-0})"
  printf '%s' "$ids"
}

run_check() {
  require_cmd git
  require_cmd jq

  if maybe_skip_non_orvek; then
    pass "non-Orvek PR skipped"
    return
  fi

  local config_path="${REPO}/${CONFIG_REL}"
  [[ -f "$config_path" ]] || fail "missing scope config: ${CONFIG_REL}"

  local subsystem
  subsystem="$(resolve_subsystem)"
  [[ "$subsystem" =~ ^SUBSYS-[0-9]{3}$ ]] || fail "invalid subsystem id: $subsystem"

  local entry
  entry="$(jq -c --arg id "$subsystem" '.subsystems[$id] // empty' "$config_path")"
  [[ -n "$entry" ]] || fail "unknown subsystem: $subsystem (not in ${CONFIG_REL})"

  local ledger_json_rel ledger_md_rel
  ledger_json_rel="$(jq -r '.ledger.json' "$config_path")"
  ledger_md_rel="$(jq -r '.ledger.markdown' "$config_path")"
  local ledger_json="${REPO}/${ledger_json_rel}"
  local ledger_md="${REPO}/${ledger_md_rel}"
  [[ -f "$ledger_json" ]] || fail "missing ledger JSON: ${ledger_json_rel}"
  [[ -f "$ledger_md" ]] || fail "missing ledger Markdown: ${ledger_md_rel}"

  # Declared-subsystem Markdown/JSON parity is judged on the evaluated tree
  # (HEAD / working copy). Upstream status is judged on BASE only (below).
  local json_status md_status
  json_status="$(read_json_status "$ledger_json" "$subsystem" || true)"
  md_status="$(read_markdown_status "$ledger_md" "$subsystem" || true)"
  [[ -n "$json_status" ]] || fail "subsystem $subsystem absent from ledger JSON"
  [[ -n "$md_status" ]] || fail "subsystem $subsystem absent from ledger Markdown"
  [[ "$json_status" == "$md_status" ]] \
    || fail "Markdown/JSON status disagree for ${subsystem}: markdown=${md_status} json=${json_status}"

  if [[ -z "$BASE_REF" ]]; then
    if git -C "$REPO" rev-parse --verify origin/staging >/dev/null 2>&1; then
      BASE_REF="origin/staging"
    else
      BASE_REF="$(git -C "$REPO" rev-parse HEAD~1 2>/dev/null || true)"
      [[ -n "$BASE_REF" ]] || fail "cannot resolve base ref; pass --base=<ref>"
    fi
  fi

  git -C "$REPO" rev-parse --verify "$BASE_REF" >/dev/null 2>&1 \
    || fail "base ref not found: $BASE_REF"
  git -C "$REPO" rev-parse --verify "$HEAD_REF" >/dev/null 2>&1 \
    || fail "head ref not found: $HEAD_REF"

  # Upstream statuses come only from BASE. A promotion in the current diff
  # cannot unlock a downstream consumer in the same PR.
  local upstream required_status up_status
  while IFS=$'\t' read -r upstream required_status; do
    [[ -z "$upstream" ]] && continue
    [[ -n "$required_status" ]] || fail "requiredUpstream for ${upstream} must declare an exact status"
    up_status="$(
      git -C "$REPO" show "${BASE_REF}:${ledger_json_rel}" 2>/dev/null \
        | jq -r --arg id "$upstream" '
            (.subsystems // [])
            | map(select(.id == $id))
            | if length == 0 then empty else .[0].status end
          ' || true
    )"
    [[ -n "$up_status" ]] || fail "required upstream ${upstream} missing from BASE ledger JSON"
    if [[ "$up_status" != "$required_status" ]]; then
      fail "upstream ${upstream} on BASE is ${up_status}; ${subsystem} requires exactly ${required_status}"
    fi
  done < <(printf '%s' "$entry" | jq -r '(.requiredUpstream // {}) | to_entries[] | "\(.key)\t\(.value)"')

  local allowed forbidden
  allowed="$(printf '%s' "$entry" | jq -c '.allowedPathPrefixes')"
  forbidden="$(printf '%s' "$entry" | jq -c '.forbiddenPathPrefixes // []')"

  local diff_out
  # Exact collection command required by the gate contract. Diff failure must
  # fail closed — never treat an uncomputable range as an empty change list.
  if ! diff_out="$(
    git -C "$REPO" diff \
      --name-status \
      --find-renames \
      "${BASE_REF}...${HEAD_REF}"
  )"; then
    fail "cannot compute diff for ${BASE_REF}...${HEAD_REF}"
  fi

  local line status path other
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    status="${line%%$'\t'*}"
    status="${status:0:1}"
    case "$status" in
      R|C)
        path="$(printf '%s' "$line" | cut -f2)"
        other="$(printf '%s' "$line" | cut -f3)"
        [[ -n "$path" && -n "$other" ]] || fail "malformed rename/copy line: $line"
        if path_forbidden "$path" "$forbidden" || path_forbidden "$other" "$forbidden"; then
          fail "forbidden path in rename/copy (${status}): ${path} -> ${other}"
        fi
        if ! path_allowed "$path" "$allowed" || ! path_allowed "$other" "$allowed"; then
          fail "rename/copy outside allowed scope (${status}): ${path} -> ${other}"
        fi
        ;;
      A|M|D|T|U)
        path="$(printf '%s' "$line" | cut -f2)"
        [[ -n "$path" ]] || fail "malformed change line: $line"
        if path_forbidden "$path" "$forbidden"; then
          fail "forbidden changed path: ${path}"
        fi
        if ! path_allowed "$path" "$allowed"; then
          fail "changed path outside allowed scope for ${subsystem}: ${path}"
        fi
        ;;
      *)
        fail "unrecognised name-status: $line"
        ;;
    esac
  done <<<"$diff_out"

  pass "${subsystem} order/scope check (${BASE_REF}...${HEAD_REF})"
}

# ── Self-tests (TEST 1..12) ────────────────────────────────────────────────────

selftest_init_repo() {
  local root="$1"
  mkdir -p "$root"
  git -C "$root" init -q -b staging
  git -C "$root" config user.email "order-scope@example.test"
  git -C "$root" config user.name "Orvek Order Scope"
  git -C "$root" config commit.gpgsign false
}

selftest_write_ledgers() {
  local root="$1"
  local s000="$2"
  local s002="$3"
  local s003="$4"
  mkdir -p "${root}/docs/architecture"
  cat > "${root}/docs/architecture/ORVEK-SUBSYSTEM-ORDER-AND-EXPECTED-INCOMPLETENESS-001.json" <<EOF
{
  "subsystems": [
    { "id": "SUBSYS-000", "status": "${s000}" },
    { "id": "SUBSYS-002", "status": "${s002}" },
    { "id": "SUBSYS-003", "status": "${s003}" },
    { "id": "SUBSYS-004", "status": "DESIGNED_NOT_BUILT" }
  ]
}
EOF
  cat > "${root}/docs/architecture/ORVEK-SUBSYSTEM-ORDER-AND-EXPECTED-INCOMPLETENESS-001.md" <<EOF
### SUBSYS-000 — Execution ledger
**Status:** \`${s000}\`.

### SUBSYS-002 — Inspector reader
**Status:** \`${s002}\`.

### SUBSYS-003 — Evidence drill-down
**Status:** \`${s003}\`.

### SUBSYS-004 — Related objects
**Status:** \`DESIGNED_NOT_BUILT\`.
EOF
}

selftest_write_config() {
  local root="$1"
  mkdir -p "${root}/config"
  cat > "${root}/config/orvek-subsystem-scope.json" <<'EOF'
{
  "policyVersion": 1,
  "ledger": {
    "markdown": "docs/architecture/ORVEK-SUBSYSTEM-ORDER-AND-EXPECTED-INCOMPLETENESS-001.md",
    "json": "docs/architecture/ORVEK-SUBSYSTEM-ORDER-AND-EXPECTED-INCOMPLETENESS-001.json"
  },
  "subsystems": {
    "SUBSYS-000": {
      "requiredUpstream": {},
      "allowedPathPrefixes": [
        "package.json",
        "config/orvek-subsystem-scope.json",
        "docs/architecture/ORVEK-SUBSYSTEM-ORDER-AND-EXPECTED-INCOMPLETENESS-001.md",
        "docs/architecture/ORVEK-SUBSYSTEM-ORDER-AND-EXPECTED-INCOMPLETENESS-001.json"
      ],
      "forbiddenPathPrefixes": ["app/", "components/", "prisma/"]
    },
    "SUBSYS-003": {
      "requiredUpstream": {
        "SUBSYS-002": "PROVEN_BOUNDED"
      },
      "allowedPathPrefixes": [
        "components/orvek-v0-authority/",
        "docs/architecture/"
      ],
      "forbiddenPathPrefixes": ["prisma/", "app/"]
    },
    "SUBSYS-004": {
      "requiredUpstream": {
        "SUBSYS-003": "PROVEN_BOUNDED"
      },
      "allowedPathPrefixes": [
        "components/orvek-v0-authority/",
        "docs/architecture/"
      ],
      "forbiddenPathPrefixes": ["prisma/", "app/"]
    }
  }
}
EOF
}

selftest_commit() {
  local root="$1"
  local msg="$2"
  git -C "$root" add -A
  git -C "$root" commit -q -m "$msg"
  git -C "$root" rev-parse HEAD
}

expect_pass() {
  local name="$1"
  shift
  if "$@" >/tmp/orvek-order-scope-out.txt 2>/tmp/orvek-order-scope-err.txt; then
    echo "  PASS  ${name}"
  else
    echo "  FAIL  ${name} (expected PASS)" >&2
    cat /tmp/orvek-order-scope-err.txt >&2 || true
    return 1
  fi
}

expect_fail() {
  local name="$1"
  shift
  if "$@" >/tmp/orvek-order-scope-out.txt 2>/tmp/orvek-order-scope-err.txt; then
    echo "  FAIL  ${name} (expected FAIL)" >&2
    cat /tmp/orvek-order-scope-out.txt >&2 || true
    return 1
  else
    echo "  PASS  ${name}"
  fi
}

run_self_test() {
  require_cmd git
  require_cmd jq
  local checker="${REPO_ROOT}/scripts/orvek-order-scope-check.sh"
  local failures=0
  SELFTEST_TMP="$(mktemp -d "${TMPDIR:-/tmp}/orvek-order-scope.XXXXXX")"
  trap 'rm -rf "${SELFTEST_TMP:-}"' EXIT

  echo "ORVEK ORDER/SCOPE self-test"

  # TEST 1: valid SUBSYS-003, proven SUBSYS-002, allowed paths only → PASS
  local t1="${SELFTEST_TMP}/t1"
  selftest_init_repo "$t1"
  selftest_write_ledgers "$t1" "DESIGNED_NOT_BUILT" "PROVEN_BOUNDED" "NOT_ACCEPTED"
  selftest_write_config "$t1"
  mkdir -p "${t1}/components/orvek-v0-authority"
  echo 'export const x = 1' > "${t1}/components/orvek-v0-authority/evidence-panel.tsx"
  local t1_base
  t1_base="$(selftest_commit "$t1" "base")"
  echo 'export const x = 2' > "${t1}/components/orvek-v0-authority/evidence-panel.tsx"
  local t1_head
  t1_head="$(selftest_commit "$t1" "allowed change")"
  expect_pass "TEST 1: valid SUBSYS-003 with proven upstream and allowed paths" \
    bash "$checker" --repo="$t1" --base="$t1_base" --head="$t1_head" --subsystem=SUBSYS-003 \
    || failures=$((failures + 1))

  # TEST 2: SUBSYS-004 while SUBSYS-003 not accepted → FAIL
  local t2="${SELFTEST_TMP}/t2"
  selftest_init_repo "$t2"
  selftest_write_ledgers "$t2" "DESIGNED_NOT_BUILT" "PROVEN_BOUNDED" "NOT_ACCEPTED"
  selftest_write_config "$t2"
  mkdir -p "${t2}/components/orvek-v0-authority"
  echo 'a' > "${t2}/components/orvek-v0-authority/related.tsx"
  local t2_base
  t2_base="$(selftest_commit "$t2" "base")"
  echo 'b' > "${t2}/components/orvek-v0-authority/related.tsx"
  local t2_head
  t2_head="$(selftest_commit "$t2" "head")"
  expect_fail "TEST 2: SUBSYS-004 blocked while SUBSYS-003 not accepted" \
    bash "$checker" --repo="$t2" --base="$t2_base" --head="$t2_head" --subsystem=SUBSYS-004 \
    || failures=$((failures + 1))

  # TEST 3: two subsystem IDs declared → FAIL
  local t3="${SELFTEST_TMP}/t3"
  selftest_init_repo "$t3"
  selftest_write_ledgers "$t3" "DESIGNED_NOT_BUILT" "PROVEN_BOUNDED" "NOT_ACCEPTED"
  selftest_write_config "$t3"
  mkdir -p "${t3}/components/orvek-v0-authority"
  echo 'a' > "${t3}/components/orvek-v0-authority/evidence-panel.tsx"
  local t3_base
  t3_base="$(selftest_commit "$t3" "base")"
  echo 'b' > "${t3}/components/orvek-v0-authority/evidence-panel.tsx"
  local t3_head
  t3_head="$(selftest_commit "$t3" "head")"
  printf '%s\n' '**Active subsystem:** SUBSYS-003 and also SUBSYS-004' > "${t3}/pr-body.txt"
  expect_fail "TEST 3: two subsystem IDs declared" \
    bash "$checker" --repo="$t3" --base="$t3_base" --head="$t3_head" --pr-body-file="${t3}/pr-body.txt" \
    || failures=$((failures + 1))

  # TEST 4: changed file outside allowed paths → FAIL
  local t4="${SELFTEST_TMP}/t4"
  selftest_init_repo "$t4"
  selftest_write_ledgers "$t4" "DESIGNED_NOT_BUILT" "PROVEN_BOUNDED" "NOT_ACCEPTED"
  selftest_write_config "$t4"
  mkdir -p "${t4}/components/orvek-v0-authority" "${t4}/lib/unrelated"
  echo 'a' > "${t4}/components/orvek-v0-authority/evidence-panel.tsx"
  echo 'x' > "${t4}/lib/unrelated/helper.ts"
  local t4_base
  t4_base="$(selftest_commit "$t4" "base")"
  echo 'y' > "${t4}/lib/unrelated/helper.ts"
  local t4_head
  t4_head="$(selftest_commit "$t4" "out of scope")"
  expect_fail "TEST 4: changed file outside allowed paths" \
    bash "$checker" --repo="$t4" --base="$t4_base" --head="$t4_head" --subsystem=SUBSYS-003 \
    || failures=$((failures + 1))

  # TEST 5: rename into/out of allowed scope → FAIL
  local t5="${SELFTEST_TMP}/t5"
  selftest_init_repo "$t5"
  selftest_write_ledgers "$t5" "DESIGNED_NOT_BUILT" "PROVEN_BOUNDED" "NOT_ACCEPTED"
  selftest_write_config "$t5"
  mkdir -p "${t5}/components/orvek-v0-authority" "${t5}/lib/elsewhere"
  echo 'panel' > "${t5}/components/orvek-v0-authority/evidence-panel.tsx"
  local t5_base
  t5_base="$(selftest_commit "$t5" "base")"
  mkdir -p "${t5}/lib/elsewhere"
  git -C "$t5" mv \
    components/orvek-v0-authority/evidence-panel.tsx \
    lib/elsewhere/evidence-panel.tsx
  local t5_head
  t5_head="$(selftest_commit "$t5" "rename out of scope")"
  expect_fail "TEST 5: rename moves path outside allowed scope" \
    bash "$checker" --repo="$t5" --base="$t5_base" --head="$t5_head" --subsystem=SUBSYS-003 \
    || failures=$((failures + 1))

  # TEST 6: Markdown/JSON ledger statuses disagree → FAIL
  local t6="${SELFTEST_TMP}/t6"
  selftest_init_repo "$t6"
  selftest_write_ledgers "$t6" "DESIGNED_NOT_BUILT" "PROVEN_BOUNDED" "NOT_ACCEPTED"
  selftest_write_config "$t6"
  mkdir -p "${t6}/components/orvek-v0-authority"
  echo 'a' > "${t6}/components/orvek-v0-authority/evidence-panel.tsx"
  # Break Markdown status for SUBSYS-003 only.
  sed -i.bak 's/\*\*Status:\*\* `NOT_ACCEPTED`\./**Status:** `PROVEN_BOUNDED`./' \
    "${t6}/docs/architecture/ORVEK-SUBSYSTEM-ORDER-AND-EXPECTED-INCOMPLETENESS-001.md"
  # The sed above may change the first Status match depending on file order;
  # force the SUBSYS-003 section explicitly.
  cat > "${t6}/docs/architecture/ORVEK-SUBSYSTEM-ORDER-AND-EXPECTED-INCOMPLETENESS-001.md" <<'EOF'
### SUBSYS-000 — Execution ledger
**Status:** `DESIGNED_NOT_BUILT`.

### SUBSYS-002 — Inspector reader
**Status:** `PROVEN_BOUNDED`.

### SUBSYS-003 — Evidence drill-down
**Status:** `PROVEN_BOUNDED`.

### SUBSYS-004 — Related objects
**Status:** `DESIGNED_NOT_BUILT`.
EOF
  local t6_base
  t6_base="$(selftest_commit "$t6" "base")"
  echo 'b' > "${t6}/components/orvek-v0-authority/evidence-panel.tsx"
  local t6_head
  t6_head="$(selftest_commit "$t6" "head")"
  expect_fail "TEST 6: Markdown and JSON ledger statuses disagree" \
    bash "$checker" --repo="$t6" --base="$t6_base" --head="$t6_head" --subsystem=SUBSYS-003 \
    || failures=$((failures + 1))

  # TEST 7: same-diff upstream promotion cannot unlock downstream → FAIL
  local t7="${SELFTEST_TMP}/t7"
  selftest_init_repo "$t7"
  selftest_write_ledgers "$t7" "DESIGNED_NOT_BUILT" "PROVEN_BOUNDED" "NOT_ACCEPTED"
  selftest_write_config "$t7"
  mkdir -p "${t7}/components/orvek-v0-authority"
  echo 'a' > "${t7}/components/orvek-v0-authority/related.tsx"
  local t7_base
  t7_base="$(selftest_commit "$t7" "base")"
  # Same diff: promote SUBSYS-003 on HEAD and change SUBSYS-004 files.
  selftest_write_ledgers "$t7" "DESIGNED_NOT_BUILT" "PROVEN_BOUNDED" "PROVEN_BOUNDED"
  echo 'b' > "${t7}/components/orvek-v0-authority/related.tsx"
  local t7_head
  t7_head="$(selftest_commit "$t7" "same-diff promotion plus consumer")"
  expect_fail "TEST 7: same-diff SUBSYS-003 promotion cannot unlock SUBSYS-004" \
    bash "$checker" --repo="$t7" --base="$t7_base" --head="$t7_head" --subsystem=SUBSYS-004 \
    || failures=$((failures + 1))

  # TEST 8: SUPPORTED_PARTIAL is not generically sufficient for PROVEN_BOUNDED → FAIL
  local t8="${SELFTEST_TMP}/t8"
  selftest_init_repo "$t8"
  selftest_write_ledgers "$t8" "DESIGNED_NOT_BUILT" "PROVEN_BOUNDED" "SUPPORTED_PARTIAL"
  selftest_write_config "$t8"
  mkdir -p "${t8}/components/orvek-v0-authority"
  echo 'a' > "${t8}/components/orvek-v0-authority/related.tsx"
  local t8_base
  t8_base="$(selftest_commit "$t8" "base")"
  echo 'b' > "${t8}/components/orvek-v0-authority/related.tsx"
  local t8_head
  t8_head="$(selftest_commit "$t8" "head")"
  expect_fail "TEST 8: SUPPORTED_PARTIAL does not satisfy required PROVEN_BOUNDED" \
    bash "$checker" --repo="$t8" --base="$t8_base" --head="$t8_head" --subsystem=SUBSYS-004 \
    || failures=$((failures + 1))

  # TEST 9: uncomputable three-dot diff must fail closed, not PASS empty
  local t9="${SELFTEST_TMP}/t9"
  selftest_init_repo "$t9"
  selftest_write_ledgers "$t9" "DESIGNED_NOT_BUILT" "PROVEN_BOUNDED" "NOT_ACCEPTED"
  selftest_write_config "$t9"
  mkdir -p "${t9}/components/orvek-v0-authority"
  echo 'a' > "${t9}/components/orvek-v0-authority/evidence-panel.tsx"
  local t9_base
  t9_base="$(selftest_commit "$t9" "base lineage")"
  # Orphan commit with no merge base against t9_base.
  git -C "$t9" checkout --orphan orphan-lineage -q
  git -C "$t9" rm -rf --quiet . >/dev/null 2>&1 || true
  selftest_write_ledgers "$t9" "DESIGNED_NOT_BUILT" "PROVEN_BOUNDED" "NOT_ACCEPTED"
  selftest_write_config "$t9"
  mkdir -p "${t9}/components/orvek-v0-authority"
  echo 'orphan' > "${t9}/components/orvek-v0-authority/evidence-panel.tsx"
  local t9_head
  t9_head="$(selftest_commit "$t9" "orphan lineage")"
  if git -C "$t9" merge-base "$t9_base" "$t9_head" >/dev/null 2>&1; then
    echo "  FAIL  TEST 9 setup: unexpected merge base exists" >&2
    failures=$((failures + 1))
  else
    expect_fail "TEST 9: diff computation failure fails closed" \
      bash "$checker" --repo="$t9" --base="$t9_base" --head="$t9_head" --subsystem=SUBSYS-003 \
      || failures=$((failures + 1))
  fi

  # TEST 10: exact filename boundary — package.json must not match package.json.evil
  local t10="${SELFTEST_TMP}/t10"
  selftest_init_repo "$t10"
  selftest_write_ledgers "$t10" "DESIGNED_NOT_BUILT" "PROVEN_BOUNDED" "NOT_ACCEPTED"
  selftest_write_config "$t10"
  echo '{"name":"base"}' > "${t10}/package.json"
  local t10_base
  t10_base="$(selftest_commit "$t10" "base")"
  echo 'evil' > "${t10}/package.json.evil"
  local t10_head
  t10_head="$(selftest_commit "$t10" "evil sibling filename")"
  expect_fail "TEST 10: exact filename boundary rejects package.json.evil" \
    bash "$checker" --repo="$t10" --base="$t10_base" --head="$t10_head" --subsystem=SUBSYS-000 \
    || failures=$((failures + 1))

  # TEST 11: duplicate Active subsystem fields must fail
  local t11="${SELFTEST_TMP}/t11"
  selftest_init_repo "$t11"
  selftest_write_ledgers "$t11" "DESIGNED_NOT_BUILT" "PROVEN_BOUNDED" "NOT_ACCEPTED"
  selftest_write_config "$t11"
  mkdir -p "${t11}/components/orvek-v0-authority"
  echo 'a' > "${t11}/components/orvek-v0-authority/evidence-panel.tsx"
  local t11_base
  t11_base="$(selftest_commit "$t11" "base")"
  echo 'b' > "${t11}/components/orvek-v0-authority/evidence-panel.tsx"
  local t11_head
  t11_head="$(selftest_commit "$t11" "head")"
  cat > "${t11}/pr-body.txt" <<'EOF'
**Orvek applicability:** APPLICABLE
**Active subsystem:** SUBSYS-003
**Active subsystem:** SUBSYS-004
EOF
  expect_fail "TEST 11: duplicate Active subsystem fields are rejected" \
    bash "$checker" --repo="$t11" --base="$t11_base" --head="$t11_head" --pr-body-file="${t11}/pr-body.txt" \
    || failures=$((failures + 1))

  # TEST 12: declared non-Orvek PR with concrete reason is skipped
  local t12="${SELFTEST_TMP}/t12"
  selftest_init_repo "$t12"
  selftest_write_ledgers "$t12" "DESIGNED_NOT_BUILT" "PROVEN_BOUNDED" "NOT_ACCEPTED"
  selftest_write_config "$t12"
  echo 'base' > "${t12}/README.md"
  local t12_base
  t12_base="$(selftest_commit "$t12" "base")"
  echo 'head' > "${t12}/README.md"
  local t12_head
  t12_head="$(selftest_commit "$t12" "head")"
  cat > "${t12}/pr-body.txt" <<'EOF'
**Orvek applicability:** NOT_APPLICABLE
**Why not Orvek work:** Documentation outside Orvek product and engineering paths.
**Active subsystem:** SUBSYS-NNN
EOF
  expect_pass "TEST 12: non-Orvek PR with concrete reason is skipped" \
    bash "$checker" --repo="$t12" --base="$t12_base" --head="$t12_head" --pr-body-file="${t12}/pr-body.txt" \
    || failures=$((failures + 1))

  if [[ "$failures" -gt 0 ]]; then
    fail "${failures} self-test(s) failed"
  fi
  pass "self-test (TEST 1..12)"
}

if [[ "$MODE" == "self-test" ]]; then
  run_self_test
else
  run_check
fi
