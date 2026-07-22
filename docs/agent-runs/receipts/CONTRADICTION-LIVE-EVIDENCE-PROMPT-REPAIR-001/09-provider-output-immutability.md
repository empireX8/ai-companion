# 09 — Provider-output immutability

## Wrapper behaviour

`wrapAdjudicatorRunnerForLiveEvidence`:

1. Builds a new `system` string = base system + live addendum
2. Calls inner `runStructured({ ...request, system })`
3. Returns the inner result unchanged

## Proven by tests

- Provider-returned object remains the same object by reference
- `request.prompt` remains byte-for-byte unchanged
- No output-repair helpers introduced (`realignExactClaim`,
  `repairExactQuote`, `fixFabricatedQuote`, `replaceSourceId`,
  `normalizeExactQuote` absent)

Provider-output mutation: **NO**
