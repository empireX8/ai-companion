# 01 — CEQR-017 live failure baseline

Historical CEQR-017 live proof exposed two defects under schema-v2:

## 1. Semantic inconsistency

Provider returned `classification: clear_contradiction` together with
`changedBeliefOverTime: true`. Deterministic validation rejected the pair, but
the transport schema itself still allowed the combination.

## 2. Lexical truncation

Compatible case Side B offsets `0–27` on
`"I drink coffee in the morning."` produced the authoritative slice
`"I drink coffee in the morni"`.

## Historical integrity

CEQR-017 remains historical. Exact canonical hashes that must stay unchanged:

- live-execution-receipt.json SHA-256:
  `b620aa7f718d4ace768a9a518a4d8cb32ca1b54662291280b3f6545fb5514fdd`
- phase2-live-run-claim.json SHA-256:
  `f313cbafb264f84d158a8aee20ca2276520fbf85940be7f910b87bead2c5cef0`
