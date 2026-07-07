# Desktop Live Today Evidence Pointer Parity 001

**Branch:** `desktop-live-today-evidence-pointer-parity-001`  
**Baseline:** `a643c9d` (staging — PR #104 live Today object graph parity)  
**Production-ready:** NO

---

## Reference contract consulted

- `docs/agent-runs/receipts/DESKTOP-REFERENCE-BEHAVIOUR-CONTRACT-AUDIT-001/01-today-contract.md`
- `docs/agent-runs/receipts/DESKTOP-REFERENCE-BEHAVIOUR-CONTRACT-AUDIT-001/02-inspector-report-evidence-contract.md`
- `docs/agent-runs/receipts/DESKTOP-REFERENCE-BEHAVIOUR-CONTRACT-AUDIT-001/04-live-data-replacement-rules.md`
- `docs/agent-runs/receipts/DESKTOP-LIVE-TODAY-OBJECT-GRAPH-001/00-live-today-object-graph.md`

---

## Evidence pointer mapping findings

| Reference affordance | Accepted behaviour | Live Today API today | Parity |
|----------------------|-------------------|----------------------|--------|
| Aside Evidence pointer rows (`r6`, `r5`, `r2`) | Quoted receipt + origin · date; click → Inspector **Evidence** tab | Resurfaced receipt ids from surfacing cards via `buildTodayProductionDataApi` | **PARTIAL** — passes only with receipt type + sourceText + provenance |
| Hero evidence stat (`N receipts`) | Read-only stat tied to lead object; not a clickable row | Production hero may show `linkedReceipts` string | **NOT REPLACED** — count alone does not pass list parity |
| Dead/non-clickable rows | Must not appear without read-only labelling | Failed gating branch surfaced rows without inspector linkage | **BLOCKED** — non-inspectable ids filtered out of merge |
| Model movement confusion | Evidence pointer ≠ movement tab target | Movement/model-update ids may appear in resurfaced lists | **BLOCKED** — only `type: receipt` with evidence content qualifies |

**Live gaps (unchanged from object-graph slice):**

- Sparse receipts with empty meta → `sourceOrigin: "Receipt"` and no date fail provenance check.
- Hero/report/movement replacement still blocked until dedicated slices.

---

## Parity helpers / builders added or tightened

**New module:** `lib/orvek-v0/production/today-evidence-pointer-parity.ts`

| Helper | Purpose |
|--------|---------|
| `LiveEvidencePointerTarget` | `{ objectId, inspectorTab: "evidence", sourceText, provenanceLabel }` |
| `isReceiptEvidencePointerObject` | Ensures object is a receipt, not movement |
| `hasInspectableEvidencePointerSourceText` | Requires non-empty sourceText (not generic `"Receipt"`) |
| `hasEvidencePointerProvenance` | Requires date/lastUpdated or non-generic sourceOrigin |
| `hasInspectableEvidencePointerContent` | Combined receipt + source + provenance gate |
| `canUseLiveTodayEvidencePointer` | Single-id parity check |
| `getInspectableEvidencePointers` | Parity-safe metadata list for future UI |
| `resolveLiveEvidencePointerTarget` | Inspector Evidence tab target resolution |
| `buildParitySafeEvidencePointerObjects` | Receipt objects safe for hybrid merge |
| `canUseLiveTodayEvidencePointerList` | All resurfaced ids must pass |
| `isBlockedAsEvidencePointer` | Explicit block helper for non-receipt / incomplete rows |

**Updated:** `lib/orvek-v0/production/today-object-graph-parity.ts`

- Evidence pointer logic delegated to dedicated module (tighter provenance requirements).
- `LiveTodayGraphParity.paritySafeEvidencePointers` added.
- `buildParitySafeTodayObjectMap` uses `buildParitySafeEvidencePointerObjects` for receipt merge.

**Hybrid:** unchanged surface behaviour — still merges parity-safe objects only; reference Today UI preserved.

---

## UI changed

**NO** — `components/orvek-v0/pages/today.tsx` unchanged. Reference branch still uses `REFERENCE_RESURFACED` and `isProductionDisplay(data)`.

---

## Tests / checks run

- `lib/__tests__/today-evidence-pointer-parity.test.ts` (new — 6 tests)
- `lib/__tests__/today-object-graph-parity.test.ts` (updated mock provenance)
- `lib/__tests__/evidence-panel-provider-lookup.test.ts` (hybrid live receipt provider lookup)
- `npx tsc --noEmit` — PASS
- `bash scripts/check-trust-language.sh` — PASS
- `bash scripts/check-legacy-surfaces.sh` — PASS
- `git diff --check` — PASS
- Vitest suites (8 files, 136 tests) — PASS

---

## Remaining risks

1. Live sparse receipts without meta still fail parity — correct but limits merge until adapter normalizes provenance.
2. Reference aside still shows `r6`/`r5`/`r2` while hybrid may hydrate additional live receipt objects — intentional until evidence-pointer UI swap slice.
3. Production Today branch `isInspectableObject` gate (requires `inspectorObjectType`) remains separate from parity helpers — future UI slice must align both.

---

## Production-ready: NO

Evidence pointer parity infrastructure only. Reference Today Evidence pointer UX unchanged at root.
