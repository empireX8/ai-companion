# 08 — Tests and validation

## Focused

```bash
npx vitest run lib/__tests__/contradiction-live-semantic-consistency-repair.test.ts
```

Result: recorded in `validation-summary.json` after final proof-completeness correction
(includes controlled-natural-entry writer-block proof and exact CEQR-017 hash assertions).

## Contradiction / kernel sweep

```bash
npx vitest run lib/__tests__/contradiction-*.test.ts lib/__tests__/objectivity-referee*.test.ts
```

## Complete repository suite

```bash
npx vitest run
```

Compared against merged-base / prior known baseline (5 files / 7 tests unrelated).
Recorded in `validation-summary.json` (`expandedFailureSetVsBase`).

## TypeScript / ESLint / diff check / JSON / hashes / nonmutation / secret scan

Recorded in `validation-summary.json`.

## Build

`npm run build` was **not** rerun in the final proof correction. The earlier known
Stripe page-data failure (missing apiKey/authenticator) was observed before the
Unicode correction, was unrelated to this slice, and remains documented only.

## Distinctions (must not be conflated)

| Layer | Status |
|-------|--------|
| Structural schema enforcement (schema-v3) | repaired offline (preserved) |
| Deterministic defence-in-depth validation | preserved |
| Lexical evidence-boundary integrity | code-point-aware (surrogate + combining-mark policy) |
| Full semantic evidence adequacy | **not** claimed |
| Production readiness | **not** claimed |
| Live semantic proof | **not** obtained |
