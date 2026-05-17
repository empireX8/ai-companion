# MindLab Roadmap Status Ledger

Date: 2026-05-17
Type: Canonical roadmap status ledger
Scope: `/Users/user/ai-companion` + `/Users/user/Mindlabs-app`

## 1) Naming Rules (Canonical)

Definitions:
- Roadmap Phase: official long-term product/architecture phase in the MindLab execution plan.
- Implementation Pass: a smaller stabilization/repair/cleanup effort that supports one or more roadmap phases.
- Prompt Step: temporary chat execution label only.

Hard rules:
- Prompt-step labels are not official roadmap phase status.
- A phase is not closed unless this ledger marks it `CLOSED` and references closeout evidence (doc and/or commit trail).
- If a pass completes but the underlying phase still has open scope, the phase remains `PARTIAL` or `IN PROGRESS`.
- Every committed implementation pass must update this ledger or explicitly state why not in the pass closeout.

## 2) Official Roadmap Phase Table

| Phase | Official scope | Current status | What is done | What is not done | Supporting docs | Supporting commits | Next required decision |
|---|---|---|---|---|---|---|---|
| Phase 1A — Schema Foundation | Add persisted understanding objects/enums/indexes/migrations | CLOSED | `UserMapConclusion`, `Investigation`, `ModelUpdate`, `FieldworkAssignment`, `UnderstandingEvidenceLink` schema foundations shipped | N/A for 1A scope | `docs/step4-phase0-contract-lock.md`, `docs/step5-foundation-closeout-and-next-work-map.md` | `1234026` | Keep as baseline; no reopen unless schema gap is proven |
| Phase 1B — Additive APIs | Add authenticated, user-scoped additive APIs for new objects | CLOSED | Controlled read/create/update APIs and validation/lifecycle guardrails shipped | N/A for 1B scope | `docs/step4b-phase1b-additive-api-contract.md`, `docs/step5-foundation-closeout-and-next-work-map.md` | `31a3e1e` | Keep stable; only additive refinements |
| Phase 1C — Existing API link expansions | Add include-gated understanding links to existing endpoints without breaking contracts | CLOSED | Include-gated additive links shipped on existing endpoints | N/A for 1C scope | `docs/step5-foundation-closeout-and-next-work-map.md`, `docs/step6-phase2-dark-engine-gates-contract.md` (baseline notes 1C in place) | `fcc9e4d` | Verify no regressions when later phases consume link fields |
| Phase 2 — Dark Engine + Objectivity Gates | Dark synthesis, gating, candidate/internal persistence, abstention and diagnostics | PARTIAL | Dark-engine contract, foundation, diagnostics, provenance writer, initial candidate persistence and visibility filtering shipped | Full Phase 2 scope not closed: broader gated persistence/movement and full acceptance-closeout evidence are not fully closed in a single closeout artifact | `docs/step6-phase2-dark-engine-gates-contract.md`, `docs/step7-phase3-minimum-closeout.md` (preconditions) | `35b951d`, `c037d6b`, `e67998d`, `da8380b`, `c35bd11`, `24b4259`, `c3f6266` | Decide whether to run formal Phase 2 closeout now or defer while surface trust work continues |
| Phase 3 — Web Beta Surfaces | Expose core understanding surfaces on web (User Map/Investigations/Today/Timeline layering) | PARTIAL | Internal review API + hidden internal review page shipped; web Today/Timeline/Library backend-alignment polish shipped | Public User Map not shipped; promotion workflow not shipped; Today/Timeline/Library still not rendering full User Map/ModelUpdate/Investigation layers | `docs/step7-phase3-internal-user-map-review-surface-contract.md`, `docs/step7-phase3-minimum-closeout.md`, `docs/step7-hidden-internal-user-map-review-page-closeout.md`, `docs/step8-web-backend-alignment-closeout.md` | `4d633f2`, `6a120f6`, `ad93dc6`, `0e89c13`, `a4c3277`, `a74ebe0`, `1835e6e`, `2a3807b` | Decide whether next macro-focus returns to public Phase 3 web surfaces or continues parity cleanup first |
| Phase 4 — Actions / Experiments + Explore | Upgrade action semantics and Explore mode integration loops | NOT STARTED | Legacy actions and explore flows exist from earlier product baseline | No Phase 4 contract execution and no experiment semantics rollout | `docs/step3-execution-map.md`, `docs/step4a-category-agent-knowledge-addendum.md` | (no dedicated Phase 4 implementation commit trail yet) | Decide when to create/execute formal Phase 4 sequencing contract |
| Phase 5 — Receipts / Library Continuity | Deep-link evidence continuity and cross-surface trust traversal | PARTIAL | Web receipts and timeline/library backend-alignment passes completed; mobile receipt trust cleanup completed | No dedicated formal receipt API contract closeout; full cross-surface continuity layer still incomplete | `docs/step8-web-product-backend-alignment-contract.md`, `docs/step8-web-backend-alignment-closeout.md`, `docs/step3-execution-map.md` | Web: `a4c3277`, `a74ebe0`, `1835e6e`; Mobile: `ce1d411` | Decide whether to formalize Phase 5 contract now or continue targeted parity passes |
| Phase 6 — Mobile Parity | Backend-derived parity across existing/mobile surfaces with trust-safe behavior | IN PROGRESS | Mobile receipts are pattern/tension-only and backend-evidence anchored; synthetic action receipts removed; Today continue-thread cards are session-ID anchored; Today tension fetch failures no longer open synthetic canonical detail; Timeline rhythm is check-in/stateSummary-derived with honest insufficient-data copy; Timeline activity links map to real Library-backed targets only; missing Timeline links show honest non-link state | Full mobile parity closeout is not done; Today explicit receipt-link parity may still be incomplete; broader public User Map/mobile intelligence surfaces are not built (`Your Map` / `Active Questions` / `Model Updates` / `Watch For` are absent); repo-wide lint still has pre-existing unrelated failures | `docs/step8-web-backend-alignment-closeout.md` (next direction), mobile audit/validation trail in commit history | `ce1d411`, `ce1211a`, `52eff58`, `ca0dbf2` | Continue Phase 6 mobile parity with a Today receipt-link parity audit/patch before formal closeout audit |
| Phase 7 — Advanced Intelligence | Multi-lens/agent deliberation, Intelligence Library retrieval, advanced observer/maturity layers | DEFERRED | Strategic contract guidance exists only | No Phase 7 implementation started by design | `docs/step4a-category-agent-knowledge-addendum.md`, `docs/step3-execution-map.md` | (none) | Keep deferred until Phases 2–6 are stable and explicitly re-approved |

