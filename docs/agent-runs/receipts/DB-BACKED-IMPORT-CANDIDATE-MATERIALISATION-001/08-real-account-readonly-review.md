# 08 — Real account review (script + human gate)

## Automated read-only method

```bash
set -a && source .env && set +a
node docs/agent-runs/receipts/DB-BACKED-IMPORT-CANDIDATE-MATERIALISATION-001/readonly-kay-import-review-gate.mjs
```

Script: `readonly-kay-import-review-gate.mjs`
Output: `readonly-kay-import-review-gate.json`

### Automated proven (read-only)

| Check | Result |
|-------|--------|
| Genuine DB pending count | **54** (29 ReferenceItem + 25 ContradictionNode) |
| Seed `dev-exact-rt-…-import-cand-ic1..ic4` absent from production query | **Yes** |
| Provenance inspectable (`import_derived_session` + source session/message) | **Yes** |
| PatternClaims still 7 | **Yes** |
| Any accept/reject / mutation | **No** (`mutationsPerformed: false`) |
| Seed composition still present in DB (not cleaned) | Yes — expected; production Import path ignores it |

## Kay human review gate

**Status: PASS**

Kay manually opened the canonical Import modal and confirmed:

| Check | Result |
|-------|--------|
| Modal reports 54 genuine pending candidates | **PASS** |
| Candidates contain real wording from imported conversations | **PASS** |
| Conversation ID visible | **PASS** |
| Source message ID visible | **PASS** |
| Import batch ID visible | **PASS** |
| Provenance visible as import-derived | **PASS** |
| Both candidate sources represented (ReferenceItem + ContradictionNode) | **PASS** |
| Four synthetic seed Import-review candidates not used | **PASS** |
| Kay did not click Accept, Reject, or Keep as receipt only | **PASS** |
| Kay’s real candidates remain unmodified | **PASS** |

### Clarification (Today → Receipts resurfaced)

The three cards under Today → Receipts resurfaced are **separate** from Import review candidates. They may still come from the existing full-reference seed. This campaign was not asked to clean that seed. Their presence outside the Import modal does **not** invalidate the DB-backed Import review PASS.

## Recorded human result

| Gate | Result |
|------|--------|
| REAL IMPORT CANDIDATES VISIBLE | **PASS** |
| PROVENANCE INSPECTABLE | **PASS** |
| SEED IMPORT CANDIDATES ABSENT | **PASS** |
| KAY ACCOUNT MUTATED | **NO** |
| REAL-ACCOUNT MATERIALISATION | **NOT YET PROVEN** |
