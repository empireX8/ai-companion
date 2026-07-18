# 00 — Intake and boundaries

## Campaign

**DB-BACKED IMPORT CANDIDATE REVIEW AND MATERIALISATION**

Baseline: `staging @ dc1db2f`
Worktree: `desktop-import-candidate-review-materialisation-001`
Authoritative audit: `docs/agent-runs/receipts/CHATGPT-IMPORT-MATERIALISATION-AUDIT-001/`

## Goal

Replace seed-fed, non-persisting canonical Import review with authenticated production path:

real pending import candidate → canonical review modal → persisted accept/reject → materialisation with lineage → provider visibility (isolated test proof)

## Allowed

- Production query for pending import candidates (`ReferenceItem`, `ContradictionNode`)
- Wire canonical Import modal to that query on `/` and canonical live
- Persisted accept/reject APIs
- Accepted-candidate materialisation through existing Orvek contracts (no schema change)
- Tests + receipts
- Read-only Kay account inspection

## Forbidden

- Commit / push / PR / merge
- Delete or rewrite imported conversations, messages, spans, genuine candidates, 7 PatternClaims, import-linked UserMap/ModelUpdate, native captures, unknown-provenance records
- Full-reference seed cleanup
- Bulk accept/reject of Kay’s 54 candidates
- Automatic materialisation of all candidates
- Mutation tests against Kay’s real candidates
- New ChatGPT export uploader UX (later campaign)
- Schema / migration changes

## Human gate constraint

Kay’s account may be **read** to populate review. No real candidate may be accepted or rejected until Kay acts manually.
