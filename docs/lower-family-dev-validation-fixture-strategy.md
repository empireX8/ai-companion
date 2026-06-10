# Lower-Family Dev-Only Validation Fixture Strategy

Date: 2026-06-09  
Type: Design contract (audit only — no implementation in this slice)  
Scope: `/Users/user/ai-companion` backend  
Validation base: `c4f6b27 — Record lower-family candidate discovery closeout`

---

## Executive verdict

**Fixture-backed dev validation is appropriate and recommended** as the next bounded slice to unblock Investigation, FieldworkAssignment, and independent ModelUpdate (`link_detected`) live validation.

**Natural production validation remains blocked** on the current local dataset: the only scanned user (`user_34TUYA53pI1QRLK73O22Kve1a1G`) produces `proposalPresence.userMap=true` with all lower families false. That is expected under bridge precedence and is not a tooling gap.

**Safest seed path:** call existing family persistence helpers directly with **fixture-marked proposals** and **real, user-owned evidence rows** from the target dev user (Option A). Do **not** use `run-candidate-creation-runtime-validation.ts --execute` or dark-run bridge persistence for lower-family validation on this user.

**Implementation recommendation:** one combined dev-only script with **per-family flags**, default **dry-run**, explicit **`--user-id`**, and **`--execute`** required for writes. Do **not** ship execute mode until dry-run proves gate satisfaction against live DB ownership.

---

## Natural validation vs fixture-backed validation

| Dimension | Natural production validation | Fixture-backed dev validation |
|-----------|------------------------------|-------------------------------|
| Candidate origin | Dark-run bridge after real triggers | Direct `persistInternal*Candidate` with hand-built proposal |
| Gate truth | Full orchestrator + proposal builder + persistence | Persistence gates only (wording, evidence policy, ownership, dedupe) |
| Evidence | Whatever dark-run selects from live packet | Selected from real owned rows (preferred) or minimal synthetic rows |
| Claim in closeout | “Naturally produced on dev data” | “Fixture-backed validation on dev data; not natural production validation” |
| Current status | **BLOCKED** — no safe execute user | **APPROVED IN PRINCIPLE** — separate explicitly marked dev slice |
| Production impact | None if discovery scanners only | None if script is dev-only, never imported by routes, never scheduled |

Fixture-backed validation is **not** fake intelligence if:

1. Proposals use required safe wording patterns enforced by persistence.
2. Evidence links point to **real** user-owned sources (not invented claim text presented as evidence).
3. Outputs are clearly marked as validation fixtures in title/summary/prompt/reason/metadata.
4. Publish validation is run only after seed dry-run succeeds.
5. Closeout language never conflates fixture validation with natural generation.

---

## Audit: can each family be seeded through an existing helper?

**Yes — all three families have direct persistence entry points that do not require the dark-run orchestrator.**

| Family | Persistence helper | Publish helper | Lifecycle helper | Review/publish validator script |
|--------|-------------------|----------------|-----------------|-------------------------------|
| Investigation | `persistInternalInvestigationCandidate` | `publishInvestigationCandidate` | `updateInvestigationCandidateLifecycleStatus` | `scripts/validate-investigation-candidate-review-publish-flow.ts` ✅ |
| FieldworkAssignment | `persistInternalFieldworkCandidate` | `publishFieldworkCandidate` | `updateFieldworkCandidateLifecycleStatus` | ❌ not yet — mirror Investigation validator |
| ModelUpdate (`link_detected`) | `persistInternalModelUpdateCandidate` | `publishModelUpdateCandidate` | ❌ none (visibility + `isMeaningful` only) | ❌ not yet — add validator |

**Do not use for lower-family seeding on current dev user:**

- `persistInternalCandidateFromNoWriteDarkRunOutput` (bridge respects UserMap precedence)
- `runCandidateCreationRuntimeValidation({ dryRun: false })` / `--execute` on current user (would create UserMap)

**Manual SQL / raw Prisma inserts:** rejected as preferred path. Persistence helpers enforce gates, dedupe, evidence-link safety, and derivation-run diagnostics consistently.

