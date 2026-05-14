# MindLab Understanding Engine — Step 3 Execution Map v1

**Date:** 2026-05-14  
**Sources:**
- `docs/step2a-infrastructure-audit.md`
- `docs/step2b-architecture-application-map.md`
- `docs/step2c-product-surface-ui-map.md`

**Status:** Planning artifact only. No implementation in this step.

## 1. Purpose

This document translates Step 2A (infrastructure audit), Step 2B (architecture/application map), and Step 2C (product surface/UI map) into a concrete engineering execution plan.

It defines:

- safest additive build order
- object and API sequencing
- derivation/engine integration sequencing
- web/mobile rollout sequencing
- testing and validation gates per phase
- implementation prompt order for Step 3 execution

### Non-negotiable framing

This is an additive MindLab intelligence update.

- Do not remove existing surfaces.
- Do not replace Patterns, Tensions, Timeline, Actions, Library, Receipts, Journal, Explore, or Check-ins.
- Do not flatten the update into only a new User Map page.
- New intelligence must connect existing surfaces and improve their interactions.

## 2. Current Baseline

## 2.1 Existing infrastructure that must be preserved

- Prisma-backed models already live for patterns, contradictions, actions, timeline inputs, references, evidence, sessions, journal, and check-ins.
- Existing derivation pipeline already creates `PatternClaim` + evidence and supports lifecycle transitions.
- Existing contradiction pipeline already creates `ContradictionNode` + evidence and escalation.
- Existing actions pipeline (`SurfacedAction`) already supports status/outcome tracking.
- Existing timeline aggregation already provides cross-surface chronology.
- Existing trust assets exist: receipts and evidence spans.

## 2.2 Known model gaps from Step 2A

Not present yet and required for the update:

- `UserMapConclusion`
- `Investigation`
- `ModelUpdate`
- `FieldworkAssignment`
- explicit action/experiment extension model fields
- optional advanced objects for later phases (`GenerativeSelfModelEntry`, `ModelMaturitySignal`, `MetaObserverFinding`)

## 2.3 Existing surface baseline from Step 2A/2C

Current web routes already include Today, Journal, Explore, Check-ins, Timeline, Patterns, Contradictions, Actions, Evidence, Library.

Step 2C confirms additive target surfaces:

- keep existing surfaces in place
- add `User Map` and `Investigations` as secondary intelligence surfaces
- strengthen existing surfaces with model update, fieldwork, and cross-link behavior

## 2.4 Mobile baseline and constraints

From Step 2A:

- mobile currently has parity gaps and some synthetic/frontend-derived detail behavior
- new intelligence must be backend-derived
- no local intelligence reimplementation in mobile

From Step 2C:

- mobile v1 must include Today, Journal, Explore, Check-ins, Timeline, Patterns, Tensions, Actions/Experiments, User Map, Investigations, Model Updates, Fieldwork, and Receipts access

## 3. New Architecture Objects To Build

| Object | Purpose | Key Inputs | Key Outputs / Consumers | Build Priority |
|---|---|---|---|---|
| `UserMapConclusion` | Persisted user understanding conclusions with confidence + evidence links | Pattern claims, tensions, timeline, check-ins, journal/explore, outcomes, corrections | User Map, Today summary, Investigations context, Actions generation | P1 |
| `Investigation` | Active research thread with competing theories and evidence-needed states | Contradictions, patterns, state switches, user-started inquiries, failed actions, corrections | Investigations surface, Today active card, Timeline milestones, User Map updates on resolution | P1 |
| `ModelUpdate` | Atomic record of model change deltas | UserMapConclusion changes, Investigation status changes, action outcomes, fieldwork completions, corrections | Today "What changed", Timeline model events, User Map change history | P1 |
| `FieldworkAssignment` | Structured observation prompt (separate from action) | Investigation evidence gaps, weak conclusions, pattern uncertainty | Today fieldwork card, Check-ins prompt, Investigation detail, update events | P1 |
| `Action/Experiment extension` | Expand existing action system to support hypothesis testing + conditions | Existing SurfacedAction + Investigation/User Map context | Actions/Experiments surface, Tested Moves/What Worked, model feedback loop | P2 |
| `GenerativeSelfModelEntry` (conservative) | Optional causal chain/context object | Conclusions + timeline + outcomes | User Map depth, Explore sense-making | P6 |
| `ModelMaturitySignal` | Internal maturity signal for model reliability by area | conclusion coverage + confidence + source diversity | subtle user context + internal quality tracking | P6 |
| `MetaObserverFinding` (internal-first) | Quality/blind spot diagnostics from eval/live data | eval outputs + corrections + stuck investigations | internal review + future safety/product tuning | P6 |

