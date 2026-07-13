# Desktop Reference-Parity Provenance Audit 001 — Intake and Method

## Audit result

**Mode:** audit only

**Product code changed:** NO

**UI changed:** NO

**Commit:** none
**Reference-parity audit status:** **PASS** — the audit met its evidence and scope bar. This is not a product parity pass.

## Baseline

Recorded before audit receipts were created:

```text
git status --short
  (clean)
git branch --show-current
  desktop-reference-parity-provenance-audit-001
git rev-parse --short HEAD
  aa43b42
git log --oneline -10
  aa43b42 Merge pull request #127 from empireX8/desktop-live-evidence-depth-authoring-caller-wiring-001
  99477cc Wire evidence depth authoring into internal candidate create
  c91f353 Merge pull request #126 from empireX8/desktop-live-evidence-depth-browser-auth-validation-001
  94a93f3 Record live evidence depth browser auth validation
  24feeaf Merge pull request #125 from empireX8/desktop-prisma-surfaced-evidence-pointer-migration-fix-001
  6c9cf54 Fix surfaced evidence pointer migration index names
  1ae8603 Merge pull request #124 from empireX8/desktop-live-evidence-depth-runtime-fixture-001
  585767b Add live evidence depth runtime fixture
  1520cd9 Merge pull request #123 from empireX8/desktop-live-evidence-depth-runtime-validation-001
  4cc8d83 Validate live evidence depth pipeline
```

## Handoff

```text
PHASE: Orvek Two-Week Reference-Parity Experiment — Phase 1
SLICE: Code- and runtime-grounded desktop reference-parity provenance audit
ALLOWED: Read code/tests/receipts; inspect local recordings; run read-only tests; create audit receipts
FORBIDDEN: Product-code edits, UI changes, schema/route changes, fixes, commits, production-ready claims
VERIFICATION: Targeted tests; git diff --check; git status --short
CONTEXT: cursor_prompt.txt, LOCAL_REFERENCE_PACK_README.md, AGENTS.md, docs/agent-workflow.md
```

## Reference recordings inspected

The packet expected:

- `.local/reference-parity/01-reference-part-1.mp4`
- `.local/reference-parity/02-reference-part-2.mp4`

The local pack actually contained:

- `.local/reference-parity/part 1.mp4` — estimated duration **397.31 seconds**
- `.local/reference-parity/part 2.mp4` — estimated duration **401.64 seconds**

Those two files were treated as the intended recordings. The filename mismatch is a pack-integrity limitation, not a product finding.

`ffprobe`/`ffmpeg` were unavailable. The videos were inspected using:

- `afinfo` for duration;
- `avconvert` to trim 0.2-second samples;
- `qlmanage` to produce local-only thumbnails;
- direct visual inspection of frames every 15 seconds;
- extra frames around major selections and surface transitions at approximately part 1 00:20, 00:25, 01:05, 01:10, 01:20, 01:25, 03:35, 03:40 and part 2 00:05, 00:10, 02:05, 02:10, 03:20, 03:25, 04:20, 04:25, 04:50, 04:55, 06:05, 06:10.

Generated clips and thumbnails were written under `/tmp/orvek-audit-frames`; none were added to git.

## Method

1. Inventoried visible states in both recordings by surface, selected object, Inspector tab, and action.
2. Traced the active root tree from `app/(root)/layout.tsx` through `AppShell`, `OrvekWorkbenchShell`, `Workbench`, providers, pages, Inspector and overlays.
3. Traced each production adapter/API and its hybrid readiness gate.
4. Distinguished the active reference `EvidencePanel` from the built but unmounted production `SelectedObjectEvidencePanel` stack.
5. Enumerated all `OrvekObjectType`, `MapSubtype`, report subtype and timeline event subtype coverage.
6. Treated `r6`, `r5`, `r2` as FALLBACK whenever the stored depth graph was not ready, even when the page was on the production root.
7. Used prior runtime receipts only for the exact path they proved. The deterministic pointer fixture was not generalized to other objects or natural writes.
8. Ran a bounded test set to verify current static contracts and recorded failures without repair.

## Provenance rules

- **LIVE:** current-user data from authenticated local/production DB/API, with no fixture fields supplying the recorded state.
- **FALLBACK:** accepted reference state deliberately shown because live parity/readiness is absent.
- **MOCK:** simulated or in-memory behavior, including correction/check-in actions that do not persist.
- **MIXED:** live outer data or list combined with zip/reference objects, labels, Inspector content, or interactions.
- **UNPROVEN:** supply or runtime execution could not be established from current code, tests, recordings, or receipts.

These labels describe the full recorded state, not merely the existence of one live row.

## Confidence rules

