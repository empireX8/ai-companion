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
| Phase 3 — Web Beta Surfaces | Expose core understanding surfaces on web (User Map/Investigations/Today/Timeline layering) | PARTIAL | Internal review API + hidden internal review page shipped; web Today/Timeline/Library backend-alignment polish shipped; Safe Slice 1 (`Active Questions` + `Watch For`) shipped as read-only list/detail surfaces with authenticated user-owned filtering, status-gated detail routes, and Watch For completion framing removed; `Your Map` safe slice shipped with `/your-map` list + `/your-map/[id]` detail + GlobalRail nav entry, read-only behavior, authenticated/user-owned + `visibility=user_visible` filtering, `internal_only` exclusion, no writes/promotion/edit/delete/confidence controls, shared not-found path for missing/unowned/internal-only records, and evidence fallback copy (`No linked evidence available yet.`); `What Changed` safe slice shipped as list-only public feed (`/what-changed`) with GlobalRail nav entry, authenticated/user-owned filtering, `visibility=user_visible` filtering, `isMeaningful=true` filtering, candidate/internal/non-meaningful exclusion, allowed real-ID links only, read-only only, no writes, no promotion/edit/delete controls, no `/what-changed/[id]` detail route, no public `/api/model-updates/[id]` usage, no Today/Timeline integration, no mobile work, and empty state copy (`No meaningful changes yet.`) | Today intelligence cards not integrated; Timeline model layers not integrated; promotion workflow is not shipped for public intelligence surfaces; future receipt/link continuity for new public intelligence objects still open; mobile parity for newly added public intelligence surfaces remains deferred | `docs/step7-phase3-internal-user-map-review-surface-contract.md`, `docs/step7-phase3-minimum-closeout.md`, `docs/step7-hidden-internal-user-map-review-page-closeout.md`, `docs/step8-web-backend-alignment-closeout.md`, `docs/phase3-public-intelligence-surfaces-contract.md` | `4d633f2`, `6a120f6`, `ad93dc6`, `0e89c13`, `a4c3277`, `a74ebe0`, `1835e6e`, `2a3807b`, `b5bf3d4`, `579cdb6`, `ff60fb2`, `8935921` | Open the Today intelligence-card safe-slice contract/validation audit, then sequence Timeline model-layer integration |
| Phase 4 — Actions / Experiments + Explore | Upgrade action semantics and Explore mode integration loops | NOT STARTED | Legacy actions and explore flows exist from earlier product baseline | No Phase 4 contract execution and no experiment semantics rollout | `docs/step3-execution-map.md`, `docs/step4a-category-agent-knowledge-addendum.md` | (no dedicated Phase 4 implementation commit trail yet) | Decide when to create/execute formal Phase 4 sequencing contract |
| Phase 5 — Receipts / Library Continuity | Deep-link evidence continuity and cross-surface trust traversal | PARTIAL | Web receipts and timeline/library backend-alignment passes completed; mobile receipt trust cleanup completed | No dedicated formal receipt API contract closeout; full cross-surface continuity layer still incomplete | `docs/step8-web-product-backend-alignment-contract.md`, `docs/step8-web-backend-alignment-closeout.md`, `docs/step3-execution-map.md` | Web: `a4c3277`, `a74ebe0`, `1835e6e`; Mobile: `ce1d411` | Decide whether to formalize Phase 5 contract now or continue targeted parity passes |
| Phase 6 — Mobile Parity | Backend-derived parity across existing/mobile surfaces with trust-safe behavior | IN PROGRESS | Existing-surface mobile trust cleanup sub-pass is `CLOSED / VALIDATED` (closeout verdict: `READY TO CLOSE EXISTING-SURFACE MOBILE TRUST CLEANUP`, no additional narrow repair required); mobile receipts are pattern/tension-only and backend-evidence anchored; no production action receipts; Today continue-thread cards are session-ID anchored; Today tension fetch failures no longer open synthetic canonical detail; Today pattern/tension insight details expose explicit `View receipt` CTAs only when real backend IDs exist (`receipt-pattern-{patternId}`, `receipt-tension-{contradictionId}`); receipt CTAs reuse existing Library/Receipts flow with no CTA for missing/blank IDs; Timeline rhythm is check-in/stateSummary-derived with honest insufficient-data copy; Timeline activity links map to real Library-backed targets only; missing Timeline links show honest non-link state; no internal User Map exposure; no mobile-side `Your Map` / `Active Questions` / `Model Updates` / `Watch For` synthesis | Full Phase 6 mobile parity is not closed; broader mobile intelligence surfaces are not built; mobile still does not expose `Your Map` / `Active Questions` / `Model Updates` / `Watch For`; future parity work should open as a new scoped pass rather than trust-hotfix continuation; repo-wide lint still has pre-existing unrelated failures | `docs/step8-web-backend-alignment-closeout.md` (next direction), mobile audit/validation trail in commit history | `ce1d411`, `ce1211a`, `52eff58`, `ca0dbf2`, `fe6665a`, `26c9b82` | Decision gate: return to broader Phase 3/public intelligence surfaces, or open a new scoped Phase 6 pass for broader mobile intelligence surfaces after upstream web/product surfaces exist |
| Phase 7 — Advanced Intelligence | Multi-lens/agent deliberation, Intelligence Library retrieval, advanced observer/maturity layers | DEFERRED | Strategic contract guidance exists only | No Phase 7 implementation started by design | `docs/step4a-category-agent-knowledge-addendum.md`, `docs/step3-execution-map.md` | (none) | Keep deferred until Phases 2–6 are stable and explicitly re-approved |