### Object build principles

- Persist core user-facing intelligence objects (`UserMapConclusion`, `Investigation`, `ModelUpdate`, `FieldworkAssignment`) before surface rollout.
- Keep all existing models intact; add links rather than replacing prior objects.
- Prefer additive linking fields and junctions over object redefinition.

## 4. Backend API Plan

## 4.1 API strategy

- All new endpoints are additive.
- Existing endpoints remain backward-compatible.
- Existing route contracts are not broken.
- Cross-link expansions are additive fields, not shape-breaking rewrites.

## 4.2 New endpoint groups

### User Map

- `GET /api/user-map`
- `GET /api/user-map/[id]`
- `PATCH /api/user-map/[id]/correct`
- optional internal trigger: `POST /api/user-map/synthesize`

### Investigations

- `GET /api/investigations`
- `GET /api/investigations/[id]`
- `POST /api/investigations`
- `PATCH /api/investigations/[id]`

### Model Updates

- `GET /api/model-updates`

### Fieldwork

- `GET /api/fieldwork`
- `POST /api/fieldwork`
- `PATCH /api/fieldwork/[id]`

### Action outcome extension

- `PATCH /api/actions/[id]/outcome`

## 4.3 Additive extensions to existing endpoints

- `/api/patterns`: include related investigation/user-map references
- `/api/contradiction` + detail endpoints: include investigation/user-map links
- `/api/timeline`: include model/investigation/fieldwork/action outcome event layers
- `/api/check-ins`: include active fieldwork prompt context
- `/api/library` and/or evidence endpoints: include conclusion/investigation/update linkage

## 4.4 Likely backend files affected during implementation

- `prisma/schema.prisma`
- `app/api/user-map/**`
- `app/api/investigations/**`
- `app/api/model-updates/**`
- `app/api/fieldwork/**`
- `app/api/actions/[id]/route.ts` (outcome extension)
- `app/api/patterns/route.ts` (additive response links)
- `app/api/contradiction/**` (additive response links)
- `app/api/timeline/route.ts` (event layer expansion)
- `app/api/check-ins/route.ts` (fieldwork prompt integration)

## 5. Derivation / Engine Plan

## 5.1 Integration approach

Build on top of the current pattern/contradiction/action/timeline pipelines. Do not replace them.

### Input streams

- `PatternClaim` + `PatternClaimEvidence`
- `ContradictionNode` + contradiction evidence
- `Timeline` aggregation signals
- `QuickCheckIn` + `JournalEntry` + Explore artifacts
- action/experiment outcomes
- fieldwork observations
- user corrections

### Engine stages

1. Evidence packet assembly
2. Candidate synthesis
3. Objectivity/safety gate pass
4. Delta computation vs prior model state
5. Persistence to core new objects
6. `ModelUpdate` emission (user-facing vs internal-only classification)
7. Cross-link routing to existing surfaces

## 5.2 Trigger strategy

- pattern lifecycle changes
- contradiction emergence/resolution
- action outcome submissions
- fieldwork completion
- correction submissions
- scheduled synthesis runs (bounded cadence)

## 5.3 Dark-run requirement before UI exposure

- run synthesis and object writes in shadow mode first
- validate output quality with no user-facing display
- only then enable Today/User Map/Investigation exposure

## 5.4 Likely engine files affected during implementation

- `lib/derivation-layer.ts`
- `lib/native-derivation-trigger.ts`
- `lib/pattern-claim-lifecycle.ts`
- `lib/contradiction-transitions.ts`
- `lib/actions-v1.ts`
- `lib/actions-api.ts`
- `lib/timeline-aggregation.ts`
- new engine modules under `lib/` for synthesis/routing/gates

## 6. Objectivity / Safety Implementation Plan

## 6.1 Required safeguards

Implement objectivity gates and language guards before user-facing rollout.

### Minimum gates

