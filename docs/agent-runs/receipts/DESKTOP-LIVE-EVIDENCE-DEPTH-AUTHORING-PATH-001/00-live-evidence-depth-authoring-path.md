# Desktop Live Evidence Depth Authoring Path 001

**Branch:** `desktop-live-evidence-depth-authoring-path-001`  
**Baseline:** `8b1028b` (staging — PR #120 graphSlot link source)  
**Authoritative receipts consulted:** #118 write hook, #119 rationale source, #120 graphSlot link source  
**UI changed:** NO  
**Product code changed:** YES  
**Schema/migration changed:** NO  
**Route materialization wiring:** NO  
**Runtime/visual required:** NO  
**Production-ready:** NO

---

## Goal

Bridge internal review / dark-engine candidate creation to persist **both** `EvidencePointerSurfacingRationale` and explicit graphSlot UEL links before publish/materialization — using only explicitly authored inputs, never `ModelUpdate.userFacingSummary`.

---

## Files inspected

| Area | Path | Finding |
|------|------|---------|
| Model update publish | `lib/model-update-candidate-publish-helper.ts` | Flips visibility only — no depth authoring |
| Dark engine persistence | `lib/understanding-dark-engine/model-update-candidate-persistence.ts` | Creates candidates + inbound UEL to `model_update`; no depth fields on proposal |
| Model update proposal | `lib/understanding-dark-engine/model-update-candidate-proposal.ts` | `userFacingSummary` only — movement copy |
| Internal review | `lib/internal-model-update-review-candidates.ts` | Lists candidates; no depth authoring payload |
| Rationale (#119) | `lib/live-evidence-depth-rationale-source.ts` | Upsert/resolve ready |
| GraphSlot (#120) | `lib/live-evidence-depth-graphslot-link-source.ts` | Upsert/resolve ready |
| Write hook (#118) | `lib/live-evidence-depth-write-hook.ts` | Consumes stored rationale + graphSlot links |

---

## Authoring path found

**Primary bridge:** `persistInternalModelUpdateCandidate` when optional `evidenceDepthAuthoring` is supplied and `affectedObjectType` ∈ `{pattern_claim, contradiction_node}`.

Dark-engine proposals do **not** auto-generate depth authoring today — callers (internal review tooling, future API) must pass explicit `EvidenceDepthAuthoringInput`.

**Publish route:** `publishModelUpdateCandidate` unchanged — materialization still deferred.

---

## Design chosen: Option B + narrow persistence wire

**Module:** `lib/live-evidence-depth-authoring-path.ts`

| Export | Purpose |
|--------|---------|
| `assessEvidenceDepthAuthoringInput` | Validates rationale (#119) + link intents (#120); structured blockers |
| `persistEvidenceDepthAuthoringInputsForSource` | Upserts rationale + graphSlot links; returns readiness status |
| `buildEvidenceDepthAuthoringInputsFromCandidate` | Maps model-update candidate context → source identity |
| `maybePersistEvidenceDepthAuthoringFromModelUpdateCandidate` | Rejects `userFacingSummary` as rationale |
| `createEvidenceDepthAuthoringHookDeps` | Bundles #119 resolver + #120 `findEligibleLinks` for #118 |
| `assessAuthoredEvidenceDepthHookReadiness` | Dry-run hook readiness after authoring (no materialize persist) |

**Wired:** `PersistInternalModelUpdateCandidateInput.evidenceDepthAuthoring?: EvidenceDepthAuthoringInput` — persisted after successful candidate create; diagnostics notes record `evidenceDepthAuthoringReady` or blockers.

---

## Source of authored rationale

`EvidenceDepthAuthoringInput.authoredRationale` — explicit human/agent-authored string passed by caller.

**Never from:**
- `ModelUpdate.userFacingSummary` / proposal movement copy
- Today card/hero copy
- `PatternClaim.summary`
- Read-time LLM

`maybePersistEvidenceDepthAuthoringFromModelUpdateCandidate` blocks when `authoredRationale === userFacingSummary`.

---

## Source of graphSlot link intents

`EvidenceDepthAuthoringInput.graphSlotLinks[]` — each intent requires explicit:
- `targetType`, `targetId`, `role`
- `graphSlot: "related" | "context"`

Persisted via `upsertEvidenceDepthGraphSlotLinksForSource` (#120). No inference from role or target type.

---

## Validation / guards

| Rule | Blocker |
|------|---------|
| Missing/generic/movement rationale | #119 blockers |
| Rationale === sourceText | `rationale_equals_source_text` |
| Rationale === userFacingSummary | `movement_copy_used_as_rationale` |
| Missing/invalid graphSlot | `missing_graph_slot_links` / `invalid_graph_slot_link` |
| Ineligible target | skipped; `no_eligible_graph_slot_links` if none remain |
| Unsupported source | `unsupported_source_object_type` |

Rationale may persist even when all links skipped; `ready: false` until ≥1 eligible graphSlot link written.

---

## Public eligibility safeguards

Reuses `isEvidenceLinkTargetPublicEligible` (injectable). Ineligible targets skipped — not written. No private targets marked public.

---

## Route materialization

**NO** — `#118` materializer not called from publish route. `assessAuthoredEvidenceDepthHookReadiness` supports dry-run verification only.

---

## Remaining blockers

1. **No production caller passes `evidenceDepthAuthoring` yet** — dark-engine extraction does not produce depth payloads; internal review UI/API must supply them.
2. **Publish route wiring deferred** — `desktop-live-evidence-depth-publish-route-wiring-001` should call materializer after publish when authoring notes show ready.

---

## Tests

**Added:** `lib/__tests__/live-evidence-depth-authoring-path.test.ts` (18 cases)

**Updated:** `lib/understanding-dark-engine/model-update-candidate-persistence.ts` (optional authoring wire)

Covers all 17 required cases + movement-summary guard on model-update candidate.

**Run (all passing):**

```bash
npx vitest run \
  lib/__tests__/live-evidence-depth-authoring-path.test.ts \
  lib/__tests__/live-evidence-depth-graphslot-link-source.test.ts \
  lib/__tests__/live-evidence-depth-rationale-source.test.ts \
  lib/__tests__/live-evidence-depth-write-hook.test.ts \
  lib/__tests__/live-evidence-depth-write-path.test.ts \
  lib/__tests__/live-evidence-depth-linkage.test.ts \
  lib/__tests__/today-evidence-pointer-ui-depth-gate.test.ts \
  lib/__tests__/evidence-inspector-depth-parity.test.ts
# 109 tests passed
```

---

## Checks

```bash
npx prisma validate    # OK
npx tsc --noEmit       # OK
npm run build          # OK
bash scripts/check-trust-language.sh    # PASSED
bash scripts/check-legacy-surfaces.sh   # PASSED
git diff --check       # OK
```

---

## Classification

**PASS** — authoring orchestrator + model-update candidate wire land; publish materialization correctly deferred.

| | |
|--|--|
| Product code changed | YES |
| UI changed | NO |
| Schema/migration changed | NO |
| Route materialization | NO |
| Production-ready | NO |

---

## Recommended next branch

**`desktop-live-evidence-depth-publish-route-wiring-001`**

Wire `publishModelUpdateCandidate` to call `#118` materializer (with `createEvidenceDepthAuthoringHookDeps`) when stored rationale + graphSlot links exist for `pattern_claim` / `contradiction_node` sources.

If internal review API for `evidenceDepthAuthoring` payload is needed first:

**`desktop-live-evidence-depth-authoring-contract-001`** — formalize review-operator request body for rationale + link intents.

---

## Commit recommendation

Do not commit until Kay reviews. Suggested message:

```
Add evidence depth authoring path for rationale and graphSlot links.

Orchestrates #119 + #120 persistence from explicit authoring input;
optional wire on model-update candidate create; publish materialization deferred.
```