## 3) Implementation Pass Table (Separate from Phases)

| Pass name | Repo | Purpose | Phase(s) supported | Status | Commits | Validation | Remaining gaps |
|---|---|---|---|---|---|---|---|
| Internal User Map review API/page | `/Users/user/ai-companion` | Add internal-only, reviewer-gated, read-only candidate inspection path | Phase 3 (internal-only sub-scope) | CLOSED (pass scope) | `4d633f2`, `6a120f6`, `ad93dc6`, `0e89c13` | Contract + closeout docs record auth gating, read-only behavior, no public leakage | No promotion/edit/delete workflow; no public User Map |
| Web backend-alignment polish (Today/Timeline/Library) | `/Users/user/ai-companion` | Remove synthetic trust gaps; align links/receipts/rhythm with backend truth | Phase 3 (surface trust), Phase 5 (receipt continuity) | CLOSED (pass scope) | `a4c3277`, `a74ebe0`, `1835e6e`, `2a3807b` | Step 8 closeout records manual validation and verification suite | Public User Map/promotion/runtime triggers still deferred |
| Phase 3 Safe Slice 1 — Read-only Active Questions + Watch For | `/Users/user/ai-companion` | Add read-only public `Active Questions` + `Watch For` list/detail routes, GlobalRail nav entries, authenticated user-owned filtering, and strict first-slice status gating on detail routes; remove Watch For completion framing | Phase 3 | CLOSED / VALIDATED | `b5bf3d4`, `579cdb6` | `npx prisma generate` passed; `npx tsc --noEmit` passed; `npx vitest run` passed; `npm run build` passed; `bash scripts/check-trust-language.sh` passed; `bash scripts/check-legacy-surfaces.sh` passed | Today intelligence cards still open; Timeline model layers still open; future receipt/link continuity for these objects still open; mobile parity for new public intelligence surfaces deferred |
| Phase 3 Your Map Safe Slice | `/Users/user/ai-companion` | Add read-only public `Your Map` list/detail routes and GlobalRail nav entry with authenticated user-owned + `visibility=user_visible` filtering, `internal_only` exclusion, no writes/promotion/edit/delete/confidence controls, shared not-found path for missing/unowned/internal-only records, and honest evidence fallback copy (`No linked evidence available yet.`) | Phase 3 | CLOSED / VALIDATED | `ff60fb2` | `npx prisma generate` passed; `npx tsc --noEmit` passed; `npx vitest run` passed; `npm run build` passed; `bash scripts/check-trust-language.sh` passed; `bash scripts/check-legacy-surfaces.sh` passed | Today intelligence cards still open; Timeline model layers still open; future receipt/link continuity for new public intelligence objects still open; mobile parity for new public intelligence surfaces deferred |
| Phase 3 What Changed Safe Slice | `/Users/user/ai-companion` | Add list-only public `What Changed` feed (`/what-changed`) + GlobalRail nav entry with authenticated/user-owned + `visibility=user_visible` + `isMeaningful=true` filtering, exclusion of candidate/internal/non-meaningful updates, allowed real-ID links only, read-only behavior, no writes/promotion/edit/delete controls, no detail route, no public `/api/model-updates/[id]` usage, and empty state copy (`No meaningful changes yet.`) | Phase 3 | CLOSED / VALIDATED | `8935921` | Safe-slice scope validated: list-only public feed, no Today/Timeline integration, no mobile work | Today intelligence cards still open; Timeline model layers still open; future receipt/link continuity for new public intelligence objects still open; mobile parity for new public intelligence surfaces deferred |
| Mobile receipts backend-alignment cleanup | `/Users/user/Mindlabs-app` | Remove synthetic action receipts and invented chronology; preserve backend evidence receipts | Phase 5, Phase 6 | CLOSED / VALIDATED | `ce1d411` | Manual validation + `tsc`/`vitest`/`build` passes; lint unrelated/pre-existing | Broader mobile parity still open |
| Mobile Today session-resume/tension-fallback cleanup | `/Users/user/Mindlabs-app` | Anchor continue-thread to real linked sessions; prevent synthetic canonical tension detail on fetch failure | Phase 6 | CLOSED / VALIDATED | `ce1211a` | Manual validation + `tsc`/`vitest`/`build` passes; lint unrelated/pre-existing | Full mobile parity closeout still pending |
| Mobile Timeline rhythm honesty patch | `/Users/user/Mindlabs-app` | Remove decorative measured rhythm cues; use check-in/stateSummary-derived rhythm copy with insufficiency guard | Phase 6 | CLOSED / VALIDATED | `52eff58` | Manual validation + `tsc`/`vitest`/`build` passes; lint unrelated/pre-existing | Full mobile parity closeout still pending |
| Mobile Timeline Library-link alignment | `/Users/user/Mindlabs-app` | Map Timeline activity links to real Library-backed targets only; disable missing-link paths with honest copy/toast | Phase 6 | CLOSED / VALIDATED | `ca0dbf2` | Manual validation + `tsc`/`vitest`/`build` passes; lint unrelated/pre-existing | Full mobile parity closeout still pending |
| Mobile Today receipt-link parity | `/Users/user/Mindlabs-app` | Add explicit Today pattern/tension `View receipt` CTAs when real backend IDs exist, anchored to receipt IDs and routed through existing Library/Receipts flow; follow-up type-safety repair fixed optional `surfaceType` strict assignability and safe union narrowing before reading `availability.message` | Phase 6 | CLOSED / VALIDATED | `fe6665a`, `26c9b82` | Manual validation + `tsc`/`vitest`/`build` passes; lint failed only on pre-existing unrelated files | Full mobile parity closeout still pending; remaining unknowns require closeout audit |
| Existing-surface mobile trust cleanup closeout audit | `/Users/user/Mindlabs-app` | Formal closeout audit of receipts/Today/Timeline/Library/actions trust behavior across current mobile surfaces | Phase 6 | CLOSED / VALIDATED | `ce1d411`, `ce1211a`, `52eff58`, `ca0dbf2`, `fe6665a`, `26c9b82` | Closeout verdict: `READY TO CLOSE EXISTING-SURFACE MOBILE TRUST CLEANUP`; mobile repo clean; `tsc`/`vitest`/`build` passed; lint failed only on pre-existing unrelated files | Full Phase 6 remains open for broader intelligence surfaces; new parity work should be opened as a new scoped pass |