- evidence sufficiency gate
- source diversity gate
- time spread gate
- contradiction-aware gating
- correction-aware confidence reduction
- overclaim caps
- investigation resolution gate (multi-theory + evidence + fieldwork/experiment requirement)

### Language/safety constraints

- no diagnostic or clinical assertions
- no absolute identity claims
- receivable language only
- no raw agent trace surfacing

## 6.2 Explore-mode specific safety

- Vent mode: strongest guard, no stable conclusion writes
- Make sense mode: candidate signals only until gated
- Decide mode: actions/experiments recorded, conclusions still gated

## 6.3 Safety verification hooks

- preserve and expand trust-language checks
- preserve legacy surface checks
- phase gates block rollout on safety regressions

## 6.4 Likely safety files affected during implementation

- `lib/__tests__/trust-language.test.ts`
- `scripts/check-trust-language.sh`
- `scripts/check-legacy-surfaces.sh`
- new objectivity gate tests under `lib/__tests__/`

## 7. Web UI Execution Plan

## 7.1 Web rollout intent

Enhance existing product flow without replacing primary habits.

## 7.2 Route and surface plan

### New routes

- `/user-map`
- `/user-map/[id]`
- `/investigations`
- `/investigations/[id]`

### Existing routes to enhance

- `/` (Today): model updates, active investigations, fieldwork, suggested actions
- `/timeline`: model/investigation/fieldwork/action outcome layers + filters
- `/check-ins`: active fieldwork prompt + quick completion path
- `/actions`: action vs experiment segmentation + tested moves context
- `/patterns` and `/contradictions`: outbound links to User Map and Investigations
- `/library` and evidence surfaces: receipt linking for conclusions/investigations/updates
- `/explore`: mode UX (Vent / Make sense / Decide) + safe persistence behavior

## 7.3 Likely web files affected during implementation

- `app/(root)/page.tsx`
- `app/(root)/(routes)/timeline/**`
- `app/(root)/(routes)/check-ins/**`
- `app/(root)/(routes)/actions/**`
- `app/(root)/(routes)/patterns/**`
- `app/(root)/(routes)/contradictions/**`
- `app/(root)/(routes)/library/**`
- `app/(root)/(routes)/explore/page.tsx`
- new route trees: `app/(root)/(routes)/user-map/**`, `app/(root)/(routes)/investigations/**`
- navigation and registry files: `lib/legacy-surface-registry.ts`, route nav components/tests

## 7.4 UI rollout rules

- ship behind feature flags where needed
- progressive disclosure (hide empty new surfaces)
- no visual overbuild before data quality stabilizes

## 8. Mobile Execution Plan

## 8.1 Mobile principles

- backend-driven intelligence only
- no local synthesis
- additive parity with web architecture, not a separate logic branch

## 8.2 Mobile scope sequence

### Mobile v1 must include

- Today intelligence cards (What changed, active question, fieldwork, suggested action)
- User Map list/detail
- Investigations list/detail
- timeline model/investigation/fieldwork/action layers
- check-in fieldwork capture
- receipts deep-link access

### Can follow immediately after v1 stability

- richer visualization of User Map relationships
- deeper investigation editing workflows

## 8.3 Likely mobile files/repos affected during implementation

Mobile repo from Step 2A audit: `/Users/user/Mindlabs-app`

Likely locations:

- `src/lib/backend-chat-api.ts`
- `src/lib/mobile-actions.ts`
- `src/lib/mobile-contradictions.ts`
- `src/lib/mobile-receipts.ts`
- `src/components/mindlab/**`
- timeline/detail screens currently using synthetic fallback data (to be replaced with backend-derived detail)

## 8.4 Mobile rollout dependency

- mobile execution starts only after backend API contracts are stable and web surfaces validate behavior

## 9. Build Phases

## Phase 0 — Execution Contract Lock

### Goal

Lock schema/API/UI contracts and rollout guardrails before any coding.

### Files likely affected

- `docs/step3-execution-map.md`
- follow-on implementation specs/docs

### Schema/API work

- finalize object field contracts
- finalize endpoint contract list and additive response extensions

### UI work

- finalize route map and cross-link behavior contracts

### Tests

- none executed; this is spec lock

### Validation criteria

