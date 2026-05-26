# Future Policy Phase - Action Feedback, Ranking, ModelUpdate, and Pattern Mutation Design Contract

**Status:** CONTRACT CREATED / READY FOR REVIEW
**Date:** 2026-05-25
**Scope:** Policy architecture only. No app code changes. No schema changes. No route/API changes. No mobile changes.

---

## Core Principle

Do not let thin feedback become model belief.

---

## 1. Executive Decision

- This contract defines a **future policy phase**.
- The current safe loop is complete: Phase 4 and Phase 6 are `CLOSED / VALIDATED`.
- Delivered safe loop scope is retained as baseline: backend-derived Actions, status updates + notes, action feedback aggregation helper, ranking diagnostics helper, Reflect in Explore on web/mobile, user-triggered Turn into Experiment on web/mobile, Fieldwork/Watch For bridge, and linked-target ownership hardening.
- Remaining decisions are about **model behavior policy**, not UI/backend parity.
- Current system intentionally does **not** do live ranking changes, ModelUpdate creation from action/Fieldwork feedback, or PatternClaim mutation from action/Fieldwork feedback.
- No model mutation should be implemented until policy thresholds, reversibility, evidence standards, and user-facing explanation rules are explicitly defined and accepted.

## 2. Conceptual Separation

| Concept | Definition | Policy stance |
|---|---|---|
| Action | Lightweight recommendation. | Recommendation signal, not belief update. |
| Action feedback | User response to recommendation (`helped`, `didnt_help`, `done`, note). | Feedback signal, not model truth. |
| Fieldwork | Structured observation task with explicit outcome/observation. | Stronger than status click, still not an automatic conclusion. |
| Explore reflection | User-authored interpretive context. | Meaning-making input, not automatic mutation trigger. |
| ModelUpdate | Durable system-recognized change. | Requires policy-grade evidence; must be cautious and traceable. |
| PatternClaim | Evidence-backed recurring behavioral claim. | Must not be directly mutated by thin intervention feedback. |
| Ranking diagnostic | Internal template-signal indicator. | Internal signal only; not user-facing truth claim. |

Hard separation rules:
- These concepts must not collapse into each other.
- A user marking an action `helped` is not proving a pattern.
- A failed action is not disproving a pattern.
- A completed Fieldwork observation is stronger than a status click, but still not automatically a model conclusion.

## 3. Evidence Hierarchy

### Weak signals
- One action marked `helped` or `didnt_help`
- One action marked `done`
- One short note

### Medium signals
- Repeated action outcomes for the same template/family
- Repeated action outcomes across contexts
- Completed Fieldwork with observation outcome
- Explore reflection explicitly discussing the action

### Strong signals
- Repeated feedback + completed Fieldwork + Explore reflection
- Cross-source consistency with existing PatternClaim evidence
- Repeated contradiction/reference/profile alignment

Policy rules:
- Single action feedback must never create ModelUpdates or mutate PatternClaims.
- Stronger feedback can create **candidate signals**, not automatic conclusions.

## 4. Live Action Ranking Policy

Allowed eventually:
- Promote templates with repeated `helped` signals.
- Suppress templates with repeated `didnt_help` signals.
- Keep low-signal templates neutral.
- Use ranking diagnostics as internal input only.

Required gates before live ranking:
- Threshold gate: at least 3 repeated `helped`/`didnt_help` signals.
- Recency gate: explicit rolling window policy must be defined.
- Grouping gate: explicit template-level vs family-level grouping choice.
- Conflict gate: explicit mixed-signal behavior.
- Reversibility gate: signals can be undone/decayed over time.
- Explanation gate: safe user-facing explanation policy (if surfaced).

Recommended initial policy:
- `helped >= 3` and `didnt_help < 3` => promote candidate.
- `didnt_help >= 3` and `helped < 3` => suppress candidate.
- `helped >= 3` and `didnt_help >= 3` => conflict/neutral.
- Below threshold => neutral.

Additional constraints:
- Ranking changes should be invisible or softly reflected at first.
- Do not tell users "the model learned this" from ranking changes.
- Ranking should remain reversible as new feedback arrives.