## 3) Implementation Pass Table (Separate from Phases)

| Pass name | Repo | Purpose | Phase(s) supported | Status | Commits | Validation | Remaining gaps |
|---|---|---|---|---|---|---|---|
| Internal User Map review API/page | `/Users/user/ai-companion` | Add internal-only, reviewer-gated, read-only candidate inspection path | Phase 3 (internal-only sub-scope) | CLOSED (pass scope) | `4d633f2`, `6a120f6`, `ad93dc6`, `0e89c13` | Contract + closeout docs record auth gating, read-only behavior, no public leakage | No promotion/edit/delete workflow; no public User Map |
| Web backend-alignment polish (Today/Timeline/Library) | `/Users/user/ai-companion` | Remove synthetic trust gaps; align links/receipts/rhythm with backend truth | Phase 3 (surface trust), Phase 5 (receipt continuity) | CLOSED (pass scope) | `a4c3277`, `a74ebe0`, `1835e6e`, `2a3807b` | Step 8 closeout records manual validation and verification suite | Public User Map/promotion/runtime triggers still deferred |
| Mobile receipts backend-alignment cleanup | `/Users/user/Mindlabs-app` | Remove synthetic action receipts and invented chronology; preserve backend evidence receipts | Phase 5, Phase 6 | CLOSED / VALIDATED | `ce1d411` | Manual validation + `tsc`/`vitest`/`build` passes; lint unrelated/pre-existing | Broader mobile parity still open |
| Mobile Today session-resume/tension-fallback cleanup | `/Users/user/Mindlabs-app` | Anchor continue-thread to real linked sessions; prevent synthetic canonical tension detail on fetch failure | Phase 6 | CLOSED / VALIDATED | `ce1211a` | Manual validation + `tsc`/`vitest`/`build` passes; lint unrelated/pre-existing | Today receipt-link parity with web may still be incomplete |
| Mobile Timeline rhythm honesty patch | `/Users/user/Mindlabs-app` | Remove decorative measured rhythm cues; use check-in/stateSummary-derived rhythm copy with insufficiency guard | Phase 6 | CLOSED / VALIDATED | `52eff58` | Manual validation + `tsc`/`vitest`/`build` passes; lint unrelated/pre-existing | Full mobile parity closeout still pending |
| Mobile Timeline Library-link alignment | `/Users/user/Mindlabs-app` | Map Timeline activity links to real Library-backed targets only; disable missing-link paths with honest copy/toast | Phase 6 | CLOSED / VALIDATED | `ca0dbf2` | Manual validation + `tsc`/`vitest`/`build` passes; lint unrelated/pre-existing | Full mobile parity closeout still pending; Today receipt-link parity remains the highest narrow risk |

