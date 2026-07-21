# 07 — Non-persistence boundary

**Slice:** CONTRADICTION-CONFIDENCE-CALIBRATION-001 / CEQR-006

## Module guarantees

`lib/contradiction-confidence-calibration.ts`:

- pure / deterministic / versioned
- provider-agnostic
- free of Prisma imports
- free of database access
- free of network calls
- free of UI concerns
- free of route wiring
- non-persisting
- one authoritative public entry point (`calibrateContradictionConfidence`)
- band mapper is internal (not exported)

Every result includes:

- `persistable: false`
- `persistenceAuthorised: false`
- `createCandidate: undefined`
- `persistenceDecision: null`

Successful evaluations may still set `continuationReady: false` when below the candidate floor.

## Proven absences (source + tests)

The module does **not**:

- import Prisma
- call materialisation
- ensure EvidenceSpans
- create or update ContradictionNodes
- mutate the existing 25 legacy nodes
- authorise candidate creation
- perform database writes

## Account / DB posture

- Read-only account gate before (`ceqr-006-before`) and after (`ceqr-006-after`)
- Expected Kay import pending counts unchanged (28 RI + 25 CN = 53)
- Chicken-burger ReferenceItem remains active
- PatternClaims / ModelUpdates / UnderstandingEvidenceLinks unchanged
- `mutationsPerformed: false`

## Production readiness

**NO** — persistence remains blocked; no live candidate may be created in CEQR-006.
