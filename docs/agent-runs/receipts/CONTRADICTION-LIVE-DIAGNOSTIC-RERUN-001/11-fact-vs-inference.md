# 11 — Fact versus inference

## FACT (directly recorded)

1. Exactly one live opt-in proof invocation ran in this slice.
2. Provider `openai`; models `gpt-4o-mini` / `gpt-4o-mini`.
3. Prompt addendum version remained `contradiction-live-adjudicator-prompt-addendum-v1`.
4. `maxRetries=0`, `timeoutMs=45000`, `maxTotalCalls=8`.
5. Attempts: adjudicator 3, referee 0, total 3.
6. All three cases: `gateStoppedAt=selection`, earliestGate=`deterministic_validation`.
7. Clear case codes: `fabricated_quote`, `clear_contradiction_requires_valid_spans`, `validation_failed`.
8. Compatible case codes: `fabricated_quote`, `validation_failed`.
9. Ambiguous case codes: `source_id_mismatch`, `validation_failed`.
10. `evidenceFailureSide=unknown` for all three (no invented Side A/B).
11. Quote/offset match flags remained `null` because side was unlabelled.
12. No writer invocation; no harness write; no real-account aggregate change.
13. `evidenceOutputMutated=false`; runtime prompt not changed in this slice.
14. Production ingestion remains unwired; `productionReady=false`.

## INFERENCE (not directly established)

1. The model likely emitted non-exact quotes and/or wrong sourceIds relative to
   the synthetic source units — inferred from validation codes, not from retained
   raw provider objects.
2. A future prompt clarification *might* reduce fabricated-quote / source-id
   failures — not proven by this single run; requires a later bounded repair
   slice with evidence.
3. Provider incapability is **not** established from one run.
4. Transport/schema incompatibility is **not** established: validation ran after
   structured output reached the deterministic validator.
5. Side-specific which-claim failed cannot be inferred when the validator
   message does not label Side A/B (CEQR-012 honesty rule).
