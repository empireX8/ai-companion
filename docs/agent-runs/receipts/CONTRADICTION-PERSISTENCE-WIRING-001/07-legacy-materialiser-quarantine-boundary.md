# 07 — Legacy materialiser quarantine boundary

## Decision

**Do not reuse** `materializeContradictions` for the repaired path.

### Why

Legacy materialisation:

- consumes `DetectedContradiction[]`
- accepts singular `sessionId` / `messageId` / `quote`
- uses legacy confidence strings
- creates `ContradictionEvidence`
- does **not** consume CEQR-005 dual-side lineage
- does **not** persist `sideASourceSpanId` / `sideBSourceSpanId`
- has legacy collision/reuse behaviour

Routing a repaired plan through that shape would silently discard dual-side exact lineage contracts.

## What this slice did

- Implemented a **separate** repaired persistence boundary
- Left legacy materialiser code in place (not deleted)
- No broadening of `DetectedContradiction`
- No marker re-enablement
- No type-only quarantine edit was required; accidental use is prevented by:
  - distinct module names
  - opaque plan authorisation token
  - tests asserting no import of the legacy materialiser into the repaired writer

## Deviation

None. No quarantine patch to legacy files was necessary.