## 5. ModelUpdate Creation Policy

Prohibited:
- ModelUpdate on every action status update.
- ModelUpdate from a single `helped`/`didnt_help` click.
- ModelUpdate from a raw note alone.
- ModelUpdate that quotes raw private notes.
- ModelUpdate text that overclaims causality.

Allow only when one or more of the following are true and consistency checks pass:
- Feedback is repeated.
- Fieldwork is completed with outcome.
- Explore reflection explicitly describes the lesson.
- Signal is consistent with existing safe evidence.

Candidate update types for future policy phase:
- `action_strategy_adjusted`
- `experiment_feedback_recorded`
- `coping_strategy_signal`
- `action_template_preference_signal`

User-facing summary rules:
- Generic, cautious, non-clinical.
- No raw note text.
- No raw evidence text.
- No "the model knows" language.
- No certainty claims.

Safe summary examples:
- "A repeated action-feedback signal was recorded for this strategy."
- "This kind of action has been marked helpful several times."
- "This experiment produced feedback that may affect future suggestions."

Bad summary examples:
- "You have overcome this pattern."
- "This proves this strategy works."
- "The model learned that you should do X."
- "Your notes show that..."

## 6. PatternClaim Mutation Policy

Strong default for next implementation slice:
- Do not mutate PatternClaim strength/status from action or Fieldwork feedback.

Why:
- PatternClaims are recurrence claims backed by evidence.
- Action outcomes are intervention outcomes, not direct pattern evidence.
- A strategy helping does not prove pattern change.
- A strategy failing does not disprove pattern validity.

Possible future safe path:
- Action/Fieldwork feedback may become supporting context.
- PatternClaim mutation requires independent evidence from journal/chat/check-ins/imported signals.
- PatternClaim mutation should require a separate review or derivation pass.

Allowed future influence:
- Intervention-effectiveness metadata linked to a pattern.
- Not direct pattern-strength mutation.

## 7. Fieldwork Outcome Policy

Policy:
- Fieldwork is stronger than action status feedback because it requires observation.
- Fieldwork completion may create a feedback signal.
- Fieldwork completion should not automatically create a ModelUpdate.
- Fieldwork observation notes are raw user-authored text and private by default.
- Observation outcomes may be summarized only via safe summarization rules.

Future possible outcomes:
- Completed Fieldwork contributes to action template diagnostics.
- Completed Fieldwork may qualify for a ModelUpdate candidate if repeated or explicitly reflective.
- Completed Fieldwork may appear as source-continuity evidence, not raw quote evidence.

## 8. Explore Reflection Policy

Policy:
- Explore is the preferred surface for meaning-making.
- Reflect in Explore can turn action feedback into richer user-authored context.
- Explore messages already feed existing derivation hooks.
- Do not inject hidden model conclusions into Explore.
- Do not auto-send action context as user message.
- User must choose what to say.

Future interpretation policy:
- An Explore reflection linked to an action may strengthen feedback interpretation.
- Explicit user statements such as "this helped because..." are stronger than status clicks.
- One reflection should still not automatically mutate PatternClaims.

## 9. Conflict Policy

When signals disagree:
- `helped` and `didnt_help` both repeated => conflict/neutral.
- Action helped but Fieldwork failed => needs review.
- Action failed but Explore says it clarified something => separate usefulness from comfort/success.
- Action `done` with no outcome => weak signal.
- No status but long note => raw note stays private; summarization only in later safe pipeline.

Rule:
- Conflict should reduce confidence, not force a conclusion.

## 10. Reversibility and Lifecycle

Policy:
- Ranking signals must be reversible.
- ModelUpdates should carry lifecycle/status semantics when introduced.
- Suppression should decay over time.
- Old failures should not permanently block templates.
- Future feedback can undo earlier ranking hints.

Recommended mechanics:
- Use rolling windows for repeated-signal thresholds.
- Decay stale signals.
- Keep `neutral` as default/safe fallback.
- If ModelUpdate candidates are introduced later, require explicit candidate -> confirmed -> superseded lifecycle handling.

## 11. Data Model Implications (Future, Not Implemented)

