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

## 16. Final Recommendation

- Do not implement ModelUpdates or PatternClaim mutation next.
- If implementation resumes, start with debug-only ranking diagnostics surfacing or feature-flagged ranking simulation.
- Keep all model-belief changes deferred until evidence thresholds, reversibility, conflict handling, and lifecycle policy are implemented.
