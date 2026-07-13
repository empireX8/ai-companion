# Verification and Regressions

## Checkpoint 6 — PASS WITH RISKS (closeout)

### Targeted assault suite (37 tests)

```bash
npx vitest run \
  lib/__tests__/desktop-inspector-assault.test.ts \
  lib/__tests__/inspector-tab-navigation-behavior.test.ts \
  lib/__tests__/inspector-selection.test.ts \
  lib/__tests__/inspector-surface-wiring.test.ts \
  lib/__tests__/today-evidence-pointer-ui-depth-gate.test.ts
```

Result: **37 passed** across 5 files.

Coverage mix:

| Layer | Files | Role |
|---|---|---|
| **Behavior-level** | `inspector-tab-navigation-behavior.test.ts`, `desktop-inspector-assault.test.ts` (tab stability, push/goBack, provenance composition) | Pure-function and composition proofs — primary closeout evidence |
| **Source-string + selective behavior** | `inspector-surface-wiring.test.ts`, `inspector-selection.test.ts` | Wiring guards; supplemented by behavior tests above |
| **Depth gate behavior** | `today-evidence-pointer-ui-depth-gate.test.ts` | Provenance gate composition |

### Tab desync repair verification

| Check | Result |
|---|---|
| Dual tab-state risk (`workbench.inspectorTab` vs `InspectorContext.tab`) | **resolved** |
| Contract | Workbench owns user tab intent (`inspectorTab` + `inspectorTabExplicit`); bridge signature **excludes tab**; `shouldSyncWorkbenchTabToInspector` one-way syncs tab into Inspector only when `selectedId` is unchanged; `resolveBridgedInspectorTab` applies object-type defaults on new selection unless explicit |
| User tab survives bridge refresh | **behavior-tested** (`desktop-inspector-assault.test.ts`, `inspector-tab-navigation-behavior.test.ts`) |

### Static checks

| Check | Result |
|---|---|
| `git diff --check` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `bash scripts/check-trust-language.sh` | PASS |
| `bash scripts/check-legacy-surfaces.sh` | PASS |

### Full repository verification

`bash scripts/verify-mindlab.sh` (with `.env` sourced): **5 PASS / 1 FAIL**

Vitest: **7 failed / 3711 passed** (3718 total)

#### Failure inventory

| # | Test file | Tests | Reproduces on clean staging `91933ac`? | Introduced by experiment? |
|---:|---|---:|---|---|
| 1 | `free-explore-chat-hybrid-fetch.test.ts` | 1 | Yes | **No** — documented stale |
| 2 | `orvek-ux-integration.test.ts` | 1 | Yes | **No** — documented stale |
| 3 | `evidence-pointer-surfacing-rationale-schema.test.ts` | 2 | Yes | **No** — schema/migration drift |
| 4 | `explore-composer-wireup.test.ts` | 1 | Yes | **No** — explore composer wiring |
| 5 | `surfaced-evidence-pointer-schema.test.ts` | 2 | Yes | **No** — schema/migration drift |

**Seven failures across five files** reproduce on clean `staging @ 91933ac`. **None** was introduced by this experiment branch. Not fixed in this closeout slice.

### Reference route

`/dev/orvek-v0-reference` → `<Workbench />` without `dataApi` → `EvidencePanel` only.

### File boundary

All product changes remain within approved Inspector/provider boundary. Provenance repair limited to `today-evidence-pointer-depth-gate.ts` and `data-provider.tsx`. Tab contract additions: `lib/inspector-tab-contract.ts`, `lib/inspector-navigation-state.ts`, `components/orvek-v0/useProductionInspectorTab.ts`.

### Commit status

**Nothing committed.**
