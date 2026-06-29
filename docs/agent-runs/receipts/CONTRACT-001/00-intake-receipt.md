# Intake Receipt - CONTRACT-001

**Date:** 2026-06-29  
**Branch:** `contract-001-reality-tracking-generation-guardrails`  
**Agent:** codex

---

## Slice

| Field | Value |
|-------|-------|
| Slice ID | CONTRACT-001 |
| Title | Reality-Tracking generation contract hardening |
| Queue status | In Progress |

---

## Objective

Harden the deterministic What Changed / Reality Tracking report contract so new generated output rejects identity labels, uses `VERIFIED`, `INFERRED`, and `UNVERIFIED` instead of the old mixed lexicon, keeps legacy `mixed` readable, and replaces passive reality-gate filler with active pending-evidence language. Do not change schema, API routes, or inspector layout.

---

## Allowed

- `lib/reality-tracking-output-contract.ts`
- `lib/what-changed-reality-report.ts`
- `lib/__tests__/what-changed-reality-report.test.ts`
- `lib/__tests__/what-changed-detail-route.test.ts`
- `docs/agent-runs/receipts/CONTRACT-001/`

---

## Forbidden

- schema changes
- new API routes
- inspector layout or styling changes
- legacy route rewrites
- non-contract surfaces

---

## Acceptance Anchor

| Field | Value |
|-------|-------|
| Route / object | `GET /api/what-changed/[id]` report generation |
| User / env | local dev workspace |

---

## Scores at Intake

| Metric | Before |
|--------|--------|
| Product Intelligence | N/A |
| Build Loop | 0 |

---

## Planned Slice Prediction

| Field | Value |
|-------|-------|
| Expected Product Intelligence Score | N/A -> N/A |
| Expected Build Loop Score | 0 -> 1 |
| Why this slice should move the score | The report contract becomes more explicit about evidence status, identity rejection, and reality-gate wording, reducing generated epistemic slop without changing layout or routes. |
| What would prove the slice failed | New output still emits `mixed`, still accepts identity labels as conclusions, or still uses passive reality-gate filler. |

---

## Open Questions for Kay

- None

**Proceed to 01 target contract spec:** yes