## 4) Current Truth Summary (Blunt)

Genuinely closed:
- Phase 1A (schema foundation).
- Phase 1B (additive APIs).
- Phase 1C (existing endpoint include-gated link expansion).
- Internal review API/page pass.
- Web backend-alignment pass (Today/Timeline/Library).
- Phase 3 What Changed safe slice (`CLOSED / VALIDATED`, `8935921`).
- Mobile receipts pass, mobile Today pass, mobile Timeline rhythm pass, mobile Timeline Library-link alignment pass.
- Mobile Today receipt-link parity pass.
- Existing-surface mobile trust cleanup sub-pass (CLOSED / VALIDATED; no additional narrow repair required).

Partially done:
- Phase 2: substantial dark-engine groundwork exists, but full phase closeout is not formally complete.
- Phase 3: internal-only web review + surface trust polish + Safe Slice 1 (`Active Questions` + `Watch For`) + `Your Map` safe slice + `What Changed` safe slice are done, but Today intelligence cards and Timeline model layers are not delivered.
- Phase 5: receipt continuity materially improved, but not finalized as a full dedicated continuity architecture.
- Phase 6: mobile parity is underway, not complete.

Not done:
- Phase 4 (Actions/Experiments + Explore semantic upgrade) as an official phase execution.
- Phase 7 (advanced intelligence) by design.

