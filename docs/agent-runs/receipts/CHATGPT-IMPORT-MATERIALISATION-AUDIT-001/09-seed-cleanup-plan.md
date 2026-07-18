# 09 — Full-reference seed cleanup plan

**Do not execute cleanup in this campaign.**

**Sequencing (Kay-accepted):** clean the seed only **after** a working DB-backed candidate review and materialisation path exists, and only **immediately before** genuine-data verification. Do not clean first to “unmask” presentation while Import still cannot review or persist real candidates.

## Affected account

- `userId`: `user_34TUYA53pI1QRLK73O22Kve1a1G`

## Exact seed records

| Table | Identifying key | Current count |
|-------|-----------------|---------------|
| `CanonicalTodayComposition` | `id=dev-exact-rt-user_34TUYA53pI1QRLK73O22Kve1a1G-today-composition`, `source=full_reference_round_trip_seed` | **1** |
| `CanonicalModelMovementReport` | `id=dev-exact-rt-user_34TUYA53pI1QRLK73O22Kve1a1G-report-weekly` (prefix `dev-exact-rt-`) | **1** |

Composition payload contains **67** densograph objects + workbench rails + `importReview` (4 seed candidates). These are **inside JSON**, not separate understanding-engine rows.

### ID prefix

- `dev-exact-rt-` (`EXACT_ROUND_TRIP_PREFIX` in `lib/exact-fixture-round-trip-seed.ts`)
- Markers: `devFixture:full-reference-round-trip` / source enum `full_reference_round_trip_seed`

## Safest existing cleanup mechanism

```ts
cleanupFullReferenceRoundTrip({ userId, db })
// alias of cleanupExactFixtureRoundTrip
```

Implementation (`lib/exact-fixture-round-trip-seed.ts`):

1. `canonicalModelMovementReport.deleteMany({ userId, id: { startsWith: "dev-exact-rt-" } })`
2. `canonicalTodayComposition.deleteMany({ userId })` — **deletes all compositions for the user**, not only seed-prefixed rows

Expected deletion counts on this account today: **1 report + 1 composition**.

## Must remain untouched

| Data | Why |
|------|-----|
| All `Session` with `origin=IMPORTED_ARCHIVE` (640) | Historical archive |
| All imported `Message` (18,582) | Historical archive |
| `ImportUploadSession` / chunks | Ingest provenance |
| `EvidenceSpan`, `ReferenceItem`, `ContradictionNode` | Import extraction outputs |
| `PatternClaim` (+ evidence) | Import-derived patterns |
| `UserMapConclusion` / `ModelUpdate` / UELs | Real (non-seed-prefixed) understanding rows |
| APP sessions/messages | Native captures |
| `SurfacedAction`, fieldwork, etc. | Not part of this cleanup API |

Seed cleanup **does not** delete Session/Message/ReferenceItem/PatternClaim rows — those are unprotected only if a future custom cleanup is written carelessly.

## How imported ChatGPT data is protected

- Cleanup filters reports by `dev-exact-rt-` prefix.
- Composition delete is user-scoped but only compositions exist as seed overlay here (1 row).
- No `deleteMany` on Session/Message/import tables in this helper.
- Pre/post verification must assert imported session/message counts unchanged.

## Verification — before

```sql
-- expect: compositions=1, seed reports=1, imported sessions=640, imported messages=18582
SELECT COUNT(*) FROM "CanonicalTodayComposition" WHERE "userId" = $user;
SELECT COUNT(*) FROM "CanonicalModelMovementReport" WHERE "userId" = $user AND id LIKE 'dev-exact-rt-%';
SELECT COUNT(*) FROM "Session" WHERE "userId" = $user AND origin = 'IMPORTED_ARCHIVE';
SELECT COUNT(*) FROM "Message" m JOIN "Session" s ON s.id = m."sessionId"
  WHERE s."userId" = $user AND s.origin = 'IMPORTED_ARCHIVE';
SELECT COUNT(*) FROM "ReferenceItem" WHERE "userId" = $user;
SELECT COUNT(*) FROM "PatternClaim" WHERE "userId" = $user;
```

Also: `audit-readonly-seed-and-uel.json` → `seedCleanupVerifyBefore`.

## Verification — after (expected)

| Check | Expected |
|-------|----------|
| Compositions for user | **0** |
| `dev-exact-rt-%` reports | **0** |
| Imported sessions | **640** (unchanged) |
| Imported messages | **18,582** (unchanged) |
| ReferenceItems | **29** (unchanged) |
| PatternClaims | **7** (unchanged) |
| Shell Import button (production) | Likely **disabled** (no `importReview` batch) unless live candidate projection is built |

## Rollback / recovery limitations

- Cleanup is **destructive** for composition/report rows; no automatic snapshot in the helper.
- Recovery requires re-running `seedFullReferenceRoundTrip` / seed scripts with fixture allow env gates — **not** a restore of prior payload bytes unless backed up first.
- Recommend: export composition JSON backup before delete.
- After cleanup, Today/Map/etc. fall back to live production APIs — presentation will look much thinner; that is expected honesty, not data loss of the ChatGPT archive.