Likely future schema candidates (for later design):
- `ActionFeedbackSignal` table, or
- `ActionTemplateOutcome` aggregate table, or
- `ModelUpdate` linked-source metadata extension, or
- `FieldworkActionLink` read model.

Current stance:
- Existing `SurfacedAction` status/note fields are enough for diagnostics.
- Policy-grade persistence may require explicit structured storage later.
- Do not add schema until the first write-path and lifecycle policy are fully designed.

## 12. API Implications (Future, Not Implemented)

Potential future endpoints:
- `GET /api/actions/feedback-diagnostics`
- `POST /api/actions/[id]/feedback/model-signal`
- `GET /api/actions/ranking-diagnostics`
- `POST /api/fieldwork/[id]/summarize-feedback`

Current stance:
- These are future possibilities, not current implementation requirements.
- No endpoint should be added before policy gates and lifecycle rules are accepted.

## 13. Safety Constraints

Hard constraints:
- No raw evidence exposure.
- No raw action note exposure.
- No raw Fieldwork observation note exposure.
- No ModelUpdate from single click.
- No PatternClaim mutation from action outcome alone.
- No fake action suggestions.
- No fake experiments.
- No automatic conclusions.
- No unreviewed promotion to User Map.
- No hidden model-belief changes without traceability.

## 14. Recommended Implementation Roadmap

- **Policy Phase A:** Design contract only.
- **Policy Phase B:** Expose internal/debug ranking diagnostics only.
- **Policy Phase C:** Add reversible live ranking behind explicit feature flag.
- **Policy Phase D:** Add action/Fieldwork feedback signal storage only if schema is justified.
- **Policy Phase E:** Create ModelUpdate candidates only from repeated + reflective signals.
- **Policy Phase F:** Consider PatternClaim intervention-effectiveness metadata, not mutation.
- **Policy Phase G:** Only later consider PatternClaim mutation with stronger evidence gates.

## 15. Explicit Non-Goals

- No live ranking in this contract.
- No ModelUpdate creation.
- No PatternClaim mutation.
- No schema change.
- No API change.
- No mobile change.
- No raw note/evidence exposure.
- No automatic experiments.
- No "model learned" user-facing claims.

## 16. Current Recommendation

- Policy ranking groundwork is complete through `G1` (diagnostics, simulation, eligibility gating, env+query-gated live simulation, and feedback-signal read model).
- The next safe policy workstream is this ModelUpdate Candidate Policy Contract (`Phase H`) and its review/acceptance cycle.
- Do not implement `ModelUpdate` creation yet.
- Do not mutate `PatternClaim` from action/fieldwork feedback.
- Do not add schema, candidate storage, routes, or API write paths in this phase.
- Do not activate default always-on production live ranking.
- Keep `Phase H` contract-only until reviewed and explicitly closed.

## 17. Policy Phase H - ModelUpdate Candidate Policy Contract

### 17.1 Purpose

- A ModelUpdate candidate is a reviewable proposed change, not a durable model belief.
- A candidate layer must sit between feedback signals and actual `ModelUpdate` creation.
- This layer exists to prevent single-click feedback, weak fieldwork, or one-off reflection from being treated as model learning.
- Candidate outputs are policy objects for review/gating, not user-visible truth claims.

### 17.2 Source Hierarchy

Relative strength order (lowest -> highest):
- Thin action status click (`helped`, `didnt_help`, `done`) is weakest.
- Action status + note is still weak unless repeated and coherent across time.
- Completed `FieldworkAssignment` linked to `surfaced_action` is stronger structured observation.
- Explore reflection linked to action context is interpretive evidence; useful but still user-authored and non-conclusive by itself.
- Repeated cross-source agreement (action + fieldwork + reflection) is strongest for candidate proposal.

Priority rule:
- Existing `PatternClaim` / `UserMapConclusion` evidence remains higher-trust than isolated action-outcome signals.

### 17.3 Candidate Proposal Thresholds

A ModelUpdate candidate may be proposed only when all baseline gates pass:
- repeated `helped`/`didnt_help` signals alone are not sufficient
- require one of:
  - repeated action signal + completed fieldwork
  - repeated action signal + reflective Explore interpretation
  - repeated structured observations across time windows
