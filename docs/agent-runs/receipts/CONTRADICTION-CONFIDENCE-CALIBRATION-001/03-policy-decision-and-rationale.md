# 03 — Policy decision and rationale

**Slice:** CONTRADICTION-CONFIDENCE-CALIBRATION-001 / CEQR-006
**Policy version:** `contradiction-confidence-policy-v1`
**Authoritative location:** `lib/contradiction-confidence-calibration.ts`

## Controlling-contract finding

**No controlling numeric threshold or band contract existed before this slice.**

Stated explicitly: CEQR-006 invents the smallest conservative versioned engineering policy, not an empirical calibration.

## What this policy is

- An engineering consistency policy for repaired contradiction proposals
- Deterministic mapping from validated numeric/referee signals → storage-band recommendation + candidate-floor flag
- Independently versioned from kernel / prompt / schema / referee interface versions

## What this policy is not

- Not empirical / statistical calibration
- Not observed model accuracy
- Not a Bayesian posterior
- Not scientific calibration
- Not a verified truth probability
- Model-reported confidence is **not** a probability estimate

## Policy sources (allowed)

1. Valid model-reported confidence
2. Valid semantic adjudication (`semantic_accepted`)
3. Valid deterministic adjudication validation
4. Validated referee execution state (`completed`)
5. Validated referee outcome
6. Authorised adjusted referee confidence (required or optional lowering)
7. Deterministic numeric band / floor mapping

## Forbidden sources

ContradictionType, marker family, rhetorical phrases, token overlap, textual similarity, ReferenceItem type, goal-versus-behaviour category, constraint-conflict category, candidate volume, legacy hard-coded low/medium/high labels.

## Rationale for chosen thresholds

See `04-confidence-band-and-candidate-floor-contract.md`.

Briefly:

- Align storage recommendation with existing `ReferenceConfidence` enum without importing Prisma
- Conservative high band (≥ 0.80) — PASS must not silently mean “high”
- Medium band starts at 0.50 — matches qualitative “medium” target language without inventing volume-preserving floors
- Candidate floor = 0.50 — same midpoint; zero qualifying candidates is acceptable
- Below-floor scores remain **successful evaluations** (`ok: true`) with `meetsCandidateFloor: false` and `continuationReady: false` (inspectable; not fail-closed)
- Validated referee gate evidence (`refereeValidationErrors`, `refereeContinuationAllowed`) is **mandatory** — never inferred from PASS
- One authoritative public entry point: `calibrateContradictionConfidence` (band mapper is internal)

## Persistence posture

- `persistable: false`
- `persistenceAuthorised: false`
- `createCandidate: undefined`
- `persistenceDecision: null`

A storage-band recommendation does **not** authorise persistence.
A referee continuation outcome does **not** authorise persistence.