---

## Per-family fixture contract

### 1. Investigation

**Persistence:** `lib/understanding-dark-engine/investigation-candidate-persistence.ts` → `persistInternalInvestigationCandidate`

**Required proposal shape** (`StructuredInvestigationCandidateProposal`):

| Field | Requirement |
|-------|-------------|
| `seedType` | Valid `InvestigationSeedType` enum (e.g. `pattern`) |
| `title` | ≤120 chars; must match safe prefix (`Worth exploring:`, `This looks worth watching`, `This may be worth`) |
| `organizingQuestion` | ≤240 chars; must end with `?` |
| `summary` | ≤600 chars; safe wording required |
| `abstainReasons` | Array (recorded in diagnostics; does not block write) |
| `evidenceSelections` | ≥2 items, ≥2 distinct `sourceType`, each linkable + ownership-resolvable in packet |

**Evidence:** reuse shared policy from `user-map-candidate-persistence.ts` — min 2 links, 2 source types, cap 50, no snippet/quote on write. Disallowed: `timeline_aggregation`, `user_correction`.

**On create defaults:**

| Field | Value |
|-------|-------|
| `status` | `open` |
| `visibility` | `internal_only` |
| `candidateLifecycleStatus` | `proposed` |

**Publish preconditions:**

- `candidateLifecycleStatus === promoted`
- `visibility === internal_only`
- `status` in active-question visible set (`open`, `gathering_evidence`, `testing`, `resolving`, `reopened`)
- Lifecycle path: `proposed → held_for_more_evidence → promoted` (direct `proposed → promoted` forbidden)

**Expected after publish:**

- Public Active Questions eligibility (`buildPublicActiveInvestigationWhere`)
- `ModelUpdate` created: `updateType: investigation_opened`, `visibility: user_visible`, `isMeaningful: true`
- Investigation `status` and `candidateLifecycleStatus` unchanged by publish

**Fixture marking (recommended):** prefix title with `[DEV FIXTURE]` or use `Worth exploring: [DEV FIXTURE] …` within safe wording rules.

**Risks:** derivation-run side effects on every call; duplicate suppression on normalized title+question; DB ownership must match packet.

---

### 2. FieldworkAssignment

**Persistence:** `lib/understanding-dark-engine/fieldwork-candidate-persistence.ts` → `persistInternalFieldworkCandidate`

**Required proposal shape** (`StructuredFieldworkCandidateProposal`):

| Field | Requirement |
|-------|-------------|
| `prompt` | ≤120 chars; must start with `Notice whether ` |
| `reason` | ≤600 chars; must start with `This may be worth watching in practice. ` |
| `linkedObjectType` | Valid `UnderstandingLinkTargetType` (e.g. `pattern_claim`) |
| `linkedObjectId` | Non-empty; must be user-owned |
| `abstainReasons` | Non-empty array |
| `evidenceSelections` | ≥2 items, ≥2 distinct `sourceType` |

**On create defaults:**

| Field | Value |
|-------|-------|
| `status` | `assigned` |
| `visibility` | `internal_only` |
| `candidateLifecycleStatus` | `proposed` |

**Publish preconditions:**

- `candidateLifecycleStatus === promoted`
- `visibility === internal_only`
- `status` in `{ assigned, active }`
- Lifecycle path: `proposed → held_for_more_evidence → promoted`

**Expected after publish:**

- Public Watch For eligibility (`buildPublicFieldworkWhere`)
- `ModelUpdate` created: `updateType: fieldwork_assigned`, `visibility: user_visible`, `isMeaningful: true`

**Fixture marking:** embed `[DEV FIXTURE]` in reason after required prefix.

**Risks:** linked-object ownership gate; proposal builder can emit 1 evidence item but persistence requires 2+; schema default visibility is `user_visible` — persistence explicitly sets `internal_only` (raw inserts dangerous).

---

### 3. ModelUpdate (`link_detected` independent lane)

**Persistence:** `lib/understanding-dark-engine/model-update-candidate-persistence.ts` → `persistInternalModelUpdateCandidate`