- all core objects and endpoints have confirmed contracts
- no unresolved route ownership ambiguity

### Dependencies

- Step 2A/2B/2C complete (already met)

### Risks

- ambiguous contracts causing rework in Phase 1/2

## Phase 1 — Foundation Data + Additive APIs (Dark)

### Goal

Add persisted architecture objects and base CRUD/list APIs with no user-facing behavior changes.

### Files likely affected

- `prisma/schema.prisma`
- migration files under `prisma/migrations/**`
- `app/api/user-map/**`
- `app/api/investigations/**`
- `app/api/model-updates/**`
- `app/api/fieldwork/**`
- supporting `lib/*` validation/types modules

### Schema/API work

- create `UserMapConclusion`, `Investigation`, `ModelUpdate`, `FieldworkAssignment`
- extend action outcome contract (`/api/actions/[id]/outcome`)
- additive response contracts for existing APIs

### UI work

- none user-facing yet

### Tests

- schema/route integration tests for new endpoints
- no regression to existing endpoint behavior

### Validation criteria

- CRUD/list endpoints stable
- existing endpoints unchanged
- no migration data loss

### Dependencies

- Phase 0 contract lock

### Risks

- contract drift between object storage and intended UI behavior

## Phase 2 — Engine Connection + Safety Gates (Dark)

### Goal

Connect existing evidence systems into understanding synthesis and model update emission, with objectivity/safety gates enforced.

### Files likely affected

- `lib/derivation-layer.ts`
- `lib/native-derivation-trigger.ts`
- `lib/pattern-claim-lifecycle.ts`
- `lib/contradiction-transitions.ts`
- `lib/actions-v1.ts`
- new `lib/understanding-*` modules
- new/updated tests in `lib/__tests__/`

### Schema/API work

- persist outputs into new objects
- emit model update events from engine deltas

### UI work

- none exposed yet (dark-run)

### Tests

- gate logic unit tests
- evidence routing integration tests
- model update emission tests
- trust-language and legacy checks

### Validation criteria

- output quality passes gate thresholds
- no clinical/overclaim language
- no regression in existing pattern/contradiction pipelines

### Dependencies

- Phase 1 objects and endpoints

### Risks

- over-triggering updates
- low-quality candidate conclusions without adequate gating

## Phase 3 — Web Core Intelligence Surfaces (Beta)

### Goal

Expose User Map + Investigations and integrate Today/Timeline/Check-ins intelligence blocks in beta.

### Files likely affected

- new routes: `app/(root)/(routes)/user-map/**`, `app/(root)/(routes)/investigations/**`
- `app/(root)/page.tsx`
- `app/(root)/(routes)/timeline/**`
- `app/(root)/(routes)/check-ins/**`
- navigation/registry tests and components

### Schema/API work

- consume Phase 1/2 APIs
- add pagination/filter params where needed

### UI work

- Today: What changed + active investigations + fieldwork + suggested action slots
- User Map list/detail with evidence drawer and correction action
- Investigations list/detail with competing theories/evidence-needed model
- Timeline event layers for model updates + investigation milestones + fieldwork
- Check-ins fieldwork prompt insertion

### Tests

- UI contract tests for empty/loading/error/data states
- timeline layer filtering tests
- correction flow tests
- API integration tests for linked detail fetching

### Validation criteria

- new surfaces visible only when data exists
- existing surfaces remain functional and discoverable
- no clutter regressions on Today

### Dependencies

- Phase 2 dark-run quality signoff

### Risks

- user confusion if progressive disclosure is not enforced
- timeline clutter if event grouping is weak

## Phase 4 — Actions/Experiments + Explore Mode Integration

### Goal

Wire action/experiment feedback loops and Explore mode persistence policies into the new intelligence graph.

### Files likely affected

- `app/(root)/(routes)/actions/**`
- `app/(root)/(routes)/explore/page.tsx`
- `lib/actions-v1.ts`
- `lib/actions-api.ts`
- related API routes for action outcomes

### Schema/API work

- finalize action/experiment fields and outcome capture contracts
- ensure outcomes route into investigations/model updates/usermap deltas

### UI work

- segmented Actions UI: Try this / Test this / What worked
- experiment detail and outcome capture with condition tracking
- Explore modes: Vent / Make sense / Decide with safety-aware write policies

