# 05 — Deterministic lineage gates

Fail-closed unless all hold.

## 1. Selected proposal

- Exactly one semantically selected pair
- Adjudication outcome `semantic_accepted`
- Classification `clear_contradiction`
- Deterministic validation `valid`
- Both evidence claims present
- Pair remains non-persistable

## 2. Referee continuation

- executionState `completed`
- validationErrors empty
- outcome PASS or PASS_WITH_LOWER_CONFIDENCE
- `continuationAllowed === true`

Blocked: not_run, failed, invalid_evaluation, ROUTE, REQUEST_MORE_EVIDENCE, ABSTAIN.

PASS means lineage continuation readiness only — not persistable / not persistence-authorised / not createCandidate.

## 3. Same session

- Side A session equals Side B session
- Resolved messages belong to that session
- Cross-session fails

## 4. User ownership

- Both messages belong to requested userId
- Mixed-user fails

## 5. Message provenance

- Nonblank message IDs
- Kernel messageId / sessionId agree with resolved messages
- Claim sourceIds agree with source units
- sourceText equals message content (blocks statement-as-span)

## 6. Exact offsets

- integers; start >= 0; end > start; end <= content length
- content.slice(start, end) === exactQuote (no trim/normalize)
- exactQuote nonblank

## 7. Distinct sides

- Same message allowed
- Identical messageId+start+end+contentHash rejected
- Same stored span ID on both sides rejected (`rejectSameSpanOnBothSides`)

## 8. No fabrication

Builder never searches the message to recover missing/incorrect offsets.
