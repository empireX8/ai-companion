# Provenance Taxonomy And Hard Gates

## Taxonomy used

- `LIVE`
- `MIXED`
- `FALLBACK`
- `MOCK`
- `UNPROVEN`
- `INTENTIONAL EMPTY`
- `INTENTIONAL UNAVAILABLE`
- `EXPLICIT SAMPLE / REFERENCE`

## Hard-gate contract applied

- `LIVE`: authenticated, user-owned, durable production data rendered through the canonical production path with no sample substitution.
- `MIXED`: a production render that combines live data with reference, sample, mock, or hardcoded content.
- `FALLBACK`: a production surface that substitutes reference or sample content when live data is empty, loading, unavailable, or not ready.
- `MOCK`: a production surface that shows hardcoded or fixture content without an explicit sample/reference boundary.
- `UNPROVEN`: a production-looking state whose source, ownership, durability, or continuity is not demonstrated.
- `INTENTIONAL EMPTY`: truthful empty production state with no invented data.
- `INTENTIONAL UNAVAILABLE`: truthful unavailable/error state with no sample substitution.
- `EXPLICIT SAMPLE / REFERENCE`: sample content isolated to `/dev/orvek-v0-reference` with `referenceSurface === true`.

## Hard-gate outcome

- Browser hard gate: `PASS`
  - dedicated global production-parity Playwright suite completed `7/7`
- Matrix hard gate: `PASS`
  - exact denominator `45`
  - exact initial counts recorded
  - exact final counts recorded
- Production-parity counts hard gate: `PASS`
  - final `MIXED`: `0`
  - final `FALLBACK`: `0`
  - final `MOCK`: `0`
  - final `UNPROVEN`: `0`
- Inspector hard gate: `PASS`
  - exact live identities proven across Today, Map, Decisions, Explore, Investigations, and Timeline
- Reference-isolation hard gate: `PASS`
  - explicit sample states preserved only on `/dev/orvek-v0-reference`
- Negative-proof hard gate: `PASS`
  - exact observed status codes captured
  - unauthorized mutation observed: `NONE`

## Scope note

This verdict covers desktop production provenance and parity only.
It does not claim mobile completion, security readiness, or launch readiness.

## Result

The provenance taxonomy, browser hard gate, Inspector hard gate, and reference-isolation hard gate all closed cleanly on Thursday, July 16, 2026.
