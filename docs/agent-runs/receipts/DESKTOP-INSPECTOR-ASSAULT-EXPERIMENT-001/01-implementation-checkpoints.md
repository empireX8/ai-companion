# Implementation Checkpoints

## Checkpoint 0 — baseline — PASS

Branch `desktop-inspector-assault-experiment-001` at `91933ac`. **Seven Vitest failures across five files** reproduce on clean staging (two documented stale + five schema/explore). Production Inspector was dormant before experiment; now mounted when hybrid `dataApi` is supplied.

## Checkpoint 1 — mount — PASS

`Workbench` gates production Inspector on `dataApi` presence. Reference route (`/dev/orvek-v0-reference`) remains mock-only `EvidencePanel`.

## Checkpoint 2 — selection bridge — PASS (closeout: tab contract added)

Workbench → `ProductionInspectorBridge` → `InspectorContext` with signature dedupe (tab **excluded** from signature), provenance-aware availability, embedded type mapping, and post-audit `surfacedEvidenceDepthProvenance` repair.

**Tab sync contract (closeout repair):**

- Workbench `inspectorTab` + `inspectorTabExplicit` = user tab intent
- `useProductionInspectorTab` writes both workbench and Inspector context on UI clicks
- Bridge applies `resolveBridgedInspectorTab` on new selections; `shouldSyncWorkbenchTabToInspector` syncs tab without re-dispatching selection when `selectedId` is unchanged

## Checkpoint 3 — hydration — PASS

Authenticated HTTP replay (Clerk Bearer session, fixture user `user_34TUYA53pI1QRLK73O22Kve1a1G`). Closeout re-run: all five required endpoints **200**.

| Family | ID | HTTP | Provenance |
|---|---|---|---|
| Receipt | `receipt-pattern-dev-live-evidence-depth-claim` | `GET /api/today/evidence-pointers` → 200, depth-ready | `live` |
| Conclusion | `dev-live-evidence-depth-conclusion` | `GET /api/user-map/conclusions/...` + `/evidence` → 200 | `live`, linked in pointer graph |
| Model update | `cmrjd6ntp0002qlq3n6hbkh4c` | `GET /api/what-changed/...` + `/evidence` → 200 | live DB row; no zip substitute |

**Not HTTP-replayed:** active question (`inv-resolved-1`), reference decision (`d1`), reference report (`rep-weekly`), missing selection (`missing-inspector-selection`) — these remain code/test-level proof.

`surfacedEvidenceDepthProvenance` correct. `todayResurfacedIds` uses live pointer, not `r6/r5/r2`. No zip object silently substituted.

## Checkpoint 4 — navigation and movement — PASS WITH RISKS

| Requirement | Evidence |
|---|---|
| Related/context `pushObject` | **Behavior-tested** — `lib/__tests__/inspector-tab-navigation-behavior.test.ts` |
| Return navigation | **Behavior-tested** — `goBackInspectorObject` restores prior selection and movement tab |
| Selected movement scoped | `resolveActiveModelUpdateId` + `activeModelUpdateIdFromNavigation` behavior test |
| Global movement separate | `TODAY_INTELLIGENCE_UPDATES_ENDPOINT` / `ExploreSessionMovementInspectorList` distinct from selected detail (source-string wiring test) |
| Honest empty before/after | HTTP confirms `before/after: null` on fixture update; panel copy explicit |

Risk: full browser click-through **not recorded** — fixture objects not visible in workbench UI during Playwright session; behavior tests are the closeout proof.

## Checkpoint 5 — actions — PASS

| Action | Status |
|---|---|
| Correct the model | Deferred label in production Inspector (`Correct the model · deferred`) |
| Ask in Explore | Deferred label (`Ask in Explore · deferred`) |
| Report open/generate | Deferred for reference reports |
| Decision outcome | Deferred for reference decisions |
| Fieldwork check-in / resolve / fieldwork | Deferred on active-question panel |
| Model-goal / context capture correction | Retained via established Capture Life Data handoff only |
| New write paths invented | **none** |

## Checkpoint 6 — regression — PASS WITH RISKS

- 37 targeted assault tests: **all passed**
- `verify-mindlab.sh`: **5 PASS / 1 FAIL** (Vitest 7 failures — all pre-existing on `91933ac`)
- `git diff --check`, tsc, build, trust, legacy: **pass**

### Vitest failures (7 total — pre-existing)

| Test file | Count | On clean staging `91933ac`? | Experiment-related? |
|---|---:|---|---|
| `free-explore-chat-hybrid-fetch.test.ts` | 1 | Yes | No — documented stale |
| `orvek-ux-integration.test.ts` | 1 | Yes | No — documented stale |
| `evidence-pointer-surfacing-rationale-schema.test.ts` | 2 | Yes | No — schema/migration drift |
| `explore-composer-wireup.test.ts` | 1 | Yes | No — explore composer wiring |
| `surfaced-evidence-pointer-schema.test.ts` | 2 | Yes | No — schema/migration drift |

None introduced by the Inspector assault slice. Not repaired in this closeout.

---

## Overall experiment result — **PASS WITH RISKS**

Mandatory Checkpoint 3 authenticated replay **passed** for three live families. Tab desync risk **resolved**. Architecture validated for shared Inspector mount. Remaining risks: browser-level navigation replay for fixture-visible UI, durable action writes, investigation enrichment gate, and pre-existing Vitest failures outside slice.