### Tests

- outcome loop integrity tests
- mode safety tests (vent mode no stable conclusions)
- action condition aggregation tests

### Validation criteria

- repeated outcomes change strategy recommendations correctly
- mode constraints respected
- no therapy/diagnostic drift in language

### Dependencies

- Phase 3 surfaces live in beta

### Risks

- conflating action vs fieldwork semantics
- accidental persistence from vent mode

## Phase 5 — Library/Receipt Deep Linking + Cross-Surface Continuity

### Goal

Ensure evidence provenance is inspectable everywhere and corrections propagate across surfaces.

### Files likely affected

- `app/(root)/(routes)/library/**`
- `app/(root)/(routes)/evidence/**`
- `/api/evidence*` and library aggregation logic
- route components linking receipts across user map/investigations/model updates

### Schema/API work

- additive linkage fields for receipt provenance
- correction history exposure where needed

### UI work

- receipt drawers from User Map/Investigation/Model Update cards
- reverse traversal (source -> influenced conclusions/updates)

### Tests

- evidence-link integrity tests
- correction propagation tests
- receipt navigation tests

### Validation criteria

- every displayed conclusion/update has inspectable evidence links
- receipt deep links resolve correctly

### Dependencies

- Phase 3 and Phase 4 data flow

### Risks

- broken provenance links across object boundaries

## Phase 6 — Mobile Parity Rollout

### Goal

Deliver backend-derived mobile parity for new intelligence surfaces.

### Files likely affected

- mobile repo `/Users/user/Mindlabs-app`:
- `src/lib/backend-chat-api.ts`
- `src/lib/mobile-actions.ts`
- `src/lib/mobile-contradictions.ts`
- `src/lib/mobile-receipts.ts`
- `src/components/mindlab/**`

### Schema/API work

- consume finalized backend contracts from Phases 1–5

### UI work

- Today intelligence cards
- User Map list/detail
- Investigations list/detail
- timeline intelligence layers
- check-in fieldwork capture
- receipts links

### Tests

- mobile API contract tests
- parity behavior checks vs web outputs
- removal of synthetic/mobile-only intelligence artifacts

### Validation criteria

- no local intelligence computations
- parity flows available for core surfaces
- performance acceptable for list/detail routes

### Dependencies

- backend/API stability from Phases 1–5

### Risks

- mobile lagging due API contract churn
- residual synthetic fallback behavior

## Phase 7 — Advanced Intelligence (Internal-First)

### Goal

Add optional advanced intelligence layers after core system stability.

### Files likely affected

- new `lib/*` modules for causal chains/maturity/meta-observer
- internal/admin visibility surfaces if needed

### Schema/API work

- `GenerativeSelfModelEntry`, `ModelMaturitySignal`, `MetaObserverFinding` if promoted

### UI work

- minimal user-facing exposure first (if any)
- internal observability first

### Tests

- advanced model calibration tests
- false-positive/false-confidence guard tests

### Validation criteria

- advanced outputs improve accuracy and do not reduce trust

### Dependencies

- Phases 1–6 stable in production

### Risks

- complexity growth outpacing reliability gains

## 10. Test Plan

## 10.1 Required verification commands

Run these as core verification gates throughout implementation:

- `npx tsc --noEmit`
- `npx vitest run`
- `npm run build`
- `bash scripts/check-trust-language.sh`
- `bash scripts/check-legacy-surfaces.sh`

## 10.2 Test layers by concern

| Concern | Test Type | Phase Gate |
|---|---|---|
| Schema integrity and migrations | migration + integration tests | Phase 1 |
| API correctness and compatibility | route integration tests | Phases 1–6 |
| Evidence routing | integration tests with real-shaped data | Phases 2–5 |
| Objectivity gates | unit + integration tests | Phase 2 onward |
| Trust language compliance | script + content tests | Phase 2 onward |
| Legacy surface preservation | script + route behavior tests | Every phase |
| UI states and continuity | component/integration tests | Phases 3–6 |
| Mobile parity contract | API client + screen tests | Phase 6 |

## 10.3 Regression policy

- Every phase must pass full verification command bundle before merge.
- Any failure in trust-language or legacy-surface checks blocks rollout.

## 11. Validation Criteria

## 11.1 Core quality thresholds

