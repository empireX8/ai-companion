# 04 — Persistence-plan contract

**Module:** `lib/contradiction-persistence-plan.ts`
**Version:** `contradiction-persistence-plan-v1` (inspectable metadata only)
**Authorisation credential:** module-private `WeakSet<object>` of deep-frozen minted plans

## Entry

`buildContradictionPersistencePlan({ selectedPair, lineageResult, confidenceResult })`

## Success semantics

- `ok: true`
- `persistenceAuthorised: true` (**plan-level only**; WeakSet membership is the credential)
- `writeExecuted: false`
- Plan is deep-frozen and registered in the module-private WeakSet
- Upstream selected-pair / CEQR-005 / CEQR-006 non-persistence flags remain `false`
- Propositions / title / type are derived internally — never caller-supplied

An authorised plan is an **internal in-memory capability**, not a serialized transport contract.

## Distinctions

| Concept | Meaning |
| ------- | ------- |
| Upstream continuation readiness | CEQR-005/006 `continuationReady` |
| Persistence-plan authorisation | WeakSet membership after binding gate |
| Transaction execution | Writer `$transaction` |
| Completed candidate creation | Writer `writeExecuted: true` |

Do **not** call a plan “persisted.”

## Required selected-pair checks

- `semanticallySelected === true`
- `persistable === false` / `persistenceAuthorised === false`
- adjudication `semantic_accepted` + valid deterministic validation
- validated semantic `clear_contradiction`
- `persistenceDecision === null`
- `createCandidate` remains undefined
- referee completed / continuation-allowed / empty validation errors / PASS or PASS_WITH_LOWER_CONFIDENCE

## Required binding checks

Selected-pair sides + evidence claims must match CEQR-005 lineage sides + descriptors (source/session/message/quote/offsets). Referee outcomes must agree across selected pair, lineage, and CEQR-006.

## Required confidence checks

- confidence `ok`
- `meetsCandidateFloor`
- `continuationReady`
- supported policy version
- finite effective confidence in `[0,1]`
- valid recommended storage confidence

Below-floor CEQR-006 evaluations **must not** authorise a plan.

## Derived fields

- propositions ← adjudication normalized propositions
- title ← deterministic `A ↔ B` display label (bounded; not eligibility)
- type ← Side A `sourceType` goal/constraint mapping after clear-contradiction eligibility
- `persistedSourceSessionId` ← shared session
- `persistedSourceMessageId` ← `null`
- `sideBTriggerMessageId` ← inspectable metadata only

## Failure

Discriminated `{ ok:false, code, message, persistenceAuthorised:false, writeExecuted:false, plan:null }` — fail closed.
