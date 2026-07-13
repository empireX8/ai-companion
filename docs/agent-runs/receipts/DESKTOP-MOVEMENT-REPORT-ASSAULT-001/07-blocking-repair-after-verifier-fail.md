# Checkpoint 7 — Blocking Repair After Independent Verifier FAIL

**Result:** **PASS WITH RISKS**

---

## Verifier failures repaired

| Blocker | Repair | Result |
|---|---|---|
| Today object clobbering | `mergeOrvekObjectPreservingMovementDepth` in attention registration | **PASS** |
| After-state honesty | Removed `userFacingSummary` after fallback; explicit unavailable copy | **PASS** |
| Normal-publish rationale | `resolveMovementRationaleForPublishedModelUpdate` wired into publish helper | **PASS** |
| Rationale encoding | Marker-boundary parser preserves semicolons in rationale body | **PASS** |
| Report identity end-to-end | Production composition test proves single ModelUpdate id | **PASS WITH RISKS** |
| Route ownership coverage | Behavior tests for auth, owner, cross-user, unknown/malformed ids | **PASS** |

---

## First implementation failures (corrected)

1. **`buildTodayProductionDataApi` clobbered depth** — `registerTodayAttentionObjects` overwrote ModelUpdate ids via selection alias shells, stripping `before`/`after`/`canonicalReportId`.
2. **`reportReady` did not require rationale** — readiness gate ignored `missing_rationale` blockers.
3. **Normal publish omitted rationale materialization** — only fixture/`force: true` encoded `movementRationale::`.
4. **Semicolon rationale truncated** — legacy `split(";")` decoder broke arbitrary rationale text.

---

## Test classification

| Suite | Type |
|---|---|
| `today-production-movement-depth.test.ts` | **Full behavior** — real `buildTodayProductionDataApi` + honesty |
| `model-update-candidate-publish-helper.test.ts` (rationale case) | **Full behavior** — normal publish path + mock DB |
| `today-movement-depth-route.test.ts` (ownership cases) | **Full behavior** — route handler + auth mock |
| `model-movement-rationale-encoding.test.ts` | **Unit/behavior** — encode/decode + idempotent materialize |
| `model-movement-report-contract.test.ts` | **Unit** — contract gates |
| `orvek-adapters.test.ts` (depth cases) | **Adapter unit** — `mapTodayDataToV0Props` only |
| `today-movement-report-parity.test.ts` | **Unit** — parity helpers with mock API |

---

## Shared-capability validation

**Now validated for Today production path** via `today-production-movement-depth.test.ts`.

Runtime ID used in composition test: `mu-production-ready-001`.

Timeline/Inspector/browser replay remain **PASS WITH RISKS**.

---

## Remaining risks

- Browser-level authenticated HTTP replay still not recorded
- Report overlay live-vs-fallback labelling still partial
- Reference zip reports (`rep-weekly`) remain reference-only
- Seven pre-existing Vitest failures on staging baseline unchanged

---

## Checkpoint 8 — Final test-only TypeScript closeout

**Independent repaired-assault re-verification:** **PASS WITH RISKS**

Product blockers (Today clobbering, after honesty, normal-publish rationale, encoding, readiness, route ownership) confirmed repaired.

**Only blocking finding after that re-verification:** assault-introduced TypeScript error in `lib/__tests__/model-update-candidate-publish-helper.test.ts` — `vi.fn(async () => null)` inferred `null`-only return, so `mockResolvedValue({ rationale... })` failed `tsc` (TS2345).

**Repair:** narrow mock return type to `EvidencePointerSurfacingRationaleRecord | null`. No product logic changed. No `@ts-ignore` / `any` / unsafe cast.

**Status after closeout:** TypeScript passes; browser/overlay risks remain; seven Vitest failures remain pre-existing baseline failures.