## 4) Current Truth Summary (Blunt)

Genuinely closed:
- Phase 1A (schema foundation).
- Phase 1B (additive APIs).
- Phase 1C (existing endpoint include-gated link expansion).
- Internal review API/page pass.
- Web backend-alignment pass (Today/Timeline/Library).
- Mobile receipts pass, mobile Today pass, mobile Timeline rhythm pass, mobile Timeline Library-link alignment pass.

Partially done:
- Phase 2: substantial dark-engine groundwork exists, but full phase closeout is not formally complete.
- Phase 3: internal-only web review + surface trust polish done, but public User Map/investigation experience is not delivered.
- Phase 5: receipt continuity materially improved, but not finalized as a full dedicated continuity architecture.
- Phase 6: mobile parity is underway, not complete.

Not done:
- Phase 4 (Actions/Experiments + Explore semantic upgrade) as an official phase execution.
- Phase 7 (advanced intelligence) by design.

Must not be claimed as done:
- “Phase 3 closed” (public web intelligence surface rollout is not complete).
- “Mobile parity complete” (ongoing trust/navigation gaps remain).
- “Advanced intelligence started” (explicitly deferred).

## 5) Current Active Workstream

Current active workstream (official label):
- **Mobile parity / existing surface trust cleanup**
- Current focus is existing-surface trust cleanup, not full Phase 6 completion.

Do not label this as:
- “Phase 3”
- “Step 9 status”

## 6) Update Protocol

After every committed implementation pass:
1. Update this ledger in the same working session, or
2. Explicitly record “ledger unchanged” with a one-line reason in the pass closeout note.

Minimum update fields each time:
- affected phase status change (if any)
- implementation pass row update
- commit(s) and validation evidence
- any newly introduced deferred gap

## 7) Next Recommended Move

Recommendation:
- **Continue Phase 6 mobile parity with a Today receipt-link parity audit/patch.**

Why this next:
- web backend contracts for Today/Timeline/Library are stabilized,
- Timeline Library-link alignment is now validated and reduces Timeline trust risk,
- Today receipt-link parity remains the narrowest unresolved trust continuity risk,
- this is smaller and safer than restarting broad Phase 3 public-surface rollout immediately.

Alternative (not primary now):
- run a Phase 6 mobile parity closeout audit before deciding next only if team prefers decision-gate discipline over one more narrow patch pass.

## 8) Evidence Pointers

Web docs used for this ledger:
- `docs/step2a-infrastructure-audit.md`
- `docs/step2b-architecture-application-map.md`
- `docs/step2c-product-surface-ui-map.md`
- `docs/step3-execution-map.md`
- `docs/step3-6-preimplementation-consolidation.md`
- `docs/step4-phase0-contract-lock.md`
- `docs/step4a-category-agent-knowledge-addendum.md`
- `docs/step4b-phase1b-additive-api-contract.md`
- `docs/step5-foundation-closeout-and-next-work-map.md`
- `docs/step6-phase2-dark-engine-gates-contract.md`
- `docs/step7-phase3-internal-user-map-review-surface-contract.md`
- `docs/step7-phase3-minimum-closeout.md`
- `docs/step7-hidden-internal-user-map-review-page-contract.md`
- `docs/step7-hidden-internal-user-map-review-page-closeout.md`
- `docs/step8-web-product-backend-alignment-contract.md`
- `docs/step8-web-backend-alignment-closeout.md`

Git histories inspected:
- `/Users/user/ai-companion` (`git log --oneline -25`)
- `/Users/user/Mindlabs-app` (`git log --oneline -25`)
