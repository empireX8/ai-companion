# 06 — Source authority and write isolation

## Source authority

For every case:

- provider selects offsets only
- code derives `exactQuote` from authoritative source text
- provider does not author `sourceId` or `exactQuote`
- no clamping, fuzzy search, substring fallback, or full-source fallback
- no mutation of raw provider output
- no repair of invalid offsets after receipt
- failed lexical boundary blocks downstream eligibility

## Write isolation (offline-proven)

- synthetic source material only (`LIVE_PROOF_USER_ID` isolated)
- no real account identifier required
- no real database client required
- no real writer reachable from the offline harness
- no persistence adapter against a real account
- clear-provider output alone cannot cause a write when semantic/lexical gates fail
- invalid or ambiguous output cannot reach referee / writer / persistence
- provider exceptions stop safely
- schema rejection stops safely
- missing live-authorisation guard ⇒ zero provider calls

## Counters recorded

adjudicatorCalls, refereeCalls, writerCalls, persistenceCalls,
accountGateCalls, realDatabaseCalls
