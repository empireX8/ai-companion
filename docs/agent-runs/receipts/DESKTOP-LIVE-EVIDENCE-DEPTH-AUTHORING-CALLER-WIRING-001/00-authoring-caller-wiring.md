# Desktop Live Evidence Depth Authoring Caller Wiring 001

**Branch:** `desktop-live-evidence-depth-authoring-caller-wiring-001`  
**Baseline:** `c91f353` (staging — PR #126 browser-auth validation)  
**Authoritative receipts consulted:** #121 authoring path, #122 publish wiring, #123–#126 validation/fixture/migration/browser  
**UI changed:** NO  
**Product code changed:** YES  
**Schema/migration changed:** NO  
**Route/API changed:** YES (new internal create route)  
**Runtime/visual required:** NO  
**Production-ready:** NO

---

## Goal

Wire a real internal review/operator path to pass `evidenceDepthAuthoring` into model update candidate creation — turning the proven fixture pipeline into an operator-fed production/internal authoring flow.

---

## Caller paths inspected

| Path | Finding |
|------|---------|
| `persistInternalModelUpdateCandidate` | Already accepts optional `evidenceDepthAuthoring` (#121); **no production caller passed it** |
| Dark-engine bridges (`candidate-bridge-dark-run-persistence`, app-message, import-completion) | Create candidates; **omit** authoring (correct — no operator rationale) |
| `GET /api/internal/model-updates/review-candidates` | List only |
| `POST /api/internal/model-updates/candidates/[id]/publish` | Publish only; no create body |
| User-map / investigation / fieldwork internal routes | Review + lifecycle + publish; **no create** routes; lifecycle body is status-only |
| `POST /api/model-updates` (legacy) | Manual Prisma create; no depth authoring |
| Seed / runtime fixture | Fixture bypasses persist helper or omits authoring |

**Conclusion:** No existing HTTP create route could accept structured authoring. Persistence was ready; operator caller was missing → **Option A**.

---

## Caller path wired

**`POST /api/internal/model-updates/candidates`**

| Layer | File |
|-------|------|
| Route | `app/api/internal/model-updates/candidates/route.ts` |
| Helper + zod contract | `lib/internal-model-update-candidate-create.ts` |
| Persistence (existing) | `persistInternalModelUpdateCandidate` → `#121` `maybePersistEvidenceDepthAuthoringFromModelUpdateCandidate` |
| Publish (unchanged) | `publishModelUpdateCandidate` → `#122` materializer when stored authoring ready |

Auth: Clerk + `isInternalUserMapReviewer` (same as review/publish).

---

## Request / helper contract

```ts
{
  proposal: {
    updateType: "link_detected",
    userFacingSummary: string,          // movement copy — never used as whyItMatters
    affectedObjectType: UnderstandingLinkTargetType,
    affectedObjectId: string,
    evidenceSelections: Array<{ sourceType, sourceId, role?, ... }>  // min 1
  },
  evidenceDepthAuthoring?: {
    authoredRationale: string,          // explicit operator/agent text
    authoredFrom: string,
    whyResurfaced?: string,
    sourceEvidenceId?: string,
    sourceTextForValidation?: string,  // blocks rationale === quote
    graphSlotLinks: Array<{             // min 1
      targetType, targetId, role,
      graphSlot: "related" | "context", // explicit only
      summary?: string
    }>
  }
}
```

**Response includes:** `id`, `runId`, `candidatesWritten`, `blockedWriteReasons`, `notes`, `evidenceDepthAuthoringProvided`, `evidenceDepthAuthoringReady`, `evidenceDepthAuthoringBlockers`, `evidenceDepthAuthoringSkippedReason`.

---

## Source of authoredRationale

**Operator request body** `evidenceDepthAuthoring.authoredRationale` only.

Never from:
- `proposal.userFacingSummary`
- Today card/hero copy
- sourceText / evidence quote
- dark-engine auto-extraction
- read-time generation

---

## Source of graphSlotLinks

**Operator request body** `evidenceDepthAuthoring.graphSlotLinks[]` with explicit `graphSlot: "related" | "context"`.

No inference from role, target type, title, or href. Ineligible/private targets skipped by #120/#121 eligibility checks.

---

## Supported affected object types

Depth authoring readiness applies when `affectedObjectType` ∈ `{ pattern_claim, contradiction_node }` (via #121). Other types may create candidates; authoring is skipped/blocked per existing helpers.

---

## Invalid payload behavior

| Case | Behavior |
|------|----------|
| Schema-invalid body (missing graphSlot, empty links, bad enum) | **400** `VALIDATION_ERROR` — create not attempted |
| Valid schema but bad rationale (generic / movement / sourceText-equal) | Candidate may still persist; notes include `evidenceDepthAuthoringBlockers:*`; `evidenceDepthAuthoringReady: false` |
| Ineligible private targets | Links skipped; `no_eligible_graph_slot_links` if none remain |
| Missing `evidenceDepthAuthoring` | Backwards compatible — candidate create only; no authoring notes |

Publish after invalid/missing authoring: materialization skipped (existing #122 behavior); publish does not fail.

---

## Backwards compatibility

- Dark-engine bridges unchanged (still omit authoring).
- Create without `evidenceDepthAuthoring` remains valid.
- Existing publish route unchanged.
- No UI / Today gate / Inspector / `/dev/orvek-v0-reference` changes.

---

## Publish materialization through this caller path

**Proven at composition boundary:**
1. Operator create forwards `evidenceDepthAuthoring` into `persistInternalModelUpdateCandidate`.
2. #121 persists rationale + graphSlot links when valid.
3. Existing publish helper still calls `#122` materializer when stored authoring is ready.

**Not re-executed in this branch:** full live DB create → publish → Today browser path (already covered by #124–#126). This branch adds the missing **operator HTTP create** entrypoint.

---

## Tests

**Added:** `lib/__tests__/live-evidence-depth-authoring-caller-wiring.test.ts` (21 cases)

Covers: valid payload → persist; pattern_claim + contradiction_node; invalid/generic/movement/sourceText rationale; missing/invalid graphSlot schema; ineligible targets; publish boundary (no userFacingSummary fallback); backwards compatible omit; route 401/403/400/200; no UI drift.

**Run:** 176 tests across required suites — all PASS.

---

## Checks

```bash
npx prisma validate          # PASS
npx tsc --noEmit             # PASS
npm run build                # PASS
bash scripts/check-trust-language.sh   # PASS
bash scripts/check-legacy-surfaces.sh  # PASS
git diff --check             # PASS
```

---

## Remaining gaps

1. **No operator UI** yet — API contract exists; review workbench must call it with explicit rationale + graphSlotLinks.
2. **Dark-engine auto-create** still does not (and should not) invent authoring.
3. **Authoring-after-create** for already-persisted dark-engine candidates not added (optional follow-on: `POST .../candidates/[id]/authoring`).
4. **Production-ready:** NO — still requires operator discipline + UI/tooling to supply honest authoring.

---

## Classification

| Item | Value |
|------|-------|
| **PASS/FAIL** | **PASS** |
| Product code changed | YES |
| UI changed | NO |
| Route/API changed | YES — `POST /api/internal/model-updates/candidates` |
| Runtime/visual required | NO |
| Production-ready | NO |

---

## Recommended next branch

**`desktop-live-evidence-depth-operator-review-ui-001`**  
Wire internal review UI/tooling to call the new create (or authoring-after-create) API with explicit rationale + graphSlot link picks.

Alternatively, if dark-engine candidates need depth after create:

**`desktop-live-evidence-depth-authoring-after-create-001`**  
`POST /api/internal/model-updates/candidates/[id]/authoring` for existing internal_only candidates.

---

## Commit recommendation

Ready for review. **Do not commit** until Kay approves. Suggested message:

```
Wire internal model-update candidate create with evidenceDepthAuthoring.

Adds POST /api/internal/model-updates/candidates so operators can supply
explicit rationale and graphSlot links into persistInternalModelUpdateCandidate.
```
