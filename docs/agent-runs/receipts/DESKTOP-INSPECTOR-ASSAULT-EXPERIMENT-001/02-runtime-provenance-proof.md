# Runtime Provenance Proof

## Closeout replay — PASS (2026-07-13)

Authenticated HTTP replay re-run after dev-server restart with a clean `.next` directory. Clerk Bearer session for fixture user `user_34TUYA53pI1QRLK73O22Kve1a1G`. Fixture data retained (`--keep-data`). No authentication tokens or secrets recorded here.

### Fixture IDs (live)

| Role | ID |
|---|---|
| Depth-safe receipt | `receipt-pattern-dev-live-evidence-depth-claim` |
| Linked conclusion | `dev-live-evidence-depth-conclusion` |
| Model update | `cmrjd6ntp0002qlq3n6hbkh4c` |
| Pattern claim source | `dev-live-evidence-depth-claim` |

---

## Authenticated HTTP replay (closeout)

| Endpoint | Status | Key response facts |
|---|---|---|
| `GET /api/today/evidence-pointers` | **200** | `inspectorDepthListReady: true`; `depthSafePointerIds: [receipt-pattern-dev-live-evidence-depth-claim]`; `linkedObjects` includes `dev-live-evidence-depth-conclusion`; `rejectedPointers: []` |
| `GET /api/user-map/conclusions/dev-live-evidence-depth-conclusion` | **200** | `item.id: dev-live-evidence-depth-conclusion`; `item.title: Evening stop point matters`; `item.status: supported` |
| `GET /api/user-map/conclusions/dev-live-evidence-depth-conclusion/evidence` | **200** | `items.length: 1` |
| `GET /api/what-changed/cmrjd6ntp0002qlq3n6hbkh4c` | **200** | `item.id` matches fixture; `report.modelMovement.before: null`; `report.modelMovement.after: null` (honest empty before/after) |
| `GET /api/what-changed/cmrjd6ntp0002qlq3n6hbkh4c/evidence` | **200** | `items.length: 1` |

Auth method: `Authorization: Bearer <clerk-session-jwt>` (session created for fixture user, revoked after replay).

**Runtime scope:** only **three** live representative families received authenticated HTTP replay in this experiment (receipt, map conclusion, model update). The other four representative selections (active question, reference decision, reference report, missing selection) were **not** browser- or HTTP-replayed.

---

## Provenance verification (hybrid + depth gate composition)

After applying `applySurfacedEvidenceDepthGate` with the live HTTP pointer graph:

| Check | Result |
|---|---|
| `surfacedEvidenceDepthProvenance.depthSafePointerIds` | `[receipt-pattern-dev-live-evidence-depth-claim]` |
| `linkedObjectIds` from pointer graph | `[dev-live-evidence-depth-conclusion]` |
| `todayResurfacedIds` | `[receipt-pattern-dev-live-evidence-depth-claim]` — **not** `r6/r5/r2` fallback |
| `resolveOrvekObjectProvenance(receipt)` | `live` |
| `resolveOrvekObjectProvenance(conclusion)` | `live` |
| Receipt in zip graph (`orvek-data.ts`) | **false** |
| Conclusion in zip graph | **false** |
| Silent zip/reference substitution | **none detected** |

Provenance composition is **behavior-tested** in `lib/__tests__/desktop-inspector-assault.test.ts` and `lib/__tests__/today-evidence-pointer-ui-depth-gate.test.ts` (not source-string-only).

---

## Movement verification

| Check | Result |
|---|---|
| Selected model update ID | `cmrjd6ntp0002qlq3n6hbkh4c` |
| Live detail hydrates | **yes** (HTTP 200) |
| Before/after recorded | **no** (`before: null`, `after: null` in `report.modelMovement`) |
| Honest empty state expected | **yes** — panel copy explicitly states global recent movement is not substituted |
| Global recent movement list | Separate path (`TODAY_INTELLIGENCE_UPDATES_ENDPOINT` / `ExploreSessionMovementInspectorList`) |

---

## Browser click-through (closeout attempt)

| Check | Result |
|---|---|
| Playwright available | **yes** |
| Attempted route | `/` then `/your-map` fallback |
| Result | **not recorded** — fixture receipt/conclusion rows were not visible in the authenticated workbench UI during this session (Today still showed reference zip content in the resurfaced list). |
| Navigation proof instead | **behavior-level** tests in `lib/__tests__/inspector-tab-navigation-behavior.test.ts` and `lib/__tests__/desktop-inspector-assault.test.ts` |

---

## Fixture retention

Fixture rows **not cleaned** per experiment instruction (`--keep-data`).
