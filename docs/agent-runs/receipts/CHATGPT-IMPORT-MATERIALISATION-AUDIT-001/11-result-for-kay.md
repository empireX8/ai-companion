# 11 — Result for Kay

## Final status

| Gate | Result |
|------|--------|
| **AUDIT** | **PASS** |
| **AUTOMATIC MATERIALISATION** | **FAIL** |
| **FIRST REPAIR SLICE** | **DB-BACKED CANDIDATE REVIEW AND MATERIALISATION** |
| **NEW CANONICAL UPLOAD UI** | **LATER CAMPAIGN** |
| **PRODUCTION READINESS** | **NO** |

## Verdict

**AUDIT COMPLETE — EXISTING IMPORT MATERIALISATION FAILURE LOCATED**

Kay accepts this diagnosis. This branch records the audit only — no repair implementation, no seed cleanup, no product behaviour change.

## Authoritative conclusions

- Historical ChatGPT archive is **present** (640 / 18,582; upload `cmp2ftxhj0000qlsyxi55jo20` complete)
- Historical ingestion and analysis **ran** (635 completed import derivation runs; 5,922 spans)
- Real spans and candidates were **generated** (29 ReferenceItem + 25 ContradictionNode, all still `candidate`)
- Automatic end-to-end materialisation does **not** work at the required bar
- Main failure: **candidate review / materialisation**
- Current canonical Import surface is **review-only**
- It is currently populated by **four full-reference seed candidates** (`dev-exact-rt-…-import-cand-ic1..ic4`)
- It is **not** connected to real import-derived candidates
- Accept/reject does **not** persist
- Missing current-shell archive upload UI is a **separate future UX gap**
- Seeded presentation data currently **masks** the real account state

## Partial automatic side-effects (not complete materialisation)

The **7** active PatternClaims and **1** import-linked UserMap + **1** ModelUpdate prove that *some* post-import writes can occur. They are **not** proof of complete automatic archive → canonical-model extrapolation.

## Repair sequencing to record

1. Connect canonical Import review to genuine database candidates  
2. Persist accept/reject decisions  
3. Materialise accepted candidates into receipts, typed objects, links, provenance, model movement  
4. Prove current canonical providers surface the materialised records  
5. Clean the full-reference seed **only after** that replacement path exists, immediately before genuine-data verification  
6. Repair extraction/filter coverage **after** the downstream chain is proven  
7. Build a new canonical archive-upload UX in a **later separate campaign**

## Headline counts

**Import-derived:** batches 1 · conversations 640 · messages 18,582 · spans 5,922 · import runs completed 635 · ref candidates 29 · contra candidates 25 · pattern claims 7 · UM 1 · MU 1  

**Seed:** composition 1 (67 objects) · importReview seed candidates 4 · report 1  

**Native:** APP sessions 3 · APP messages 44  

Evidence: `audit-readonly-counts.json`, `audit-readonly-traces.json`, `audit-readonly-seed-and-uel.json`

## Branch hygiene

| Check | Result |
|-------|--------|
| Only audit receipts / JSON / read-only scripts added | Yes |
| Product source code changed | No |
| Schema / migration changed | No |
| Database writes | No (read-only Prisma/`$queryRaw` selects) |
| Seed cleanup executed | No |
| Baseline | `7eb7792` on `desktop-chatgpt-import-materialisation-audit-001` |

## Changed files

All under `docs/agent-runs/receipts/CHATGPT-IMPORT-MATERIALISATION-AUDIT-001/`:

- `00`–`11` markdown receipts  
- `audit-readonly-counts.mjs`, `audit-readonly-traces.mjs`, `audit-readonly-seed-and-uel.mjs`  
- `audit-readonly-counts.json`, `audit-readonly-traces.json`, `audit-readonly-seed-and-uel.json`

## Verification

Re-run from a checkout that has `@prisma/client` and `DATABASE_URL` (Kay account store):

```bash
export DATABASE_URL=… # read-only use; no writes in scripts
RECEIPT=/Users/user/ai-companion-worktrees/desktop-chatgpt-import-materialisation-audit-001/docs/agent-runs/receipts/CHATGPT-IMPORT-MATERIALISATION-AUDIT-001
cd /Users/user/ai-companion
node --check "$RECEIPT/audit-readonly-counts.mjs"
node --check "$RECEIPT/audit-readonly-traces.mjs"
node --check "$RECEIPT/audit-readonly-seed-and-uel.mjs"
node "$RECEIPT/audit-readonly-counts.mjs"
node "$RECEIPT/audit-readonly-traces.mjs"
node "$RECEIPT/audit-readonly-seed-and-uel.mjs"
```

Also: `git diff --check`, `git status --short`, `git diff --stat`.

## Honesty line

Raw imported conversations prove **capture**. They do **not** prove Orvek currently **understands** Kay via automatic archive extrapolation.
