# 09 — Sanitized live diagnostics

## Purpose

Define the sanitized per-case / per-side diagnostic shape for a future live
run. Diagnostics must support forensic classification without leaking raw
private account evidence or unsanitized provider payloads into public surfaces.

## Side diagnostics (Blocker 5 — independent endpoints)

- Raw and resolved boundary indices / offsets
- Source UTF-16 and code-point lengths; selected span length
- `sourceTextSha256`, `catalogSha256`, approved-span membership
- Validation code
- Independent start/end: `startBoundaryCategory`, `endBoundaryCategory`
- `splitsSurrogateAtStart` / `splitsSurrogateAtEnd`
- `startOffsetInsideAlphanumericWord` / `endOffsetInsideAlphanumericWord`
- Combining-mark failure flags at each endpoint
- Unicode-aware CEQR-020 `inspectLexicalOffsetIndependently` helpers
- `exactQuoteEqualsAuthoritativeSlice`
- `sourceIdAuthoritative` against exact frozen source IDs (not arbitrary prefixes)

## Case diagnostics (contract fields)

- Expected vs observed classification
- Pinned provider / model / schema / prompt / addendum identities
- `rawProviderObjectSha256` via CEQR-020 `fingerprintRawProviderObjectSha256OrNull`
- Compatibility flags; referee status (`completed` | `failed` | `incomplete` |
  `not_reached` | `not_required`); failing side
- Referee reached-but-not-completed is never labelled `completed`

## Leak validator

Fails closed when serialized receipt contains API keys, bearer tokens, env
assignments, or embedded raw provider object structures. Validates final
serialized canonical receipt JSON, not merely a typed object.

## This patch

Diagnostics are implemented and exercised offline (fake runner / unit proofs).
No live provider object is captured. No live-execution-receipt.json is written.

## CEQR-021 offline execution counts

- CEQR-021 live provider attempts: 0
- CEQR-021 real account queries: 0
- CEQR-021 real database queries/mutations: 0
- CEQR-021 writer/persistence calls: 0
- no live execution is authorised by this patch
- production readiness: NO
