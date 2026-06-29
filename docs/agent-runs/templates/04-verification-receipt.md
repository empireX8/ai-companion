# Verification Receipt — {SLICE_ID}

**Date:** {YYYY-MM-DD}  
**Branch:** {branch}

---

## Commands

| Command | Result |
|---------|--------|
| `git diff --check` | {PASS/FAIL} |
| `npx tsc --noEmit` | {PASS/FAIL} |
| Targeted tests | {PASS/FAIL — list files} |
| `npm run build` | {PASS/FAIL} |
| `bash scripts/verify-mindlab.sh` | {PASS/FAIL} |
| Harness checks | {check-agent-closeout, check-legacy-inspector-routes, etc.} |

---

## Data-path proof

| Check | Result |
|-------|--------|
| {acceptance record} | {PASS/FAIL — evidence} |

---

## Mechanical enforcement added/updated

- {test or script — what it guards}

---

## Known gaps (tests green, product unproven)

- {list}

**Automated verification complete:** {yes | no — do not claim product PASS}
