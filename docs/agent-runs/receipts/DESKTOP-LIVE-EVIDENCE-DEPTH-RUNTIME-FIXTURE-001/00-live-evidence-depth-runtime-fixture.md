# Desktop Live Evidence Depth Runtime Fixture 001

**Branch:** `desktop-live-evidence-depth-runtime-fixture-001`  
**Baseline:** `1520cd9` (staging — PR #123 runtime validation)  
**Authoritative receipts consulted:** #116–#123, `DESKTOP-LIVE-EVIDENCE-DEPTH-RUNTIME-VALIDATION-001`  
**UI changed:** NO  
**Product code changed:** YES (local fixture lib module + dev script only)  
**Schema/migration changed:** NO  
**Runtime/visual required:** NO  
**Production-ready:** NO

---

## Goal

Close the #123 gap: **no executable local runtime fixture** for the live evidence depth pipeline against a real local DB.

**Target pipeline:**

`authoring inputs → publishModelUpdateCandidate → SurfacedEvidencePointer persisted → read/linkage service (route-equivalent) → Today depth gate`

---

## Fixture added

| Path | Purpose |
|------|---------|
| `lib/live-evidence-depth-runtime-fixture.ts` | Core fixture logic: safety guards, seed, publish, DB verify, read service, Today gate, unsafe fallback check, cleanup |
| `scripts/dev/validate-live-evidence-depth-runtime.ts` | CLI entry (local DB via `prismadb`) |
| `lib/__tests__/live-evidence-depth-runtime-fixture.test.ts` | Guard/composition tests (no real DB required) |
| `package.json` | `"validate:live-evidence-depth-runtime"` script |

**Deterministic fixture IDs:** `dev-live-evidence-depth-claim`, `dev-live-evidence-depth-conclusion`, `dev-live-evidence-depth-evidence`  
**Expected pointer ID:** `receipt-pattern-dev-live-evidence-depth-claim`

---

## Commands

### Dry-run (safety guards only; no DB writes)

```bash
ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE=1 \
NODE_ENV=development \
npm run validate:live-evidence-depth-runtime -- --dry-run
```

### Execute (seed → publish → verify → cleanup by default)

```bash
ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE=1 \
NODE_ENV=development \
EVIDENCE_DEPTH_FIXTURE_USER_ID=<local-clerk-user-id> \
npm run validate:live-evidence-depth-runtime -- --execute --user-id <local-clerk-user-id>
```

### Execute and keep rows for inspection

```bash
ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE=1 \
NODE_ENV=development \
EVIDENCE_DEPTH_FIXTURE_USER_ID=<local-clerk-user-id> \
npm run validate:live-evidence-depth-runtime -- --execute --keep-data
```

### Skip unsafe-fallback overlay check

```bash
... --execute --skip-unsafe-fallback
```

**HTTP route (not executed):** Clerk auth prevents safe automated `GET /api/today/evidence-pointers` from this script. Receipt documents service route-equivalent validation via `fetchEvidencePointersGraphService` / `readSurfacedEvidencePointersForUser`.

**Optional manual route check (requires browser/session):**

```bash
npm run dev
# Authenticate in browser, then:
curl -H "Cookie: <clerk-session-cookie>" http://localhost:3000/api/today/evidence-pointers
```

---

## Safety guards

Fixture refuses unless **all** pass:

1. `ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE=1`
2. `NODE_ENV !== production`
3. `DATABASE_URL` present and matches local/test patterns (`localhost`, `127.0.0.1`, `companion-db`, `file:`, `_test_`, etc.)
4. `DATABASE_URL` does **not** match production patterns (`amazonaws.com`, `neon.tech`, `prod.`, etc.)
5. On `--execute`: `--user-id` or `EVIDENCE_DEPTH_FIXTURE_USER_ID` required

**Cleanup:** default deletes only fixture-owned rows (`dev-live-evidence-depth-*` source ids, marker-tagged model updates). `--keep-data` skips cleanup. Never deletes unrelated user data.

---

## What the fixture validates (execute mode)

1. Upserts `UserMapConclusion`, `PatternClaim`, `PatternClaimEvidence`
2. `persistEvidenceDepthAuthoringInputsForSource` — stored rationale + explicit `meta.graphSlot` UEL links (eligibility checked against fixture DB, not global `prismadb`)
3. Creates `ModelUpdate` + precondition UEL
4. **`publishModelUpdateCandidate`** (real helper; not direct pointer insert)
5. DB verify: `SurfacedEvidencePointer`, rationale source, graphSlot link count, movement summary not used as rationale
6. Read: `createSurfacedEvidenceDepthLinkageDeps` + `fetchEvidencePointersGraphService` (**auth-bypassed route-equivalent**)
7. Today gate: `applyTodayEvidenceDepthGateFromReadGraph` — stored pointer replaces fallback when depth-ready
8. Unsafe overlay: thin/generic pointer → fallback `r6/r5/r2` preserved

---

## Cursor execution results

| Check | Result |
|-------|--------|
| Real DB dry-run guards | **YES** — passed (`localhost:5432`, development) |
| Real DB `--execute` full pipeline | **NO** — attempted; failed at seed |
| HTTP `/api/today/evidence-pointers` | **NO** — Clerk auth not executed |
| Service route-equivalent (unit tests) | **YES** — 14 fixture tests + 156-suite total |
| Today gate validated (tests) | **YES** — stored replacement + unsafe fallback |
| Browser visual validation | **NO** |
| UI changed | **NO** |

### Real DB execute failure (local schema drift)

Cursor ran execute against `postgresql://postgres:postgres@localhost:5432/companion` with an existing local user id. Seed failed:

```
The table `public.EvidencePointerSurfacingRationale` does not exist in the current database.
```

**Implication:** local DB must have evidence-depth migrations applied (`npx prisma migrate dev` or equivalent) before execute mode can pass end-to-end. Fixture correctly refuses production URLs and requires explicit allow flag.

---

## Tests added (`live-evidence-depth-runtime-fixture.test.ts`)

1. Refuses without `ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE=1`
2. Refuses production-looking `DATABASE_URL`
3. Requires/derives local `userId` safely
4. Uses `publishModelUpdateCandidate` as primary path (injected spy)
5. Validates `SurfacedEvidencePointer` after publish (mock DB)
6. Validates service route-equivalent read path
7. Validates Today gate stored-pointer replacement
8. Validates fallback on unsafe/thin pointer overlay
9. Cleanup targets only deterministic fixture IDs
10. `userFacingSummary` not accepted as rationale input
11. Explicit `graphSlot` on link intent
12. CLI arg parsing (dry-run / execute / keep-data)
13. Local vs production URL classification
14. graphSlot meta persistence shape

---

## Remaining gaps

1. **Local DB migrations** — execute mode blocked until `EvidencePointerSurfacingRationale` / `SurfacedEvidencePointer` tables exist locally.
2. **HTTP route + Clerk auth** — not automated; requires browser session or separate auth fixture branch.
3. **Browser Today visual validation** — not performed.
4. **No production caller** passes `evidenceDepthAuthoring` on candidate create yet.
5. **Production-ready:** NO.

---

## Checks / tests run

```bash
npx prisma validate
npx tsc --noEmit
npm run build
bash scripts/check-trust-language.sh
bash scripts/check-legacy-surfaces.sh
git diff --check
npx vitest run \
  lib/__tests__/live-evidence-depth-runtime-fixture.test.ts \
  lib/__tests__/live-evidence-depth-runtime-validation.test.ts \
  lib/__tests__/live-evidence-depth-publish-route-wiring.test.ts \
  lib/__tests__/live-evidence-depth-authoring-path.test.ts \
  lib/__tests__/live-evidence-depth-write-hook.test.ts \
  lib/__tests__/live-evidence-depth-rationale-source.test.ts \
  lib/__tests__/live-evidence-depth-graphslot-link-source.test.ts \
  lib/__tests__/live-evidence-depth-write-path.test.ts \
  lib/__tests__/live-evidence-depth-linkage.test.ts \
  lib/__tests__/today-evidence-pointer-ui-depth-gate.test.ts \
  lib/__tests__/evidence-inspector-depth-parity.test.ts
ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE=1 NODE_ENV=development \
  npm run validate:live-evidence-depth-runtime -- --dry-run
ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE=1 NODE_ENV=development \
  EVIDENCE_DEPTH_FIXTURE_USER_ID=<local-user> \
  npm run validate:live-evidence-depth-runtime -- --execute --keep-data
```

**Result:** PASS — 156 tests across listed suites; all verification checks pass. Real DB execute attempted but blocked by missing local migration.

---

## Next branch recommendation

**`desktop-live-evidence-depth-browser-auth-validation-001`** (or closeout audit after local migrations applied + execute passes)

Purpose: authenticated `GET /api/today/evidence-pointers` curl/browser validation + optional Today visual smoke once local DB is migrated.

---

## Classification

| Item | Value |
|------|-------|
| **PASS/FAIL** | **PASS** |
| Product code changed | YES (fixture lib + dev script; no UI/routes) |
| UI changed | NO |
| Real DB executed by Cursor | YES (attempted; schema blocked full pass) |
| HTTP route executed | NO |
| Service route-equivalent executed | YES (tests) |
| Today gate validated | YES (tests) |
| Cleanup behavior | Default delete fixture-owned IDs; `--keep-data` opt-out |
| Runtime/visual required | **NO** |
| Commit recommendation | Ready for review; **do not commit** until Kay approves slice |