- require a recency window
- require a minimum repeated count
- require no unresolved conflict strong enough to neutralize
- require meaningful delta versus current model state (avoid no-op restatements)

Default policy baseline for minimums:
- minimum repeated count should start at `>= 3` unless a stricter gate is approved
- recency/staleness handling should stay aligned with current reversible ranking windows until superseded by a stricter candidate policy

### 17.4 Rejection Rules

A candidate must not be created when any of the following holds:
- only one action status exists
- signal is stale
- signal is conflicted
- signal reflects format preference only (for example, wording/tone/template style) rather than user state/pattern change
- feedback is convenience/UI/timing wording feedback rather than behavioral or state change evidence
- evidence source is only recommendation outcome with no corroborating signal
- proposal would directly mutate/overrule a `PatternClaim`
- proposal would expose raw action notes, raw fieldwork notes, or raw evidence text

### 17.5 Candidate Lifecycle (Conceptual States)

Candidate lifecycle states are policy-level only in this phase:
- `proposed`
- `held_for_more_evidence`
- `rejected`
- `promoted_to_model_update`
- `superseded`
- `expired`

This section defines lifecycle semantics only. It does not introduce schema enums or storage changes yet.

### 17.6 Conflict Handling

- Conflict reduces confidence and should increase gate strictness.
- Conflict can hold a candidate (`held_for_more_evidence`) or reject it.
- Conflict should not force a negative conclusion by default.
- Repeated conflicting `helped`/`didnt_help` signals should usually resolve to "needs more evidence", not immediate `ModelUpdate` creation.

### 17.7 Reversibility and Provenance

- Candidates are reversible policy objects.
- Later contradictory signals can downgrade, expire, or supersede prior candidates.
- Promotion to `ModelUpdate` must preserve provenance links instead of erasing earlier interpretation history.
- Reversibility must prefer conservative fallback behavior when evidence quality declines.

### 17.8 User-Facing Language Rules

Allowed cautious wording patterns:
- "This may suggest..."
- "There is early evidence..."
- "This looks worth watching..."
- "This is not enough to conclude..."

Disallowed wording patterns:
- "The model learned..."
- "You are now..."
- "This proves..."
- "This pattern changed..." unless backed by stronger multi-source model evidence
- any language implying thin feedback is durable self-knowledge

### 17.9 Relationship to PatternClaims

- Action/fieldwork feedback cannot directly mutate `PatternClaim` strength or status.
- ModelUpdate candidates may reference related `PatternClaim` IDs as context in future policy work.
- PatternClaim mutation requires a separate future policy phase with stronger evidence and review gates.
- Action usefulness and pattern truth must remain separate concepts.

### 17.10 Relationship to Default Live Ranking

- Default production live ranking activation remains deferred until this candidate policy is validated.
- Ranking may continue to use reversible eligibility-gated signals for ordering behavior.
- Ranking outcomes must not be framed as model truth or durable self-knowledge.

### 17.11 Relationship to Phase 2 Dark Engine

- This section is narrower than Phase 2 Dark Engine scope.
- It governs only the path from action/fieldwork feedback signals to ModelUpdate candidates.
- It does not implement Dark Engine packet assembly, synthesis, or gate execution.
- Phase 2 gates should later absorb or explicitly reference this candidate policy.

### 17.12 Explicit Non-Goals for Phase H Contract Pass

This docs-only pass does not:
- create `ModelUpdate` rows
- create candidate storage
- add schema or enums
- add routes or API handlers
- mutate `PatternClaim` rows
- expose raw notes or raw evidence text
- activate default live ranking
- implement Phase 2 Dark Engine
- implement agents, lenses, or Intelligence Library behavior

### 17.13 Open Questions / Deferred Decisions

The following policy decisions are intentionally deferred and must not trigger implementation yet:
- Exact rule for what qualifies as a linked Explore reflection is not yet canonical.
- "Meaningful delta" is directionally defined but not yet numerically gated.
- Boundary between `held_for_more_evidence` and `rejected` is not yet quantified.
- Promotion governance is implied, but reviewer/approval workflow is not yet formalized.
