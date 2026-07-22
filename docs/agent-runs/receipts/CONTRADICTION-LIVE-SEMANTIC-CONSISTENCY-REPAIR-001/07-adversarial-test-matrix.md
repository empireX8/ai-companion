# 07 — Adversarial test matrix

File: `lib/__tests__/contradiction-live-semantic-consistency-repair.test.ts`

| # | Requirement | Result |
|---|-------------|--------|
| 1 | clear + changedBeliefOverTime fails transport | PASS |
| 2 | clear + each other compatibility flag fails | PASS |
| 3 | clear + all flags false passes transport | PASS |
| 4 | valid compatible_states passes | PASS |
| 5 | valid plausible_unresolved_tension passes | PASS |
| 6 | valid insufficient_or_misaligned_context passes | PASS |
| 7 | classification null + blank/null/whitespace abstention fails; nonblank passes; emitted abstention pattern `\\S` | PASS |
| 8 | classified + affirmative abstentionReason fails | PASS |
| 9 | deterministic validator rejects inconsistent domain object | PASS |
| 10 | raw output deep-equal before/after | PASS |
| 11 | sourceId/exactQuote absent from transport authority | PASS |
| 12 | forged sourceId/exactQuote non-authoritative | PASS |
| 13 | end inside “morning” fails lexical boundary | PASS |
| 14 | start inside a word fails lexical boundary | PASS |
| 15 | whole-word / punctuation / source-edge pass | PASS |
| 16 | Unicode BMP (café / Japanese / numeric) covered | PASS |
| 16b | astral mid-word / surrogate-pair / whole astral word | PASS |
| 16c | combining-mark base/mark, mark-sequence, full NFD word | PASS |
| 17 | compatible case produces no candidate (adjudication path) | PASS |
| 18 | CEQR-017 truncated Side-B span (0–27) blocked via `runControlledContradictionNaturalEntryProof`: selection stop, writerInvoked/writeExecuted false, persistenceResult null, refereeCallCount 0, all persistence mutation counters 0 | PASS |
| 19 | CEQR-016 deterministic authority tests green | PASS (separate file) |
| 20 | CEQR-017 live-execution-receipt + phase2-live-run-claim exact SHA-256; `expectedRuntimeIdentities.schemaVersion === contradiction-adjudication-schema-v2` | PASS |
