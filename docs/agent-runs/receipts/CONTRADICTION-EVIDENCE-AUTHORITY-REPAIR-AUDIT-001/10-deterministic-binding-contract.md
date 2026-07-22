# 10 — Deterministic binding contract

For each ordered evidence slot:

1. Select authoritative Side A or Side B source unit
2. Validate offsets are integers with `start >= 0`, `end > start`, `end <= length`
3. Derive `exactQuote = sourceText.slice(startOffset, endOffset)`
4. Copy `sourceId = authoritativeSource.sourceId`
5. Construct domain `ExactEvidenceClaim`
6. Run existing `validateDualSideEvidenceClaims`
7. Fail closed on invalid offsets or missing required clear-case evidence

Raw provider transport object remains unchanged.
