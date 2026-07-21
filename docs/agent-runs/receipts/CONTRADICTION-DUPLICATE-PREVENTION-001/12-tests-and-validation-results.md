# 12 — Tests and validation results

**Slice:** CONTRADICTION-DUPLICATE-PREVENTION-001 (CEQR-007)
**Date:** 2026-07-21
**Worktree:** `/Users/user/ai-companion-worktrees/desktop-contradiction-duplicate-prevention-001`
**Review correction:** EvidenceSpan empty-state race proof test added (no writer/schema redesign).

## Focused

```
Test Files  3 passed (3)
Tests       64 passed (64)
```

Files:

- `lib/__tests__/contradiction-duplicate-prevention-schema.test.ts` (3)
- `lib/__tests__/contradiction-persistence-plan.test.ts` (30)
- `lib/__tests__/contradiction-repaired-persistence.test.ts` (31)

New test: `concurrent same-plan invocations from empty spans recover exact node after EvidenceSpan P2002`.

## Related

```
Test Files  7 passed (7)
Tests       217 passed (217)
```

## TypeScript

`npx tsc --noEmit` — exit 0

## ESLint (changed TS only)

```
npx eslint lib/contradiction-repaired-persistence.ts \
  lib/__tests__/contradiction-repaired-persistence.test.ts \
  lib/__tests__/contradiction-duplicate-prevention-schema.test.ts
```

Exit 0 (0 errors).

## Build

`npm run build` — exit 0 (with repo `.env` sourced; compile + page-data collection succeeded).

## Full suite

```
Test Files  5 failed | 310 passed (315)
Tests       7 failed | 4172 passed (4179)
```

### Baseline comparison (persistence wiring after correction)

| Metric | Baseline | This slice (after span-race proof) |
| ------ | -------- | ---------------------------------- |
| Failing files | 5 | **5** (same set) |
| Failing tests | 7 | **7** (same set) |
| Passing files | 309 | **310** (+1 schema contract file) |
| Passing tests | 4160 | **4172** (+12) |

Prior CEQR-007 closeout had 4171 passing tests; empty-state EvidenceSpan race proof adds +1.

### Exact failing files / tests (unchanged known baseline)

1. `lib/__tests__/canonical-fixture-composition-gate.test.ts` — file load failure (`@/lib/canonical-reference-model-status-card` missing)
2. `lib/__tests__/evidence-pointer-surfacing-rationale-schema.test.ts`
   - pins one rationale row per source object per user
   - pins source lookup uniqueness in migration SQL
3. `lib/__tests__/orvek-adapters.test.ts`
   - does not use movement summary as after state when depth after is missing
   - mapTodayDataToV0Props maps movement without fabricating previous read or after state
4. `lib/__tests__/surfaced-evidence-pointer-schema.test.ts`
   - pins required indexes and one-pointer-per-source uniqueness
   - pins Today read and source lookup indexes in migration SQL
5. `lib/__tests__/today-production-movement-depth.test.ts`
   - uses explicit unavailable copy instead of movement summary when after is missing

**No new failures introduced by CEQR-007 review correction.**

## git diff --check

Exit 0

## Prohibited-path scan

No hits under `app/`, `lib/orvek-v0/`, `lib/understanding-dark-engine/` for repaired persistence / persistence-plan imports.

## Account gates

| Label | matchesExpected | nodes | evidenceSpans | duplicate groups |
| ----- | --------------- | ----- | ------------- | ---------------- |
| before | true | 25 | 5941 | 0 |
| after | true | 25 | 5941 | 0 |

Before/after: same IDs, same span FK rows, lineage unchanged (25 legacy_incomplete).

## Classification

**PASS_WITH_KNOWN_BASELINE_FAILURES**
