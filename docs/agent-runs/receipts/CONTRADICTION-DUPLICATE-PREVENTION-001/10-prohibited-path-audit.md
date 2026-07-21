# 10 — Prohibited-path audit

## Must not modify / wire

- `app/` routes
- providers
- import execution
- legacy contradiction materialiser / detection
- reference / Explore / Map / Today / Timeline UI
- production feature flags
- existing contradiction rows (account data)
- `ContradictionEvidence` / `ModelUpdate` writes

## Scan

Confirm no imports of:

- `contradiction-repaired-persistence`
- `persistRepairedContradictionCandidate`
- `contradiction-persistence-plan`
- `buildContradictionPersistencePlan`

under `app/`, `lib/orvek-v0/`, `lib/understanding-dark-engine/`.

## Live wiring status after this slice

**Not implemented.** No production caller invokes the repaired writer.