Must not be claimed as done:
- “Phase 3 closed” (public web intelligence surface rollout is not complete).
- “Mobile parity complete” (full Phase 6 scope is still broader than the closed trust-cleanup sub-pass).
- “Advanced intelligence started” (explicitly deferred).

## 5) Current Active Workstream

Current active workstream (official label):
- **Phase 3 public web intelligence surfaces (decision-gated next workstream)**
- Existing-surface mobile trust cleanup sub-pass is closed/validated.
- Do not continue the mobile trust-hotfix loop unless a new blocker is discovered.

Do not label this as:
- “Step 10 Prompt”
- any prompt-step status label

## 6) Update Protocol

After every committed implementation pass:
1. Update this ledger in the same working session, or
2. Explicitly record “ledger unchanged” with a one-line reason in the pass closeout note.

Minimum update fields each time:
- affected phase status change (if any)
- implementation pass row update
- commit(s) and validation evidence
- any newly introduced deferred gap

## 7) Current Decision Gate (Next Workstream Decision)

Decision recorded:
- **Next workstream: Phase 3 public web intelligence surfaces.**

Why this is the correct next move:
- existing-surface mobile trust cleanup is closed/validated with no additional narrow repair required,
- Phase 3 public intelligence surfaces remain partial,
- broader mobile intelligence parity should follow stable upstream web/product contracts.
- `docs/phase3-public-intelligence-surfaces-contract.md` formalizes the Phase 3 public surface order and read-only-first sequencing.

Deferred until later phase gates:
- new broad Phase 6 mobile intelligence pass,
- Phase 4 Actions/Experiments semantic expansion,
- Phase 5 continuity expansion for new Understanding objects,
- Phase 7 agents/lenses.

Guardrail:
- do not continue trust-hotfix continuation work unless a new concrete blocker appears.

Recommended next audit title:
- **Phase 3 Public Intelligence Surfaces — Today Intelligence Cards Contract + Safe-Slice Audit**

## 8) Next Recommended Move

Recommendation:
- **Run: Phase 3 Public Intelligence Surfaces — Today Intelligence Cards Contract + Safe-Slice Audit; then sequence Timeline model-layer integration.**

Why this next:
- `What Changed` safe slice is now closed/validated in commit `8935921`,
- the highest-impact remaining Phase 3 gaps are Today intelligence cards and Timeline model layers,
- receipt/link continuity and mobile parity for new intelligence surfaces remain correctly deferred until those web surfaces stabilize.

## 9) Evidence Pointers

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
- `docs/phase3-public-intelligence-surfaces-contract.md`

Git histories inspected:
- `/Users/user/ai-companion` (`git log --oneline -25`)
- `/Users/user/Mindlabs-app` (`git log --oneline -25`)
