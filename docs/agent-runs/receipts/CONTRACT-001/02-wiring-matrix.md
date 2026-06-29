# Wiring Matrix - CONTRACT-001

**Date:** 2026-06-29

| Section / behavior | Route / API | Key fields | Component | Data status | Risk |
|--------------------|-------------|------------|-----------|-------------|------|
| Evidence status lexicon | `lib/what-changed-reality-report.ts` | `evidenceStatus`, `classification` | `ModelMovementInspectorPanel` string display only | generated in report builder | low |
| Identity claim rejection | `lib/what-changed-reality-report.ts` | `modelUpdate.userFacingSummary`, `affectedObject.summary`, `analysisText` | report builder only | generated from packet text | medium |
| Active reality gate | `lib/what-changed-reality-report.ts` | `realityGate.items`, `realityGate.emptyState` | report builder only | generated from packet text | low |
| Route fixture alignment | `lib/__tests__/what-changed-detail-route.test.ts` | `realityGate.emptyState` | mocked route response | test-only | low |

---

## Data-Path Proof Plan

| Check | Command / query | Expected |
|-------|-----------------|----------|
| Report generation | `npx vitest run lib/__tests__/what-changed-reality-report.test.ts` | identity rejection, active gate, and no mixed in fresh output |
| Route fixture alignment | `npx vitest run lib/__tests__/what-changed-detail-route.test.ts` | route mock stays read-only and accepts new gate wording |

---

## Reuse Map

| Existing component | Reuse for |
|--------------------|-----------|
| `lib/reality-tracking-output-contract.ts` | Shared status contract and report typing |
| `lib/what-changed-reality-report.ts` | Deterministic generation and evidence routing |

---

## Out of Matrix

- schema changes
- API route changes
- inspector layout/styling changes
- legacy route rewrites

**Implementation may start:** yes