- 100% of displayed User Map conclusions have linked evidence provenance.
- >=80% user-marked conclusion accuracy over initial evaluation window.
- >=50% active investigations reaching resolution in 30 days.
- >=40% fieldwork completion for assigned prompts.
- >=90% objectivity-gate precision for rejected unsafe/overclaim outputs.

## 11.2 Product behavior thresholds

- Today surface remains scan-first (no card overload, meaningful prioritization).
- Patterns/Tensions/Timeline/Actions remain directly usable and not displaced.
- Model updates shown only when meaningful deltas exist.

## 11.3 Platform thresholds

- web and mobile consume same backend-derived intelligence contracts
- no mobile-side synthetic intelligence state after parity phase

## 12. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| New models start empty | weak early experience | seed from existing patterns/tensions/timeline/action history |
| Endpoint contract churn | web/mobile rework | lock contracts in Phase 0 and enforce additive-only changes |
| Overclaiming from early synthesis | trust damage | strict objectivity gates + language guard + dark-run signoff |
| Today surface overload | reduced usability | hard card priority and visibility rules from Step 2C |
| Investigation quality drift | noisy active threads | evidence-needed discipline + resolution gate criteria |
| Action vs fieldwork confusion | low completion quality | explicit semantic distinction in API/UI/tests |
| Legacy surface regressions | product instability | required `check-legacy-surfaces` gate every phase |
| Mobile synthetic fallback persists | parity inconsistency | explicit removal checklist in Phase 6 |
| Performance degradation | UX regressions | bounded synthesis cadence + pagination + selective loading |

## 13. Implementation Prompt Sequence

These are the recommended Step 3 execution prompts, in order.

1. **Schema Prompt (Phase 1A)**
- Define/add new Prisma models and enums for core architecture objects.
- Include migration plan and rollback strategy.

2. **Core API Prompt (Phase 1B)**
- Implement additive CRUD/list endpoints for User Map, Investigations, Model Updates, Fieldwork.
- Add action outcome endpoint extension.

3. **Compatibility Prompt (Phase 1C)**
- Add additive link fields to existing patterns/contradiction/timeline/check-ins/library responses.
- Preserve existing response contracts.

4. **Engine Packet Prompt (Phase 2A)**
- Build evidence packet assembly from existing systems.
- Add tests for routing completeness.

5. **Synthesis + Delta Prompt (Phase 2B)**
- Implement conservative synthesis + delta persistence + model update emission.
- Keep dark-run mode.

6. **Objectivity/Safety Prompt (Phase 2C)**
- Implement gates + language guard integration.
- Add enforcement tests and gate metrics.

7. **Web User Map Prompt (Phase 3A)**
- Build `/user-map` list/detail with correction and evidence drawer.

8. **Web Investigations Prompt (Phase 3B)**
- Build `/investigations` list/detail with competing theories and evidence-needed structure.

9. **Today/Timeline/Check-ins Prompt (Phase 3C)**
- Integrate model update, investigation, and fieldwork blocks with anti-clutter rules.

10. **Actions/Experiments + Explore Prompt (Phase 4)**
- Implement segmented action UX and mode-safe Explore behavior.

11. **Library/Receipts Continuity Prompt (Phase 5)**
- Wire evidence deep-links and correction propagation across surfaces.

12. **Mobile Parity Prompt (Phase 6)**
- Update mobile client/screens for backend-derived parity surfaces.

13. **Advanced Intelligence Prompt (Phase 7, optional after stability)**
- Implement internal-first advanced layers (causal model/maturity/meta-observer).

### Prompt acceptance checklist (applies to each prompt)

- feature is additive
- existing surfaces still intact
- tests added/updated
- verification command bundle passes
- rollout dependencies explicitly acknowledged

## 14. Final Handoff Summary

The Step 3 execution path is:

1. lock contracts
2. build persisted core intelligence objects + additive APIs
3. connect engine with safety gates in dark-run
4. expose web surfaces progressively without displacing existing ones
5. complete actions/explore/receipts continuity loops
6. roll out mobile parity from the same backend contracts
7. add advanced intelligence only after core stability

This plan preserves all existing product surfaces and upgrades them into a connected understanding system. It defines a safe implementation order, explicit dependencies, and objective test/validation gates required before each rollout stage.