- **High:** direct current code path plus meaningful current test or exact runtime receipt.
- **Medium:** direct code trace, but runtime depends on authenticated data/readiness or an unexecuted handler.
- **Low:** inferred from naming/presentation only. Low-confidence claims are classified UNPROVEN.

## Runtime evidence and limitations

Available:

- Prior authenticated receipt proving one deterministic `pattern_claim` pipeline:
  stored authoring → published `SurfacedEvidencePointer` → authenticated API → Today fallback replacement → live receipt Inspector → one related `usermap_conclusion`.
- Current reference recordings.
- Current source and targeted tests.

Unavailable in this audit:

- Kay's authenticated browser/session for fresh production-root replay.
- Natural end-user creation of depth-safe evidence pointers.
- Runtime proof for every Map, Decisions, Timeline and Explore object.
- Runtime proof for persistent correction, decision outcome, fieldwork check-in, Ask in Explore context transfer, or report generation.

The existing authenticated fixture proves one narrow pipeline only. It does not prove context objects, Model Movement, normal creation, global Inspector parity, or other object types.

## Targeted tests

Command:

```text
npx vitest run <23 relevant desktop provenance/parity test files>
```

Result:

```text
Test Files  2 failed | 21 passed (23)
Tests       2 failed | 238 passed (240)
```

Both failures reproduce on clean `staging` at `aa43b42`, before the audit receipts existed. Neither failure was caused by this audit.

### Pre-existing failure 1 — stale Free Explore grounding assertion

- File: `lib/__tests__/free-explore-chat-hybrid-fetch.test.ts`
- Test: `bounded free explore chat hybrid fetch bridge > can surface ready Free Explore chat production data through the hybrid workbench`
- Assertion: `expect(hybridApi.exploreGrounding).toEqual(baseApi.exploreGrounding)`
- Error: `AssertionError: expected [] to deeply equal [ "d1", "m-claim-1", "r6", "aq-2", "ctx-values" ]`
- Reason: live Free Explore chat intentionally strips mock/reference grounding, so `exploreGrounding: []` is the current honesty contract. The assertion is stale.
- Repair boundary: product code must not be changed to satisfy this assertion. Repair the test in a separate test-maintenance slice.

### Pre-existing failure 2 — stale Today report source-token assertion

- File: `lib/__tests__/orvek-ux-integration.test.ts`
- Test: `orvek ux integration — today what-changed output > keeps compact What Changed on Today with Inspector handoff and route-ready full report output`
- Assertion: `expect(todayView).toContain("fullReportAvailable")`
- Error: `AssertionError: expected '"use client"\n\nimport { useOrvekData…' to contain 'fullReportAvailable'`
- Reason: Today report availability now uses `reportCommands`; the old `fullReportAvailable` source token is no longer read by `today.tsx`. The assertion is stale.
- Repair boundary: product code must not be changed to satisfy this assertion. Repair the test in a separate test-maintenance slice.

These baseline failures do not change the audit's provenance, Inspector coverage, dependency or forecast conclusions. No repairs were attempted because this branch is audit-only.

## Exact checks and commands used

- Git baseline commands listed above.
- `ls -la .local/reference-parity`
- `afinfo` on both recordings.
- `avconvert` and `qlmanage` local-only extraction.
- Targeted `vitest` command covering Today, evidence-depth, Inspector, Map, Decisions, Timeline, Explore and hybrid wiring.
- Final `git diff --check`.
- Final `git status --short`.

## Principal code paths inspected

- Shell/provider/reference: `components/orvek-workbench/OrvekWorkbenchShell.tsx`, `useOrvekHybridWorkbenchDataApi.ts`, `components/orvek-v0/workbench.tsx`, `store.tsx`, `lib/orvek-v0/{data-provider,mock-api,page-handlers}.tsx`, `production/hybrid-workbench-api.ts`, `app/dev/orvek-v0-reference/page.tsx`.
- Today: `components/orvek-v0/pages/today.tsx`, `lib/orvek-v0/production/today-*.ts`, `app/api/today/evidence-pointers/route.ts`, `lib/live-evidence-depth-*.ts`.
- Map/Decisions/Timeline/Explore: current pages, production APIs/presentation gates, fetch hooks, routes and tests.
- Inspector/reports: `components/orvek-v0/evidence-panel.tsx`, `components/inspector/**`, `ProductionInspectorBridge.tsx`, `components/orvek-v0/overlays.tsx`, object graph and selection helpers.

## Audit denominator

- **45** meaningful recorded reference states were inventoried.
- **35** Inspector type/subtype coverage units were assessed.
- **0** recorded states were classified wholly LIVE.

The denominator is intentionally state/object based. Repeated scrolling without a changed selection, tab, surface or visible action was not counted as a new state.