**Not the same as** `conclusion_added` ModelUpdate from UserMap publish.

**Required proposal shape** (`StructuredModelUpdateCandidateProposal`):

| Field | Requirement |
|-------|-------------|
| `updateType` | `"link_detected"` (fixed) |
| `userFacingSummary` | ≤600 chars; safe prefix (`There is early evidence`, `This may suggest`, `This looks worth watching`) |
| `affectedObjectType` | e.g. `pattern_claim` or `contradiction_node` |
| `affectedObjectId` | User-owned target |
| `evidenceSelections` | ≥2 items, ≥2 distinct `sourceType` (tests use 3 for corroboration) |

**On create defaults:**

| Field | Value |
|-------|-------|
| `visibility` | `internal_only` |
| `isMeaningful` | `false` |
| `candidateLifecycleStatus` | **N/A** — field does not exist on `ModelUpdate` |

**Publish preconditions:**

- `visibility === internal_only`
- `isMeaningful === false`
- ≥1 evidence link to `targetType: model_update`

**Expected after publish:**

- `visibility → user_visible`, `isMeaningful → true`
- **No** second ModelUpdate row created
- Appears on What Changed / Today / Timeline meaningful feeds

**Fixture marking:** prefix summary with safe wording + `[DEV FIXTURE]`.

**Risks:** no reject lifecycle; duplicate key is summary+affected object; publish makes row user-visible immediately.

---

## Evidence sourcing options (ranked)

| Rank | Option | Safety | Truthfulness | Recommendation |
|------|--------|--------|--------------|----------------|
| **1 (preferred)** | **A — Real dev-user rows** (`pattern_claim` + `message`, optionally `contradiction_node`) | Highest — ownership checks pass against real DB; no fabricated evidence content | Validates real link mechanics; fixture wording still marks candidate as dev-only | **Use for implementation** |
| 2 | D — Family-specific minimal fixture rows created via existing test-style helpers | Medium — still uses persistence gates | Good for CI; less representative of live DB on dev machine | Use in unit tests, not primary dev seed |
| 3 | C — No evidence links | Low — persistence blocks write (`INSUFFICIENT_*`) | N/A — cannot seed | **Reject** |
| 4 | B — Synthetic evidence rows inserted outside helpers | Low — bypasses normal provenance; risks fake-evidence appearance | Poor — contradicts AGENTS.md spirit | **Reject** unless audit proves no real rows exist (not true for current dev user) |

**Facts (local DB, 2026-06-09):** user `user_34TUYA53pI1QRLK73O22Kve1a1G` has `patternCount=7`, `messageCount=18582`, `contradictionCount=25`, and `0` existing internal lower-family candidates. Option A is feasible.

**Inference:** `assembleEvidencePacketV1` could build packet from live DB, but fixture seed should prefer **explicit selection** of known-owned IDs (from a preflight query) to keep fixtures deterministic and dedupe-friendly.

---

## Combined script vs family-specific scripts

**Recommendation: one combined script with per-family flags.**

| Approach | Pros | Cons |
|----------|------|------|
| Combined `seed-lower-family-validation-fixtures` | Shared preflight (load owned evidence IDs), shared dry-run/execute guard, one cleanup story | Slightly larger module |
| Three separate scripts | Smaller per-file scope | Duplicated preflight, warning banners, CLI parsing, evidence picker |

Use flags: `--families investigation,fieldwork,model-update` (default: all). Allow `--family investigation` for isolated validation runs.

**Seed together or separately?**

- **Seed separately for validation** (one family at a time through review/publish validators) — safer, clearer closeout per family.
- **Preflight together** in one dry-run command — acceptable to show all three proposals would pass gates.
- **Do not** publish all three in one execute without per-family validator dry-run.

---

## Recommended implementation slice (next agent)

### Files to add

