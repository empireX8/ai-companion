# 06 — Persistence authority boundary

Authority remains the module-private WeakSet in `buildContradictionPersistencePlan`.

CEQR-010 keeps the authorised plan as a **local variable** and passes it immediately to `persistRepairedContradictionCandidate` inside one orchestration invocation.

- No `executePersistence` flag
- No `authorisedPlanForHarness` (or any plan) field on the result
- Callers cannot obtain the real minted WeakSet member from CEQR-010
- Forged / cloned / serialized lookalikes still fail the landed writer

Exact ordered duplicate **reuse** inside a later authorised orchestration remains valid.
The security claim is capability non-egress, not one-use of the plan object.
