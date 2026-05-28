# Engineering Ledger — MindLab

> Factual record of agent-driven development phases.
> Each entry is written by the Closeout Agent after a phase completes.
> No exaggeration. No speculation.

---

## Agent Control Files Setup

- **Status:** complete

- **Scope:** repo workflow/docs/scripts only
- **Runtime behavior:** unchanged
- **Files created:**
  - `AGENTS.md` — agent operating system rules and role definitions
  - `docs/agent-workflow.md` — operating loop documentation
  - `docs/engineering-ledger.md` — this file (initialized)
  - `prompts/architect.md` — architect agent prompt
  - `prompts/implementer.md` — implementation agent prompt
  - `prompts/auditor.md` — audit agent prompt
  - `prompts/test-fixer.md` — test repair agent prompt
  - `prompts/closeout.md` — closeout agent prompt
  - `scripts/verify-mindlab.sh` — unified verification script
- **Verification:** pending (files created, verification script ready)
- **What remains partial:** N/A — this is the setup phase
- **Next step after this:** Phase 2I Candidate Lifecycle/Schema Design Audit

---

## Phase 2I — Candidate Lifecycle/Schema Design Audit

- **Status:** complete
- **Scope:** docs-only audit of current implemented truth vs. required candidate lifecycle
- **Runtime behavior:** unchanged
- **Files changed:**
  - `docs/phase2i-candidate-lifecycle-schema-design-audit.md` — created (audit document)
- **Verification results:**
  - `git diff --check`: pass
  - `npx tsc --noEmit`: skipped (no code changes)
  - `npx vitest run`: skipped (no code changes)
  - `npm run build`: skipped (no code changes)
  - `bash scripts/check-trust-language.sh`: skipped (no code changes)
  - `bash scripts/check-legacy-surfaces.sh`: skipped (no code changes)
- **What remains partial:** N/A — this is a docs-only audit. No implementation was attempted.
- **Next step:** Review the recommended implementation slice (add `candidateLifecycleStatus` to `UserMapConclusion` only) and decide whether to proceed with schema migration.

---

## Phase 2I — Candidate Lifecycle Implementation

- **Status:** complete
- **Scope:** Add `CandidateLifecycleStatus` enum and `candidateLifecycleStatus` field to `UserMapConclusion` model, with migration, persistence code update, and tests.
- **Runtime behavior:** New candidates are created with `candidateLifecycleStatus = proposed`. Existing records remain nullable (backward compatible).
- **Files changed:**
  - `prisma/schema.prisma` — added `CandidateLifecycleStatus` enum, added `candidateLifecycleStatus` field to `UserMapConclusion`
  - `prisma/migrations/20260528215130_add_candidate_lifecycle_status/` — new migration
  - `lib/understanding-dark-engine/user-map-candidate-persistence.ts` — import `CandidateLifecycleStatus`, set `candidateLifecycleStatus: CandidateLifecycleStatus.proposed` on create
  - `lib/__tests__/understanding-dark-engine-user-map-candidate-persistence.test.ts` — updated `InMemoryConclusion` type, mock create, seed data, and added assertion for `candidateLifecycleStatus: "proposed"`
- **Verification results:**
  - `git diff --check`: pass
  - `npx tsc --noEmit`: pass
  - `npx vitest run`: pass (136 files, 2279 tests)
  - `npm run build`: pass
  - `bash scripts/check-trust-language.sh`: pass
  - `bash scripts/check-legacy-surfaces.sh`: pass
- **What remains partial:**
  - `Investigation`, `ModelUpdate`, and `FieldworkAssignment` still lack lifecycle status (deferred per audit recommendation)
  - No candidate promotion/rejection workflow yet
  - No candidate expiry/cleanup yet
  - No cross-family candidate query yet
  - No user-facing candidate review UI yet
- **Next step:** Phase 2J — Candidate Promotion/Rejection Workflow Design

---

## Phase 2K — Candidate Lifecycle Transition Policy/Helpers

- **Status:** complete
- **Scope:** Define safe lifecycle transition semantics for `UserMapConclusion.candidateLifecycleStatus` before building promotion/rejection workflows.
- **Runtime behavior:** unchanged — no existing code calls the new helpers yet
- **Files changed:**
  - `lib/candidate-lifecycle-transitions.ts` — created (lifecycle transition policy module)
  - `lib/__tests__/candidate-lifecycle-transitions.test.ts` — created (51 focused unit tests)
- **Transition rules added:**
  - `proposed → held_for_more_evidence` (evidence exists but insufficient confidence)
  - `proposed → rejected` (gates fail definitively)
  - `proposed → expired` (timeout without sufficient evidence)
  - `held_for_more_evidence → proposed` (new evidence arrives)
  - `held_for_more_evidence → rejected` (gates fail after re-evaluation)
  - `held_for_more_evidence → expired` (timeout)
  - `held_for_more_evidence → promoted` (gates pass)
  - `rejected → proposed` (only via new candidate cycle)
  - `promoted → superseded` (replaced by newer candidate)
  - `expired → proposed` (only via new candidate cycle)
- **Null semantics:** `null` means legacy/pre-lifecycle/not lifecycle-managed. Transitions from `null` are forbidden — must set an explicit initial status first.
- **Exported functions:**
  - `canTransition(from, to)` → `LifecycleTransitionResult` (discriminated union)
  - `transitionOrThrow(from, to)` → returns next status or throws
  - `getAllowedNextStatuses(status)` → `Set<CandidateLifecycleStatus>`
  - `isTerminalStatus(status)` → boolean (only `superseded` is terminal)
  - `isDeadEndStatus(status)` → boolean (`rejected`, `expired`, `superseded`)
- **Tests added/changed:**
  - 51 new tests covering all allowed transitions, all forbidden transitions, null semantics, terminal/dead-end detection, and error handling
- **What did not change:**
  - No schema changes (no new fields, no new enums)
  - No changes to `Investigation`, `ModelUpdate`, or `FieldworkAssignment`
  - No public/mobile projection
  - No user-facing review UI
  - No ModelUpdate records created
  - No automatic promotion/rejection
  - No message/import route behavior changes
  - No dark-run execution behavior changes
  - No unrelated lifecycle code refactored
- **Verification results:**
  - `git diff --check`: pass
  - `npx tsc --noEmit`: pass
  - `npx vitest run`: pass (137 files, 2330 tests)
  - `npm run build`: pass
  - `bash scripts/check-trust-language.sh`: pass
  - `bash scripts/check-legacy-surfaces.sh`: pass
- **What remains partial:**
  - No promotion/rejection workflow yet (next step)
  - No candidate expiry/cleanup yet
  - No cross-family candidate query yet
  - No user-facing candidate review UI yet
- **Next step:** Phase 2L — Candidate Promotion/Rejection Workflow (use `transitionOrThrow` to gate promotion/rejection actions)

---

*Future entries will be appended below this line.*