| File | Role |
|------|------|
| `lib/seed-lower-family-validation-fixtures.ts` | Core: preflight evidence picker, proposal builders, gate precheck, execute seed orchestration |
| `scripts/seed-lower-family-validation-fixtures.ts` | CLI entry (never imported by app) |
| `lib/__tests__/seed-lower-family-validation-fixtures.test.ts` | Dry-run/guard tests; no live DB required |
| `lib/validate-fieldwork-candidate-review-publish-flow.ts` | Mirror Investigation validator (missing today) |
| `scripts/validate-fieldwork-candidate-review-publish-flow.ts` | CLI |
| `lib/validate-model-update-candidate-review-publish-flow.ts` | Publish-only validator (no lifecycle steps) |
| `scripts/validate-model-update-candidate-review-publish-flow.ts` | CLI |

### Files to change (minimal)

| File | Change |
|------|--------|
| `docs/engineering-ledger.md` | Record fixture strategy approval + later fixture-backed validation closeout |
| `docs/mindlab-roadmap-status-ledger.md` | Implementation pass row when seed slice lands |

### Script behavior contract

```
scripts/seed-lower-family-validation-fixtures.ts \
  --user-id <required> \
  [--families investigation,fieldwork,model-update] \
  [--dry-run]   # default
  [--execute]   # required for writes
```

Requirements:

- Print large **DEV-ONLY FIXTURE** warning banner on every run
- Default `dryRun: true`; refuse `--execute` without `--user-id`
- Never import from `app/` routes; never scheduled; never called from production code
- Use `persistInternalInvestigationCandidate`, `persistInternalFieldworkCandidate`, `persistInternalModelUpdateCandidate` only on `--execute`
- Pass explicit `packet` built from selected real evidence IDs (or sub-packet from `assembleEvidencePacketV1` filtered to selections)
- Include fixture marker in family text fields
- Return JSON report: selected evidence IDs, blocked reasons, created IDs, duplicate skips

### Dry-run-only scaffolding (safe first commit)

Phase 1 implementation should include only:

1. `--user-id` required preflight query (counts + sample owned IDs)
2. Build proposals + run persistence **prechecks** without transaction (or call persistence helpers against mocked db in tests)
3. Print planned seed actions and validator commands
4. **No `--execute` path** until Phase 2

Phase 2 adds `--execute` after live dry-run passes on dev user.

---

## Validation flow after fixture seed

For each family **independently**:

1. **Preflight:** `npx tsx scripts/seed-lower-family-validation-fixtures.ts --user-id <id> --families <family>` (dry-run default)
2. **Seed (if dry-run clean):** same command with `--execute`
3. **Review/publish validator dry-run:**
   - Investigation: `npx tsx scripts/validate-investigation-candidate-review-publish-flow.ts --user-id <id> --candidate-id <id>`
   - Fieldwork: (after validator added) same pattern
   - ModelUpdate: (after validator added) publish dry-run only
4. **Execute publish path only if validator reports `found: true` and preconditions pass**
5. **Confirm public read model** (Active Questions / Watch For / What Changed)
6. **Confirm ModelUpdate side effect** (`investigation_opened` / `fieldwork_assigned` / published `link_detected`)
7. **Record in closeout as fixture-backed validation**, not natural production validation

---

## Safe commands

```bash
# Discovery (read-only; always safe)
npx tsx scripts/discover-investigation-candidate-proposal.ts --user-id <id>
npx tsx scripts/discover-candidate-family-proposals.ts --user-id <id>

# Fixture preflight (dry-run default; safe once implemented)
npx tsx scripts/seed-lower-family-validation-fixtures.ts --user-id <id> --families investigation

# Investigation review/publish validation (dry-run default)
npx tsx scripts/validate-investigation-candidate-review-publish-flow.ts \
  --user-id <id> --candidate-id <seeded-id>

# UserMap validator (reference pattern)
npx tsx scripts/validate-user-map-candidate-review-publish-flow.ts \
  --user-id <id> --candidate-id <id>
```

## Forbidden commands (current dev user / lower-family context)

```bash
# Creates UserMap, not Investigation/Fieldwork/ModelUpdate
npx tsx scripts/run-candidate-creation-runtime-validation.ts \
  --execute --user-id user_34TUYA53pI1QRLK73O22Kve1a1G

# Any discovery scanner does not have --execute (do not add)
# Any automatic backfill / scheduler (does not exist; do not add)
# Manual SQL INSERT into investigation/fieldwork/model_update tables
# Weakening dark-run gates or precedence to force lower-family proposals
```

---

## Cleanup plan

| Item | Action |
|------|--------|
| Seeded `internal_only` / `proposed` candidates | `rejected` or `expired` via lifecycle API/helpers after validation; or delete in dev DB if no lifecycle test needed |
| Published `user_visible` rows | Mark in closeout; manually revert in dev only if needed (`visibility` rollback is not a production tool — prefer dedicated dev user) |
| Published fixture ModelUpdates | Record IDs; dev DB cleanup manual |
| Derivation runs + diagnostics artifacts | Accept noise in dev; optional later cleanup script (out of scope) |
| Duplicate re-seed | Persistence returns `DUPLICATE_CANDIDATE` — use unique fixture marker suffix per run or clean before re-seed |

**Recommendation:** use a **dedicated dev validation user** if available; if only `user_34TUYA53pI1QRLK73O22Kve1a1G` exists, fixture markers + reject/expire after validation.

---

## Documentation wording for final closeout (template)

Use when fixture-backed validation completes — **do not use before then**:

> **Lower-family fixture-backed live validation (dev only):** Investigation / Fieldwork / ModelUpdate review→publish loops were validated on local dev DB using explicitly marked fixture candidates seeded through real persistence helpers and real user-owned evidence links. This does **not** complete natural production validation; dark-run discovery on the current dataset still produces UserMap first. Natural lower-family validation remains blocked until a user naturally produces lower-family proposals or product policy approves governed production triggers.

Status table:

| Item | Status |
|------|--------|
| Discovery tooling | COMPLETE |
| Natural lower-family live validation | BLOCKED (candidate absence) |
| Fixture-backed lower-family live validation | COMPLETE / NOT COMPLETE (per family) |
| UserMap live validation | COMPLETE |

---

## Facts vs inference vs uncertainty

### Facts

- All three families have direct `persistInternal*Candidate` helpers with documented gate stacks.
- Investigation has an existing review/publish validator script; Fieldwork and ModelUpdate do not.
- ModelUpdate `link_detected` lane uses `visibility` + `isMeaningful`, not `candidateLifecycleStatus`.
- Lifecycle-managed families require `held_for_more_evidence → promoted` before publish.
- Local user `user_34TUYA53pI1QRLK73O22Kve1a1G` has 7 pattern claims, 18582 messages, 25 contradictions, 0 internal lower-family candidates.
- Discovery scanners found no safe natural lower-family execute user on local DB.

### Inference

- Option A (real evidence IDs) will satisfy ownership and evidence-policy gates for this user.
- Fixture markers in safe wording fields are sufficient to distinguish dev validation rows without schema changes.
- Combined script with family flags is smaller total surface than three duplicate scripts.

### Uncertainty

- Whether `assembleEvidencePacketV1` marks specific real rows as `linkable` + `ownershipResolvable` for all selected IDs without manual packet construction — **must be verified in dry-run preflight** before execute mode.
- Whether Fieldwork linked-object should anchor on `pattern_claim` or `contradiction_node` for this user — pick first owned row in preflight.
- Optimal cleanup semantics for published fixture rows in shared dev DB — product/process decision.
- Whether one derivation run per seed is acceptable noise or needs suppression in a later slice.

---

## Explicit non-goals (this strategy)

- No production generation changes
- No dark-run precedence changes
- No gate weakening
- No automatic backfill or scheduler
- No schema/migrations
- No public UI or mobile work
- No claiming natural live validation when fixtures were used

---

## Next exact step

**Agent 16 (recommended):** implement **dry-run-only** `seed-lower-family-validation-fixtures` preflight against `user_34TUYA53pI1QRLK73O22Kve1a1G`, prove Option A evidence selection passes persistence prechecks, then add `--execute` in a follow-up slice after dry-run evidence is green.
