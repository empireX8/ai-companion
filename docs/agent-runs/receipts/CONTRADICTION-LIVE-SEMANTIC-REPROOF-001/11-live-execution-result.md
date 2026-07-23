# 11 — Live execution result

## Status

The single authorised CEQR-019 live execution has been consumed.
Classification is final and immutable.

## Classification

`FAIL_TRUNCATED_OR_INVALID_EVIDENCE_SPAN`

Command exit code: `5`

## Runtime identity

| Pin | Observed |
|---|---|
| Provider | openai |
| Adjudicator model | gpt-4o-mini |
| Referee model | gpt-4o-mini |
| Schema | contradiction-adjudication-schema-v3 |
| Retries | 0 |
| Max provider-call budget | 6 |
| Provider attempts | 3 |
| Adjudicator calls | 3 |
| Referee calls | 0 |
| Writer calls | 0 |
| Persistence calls | 0 |
| Account-gate calls | 0 |
| Real database calls | 0 |
| Unsafe mutation | false |
| Real account mutated | false |
| Production ingestion wired | false |
| Production readiness | false |

## Case results

### clear_contradiction_candidate

- attempted adjudications: 1
- adjudication outcome: `validation_failed`
- deterministic validation: `invalid`
- failure: lexical_boundary_integrity — endOffset falls inside a Unicode alphanumeric word
- referee calls: 0
- writer invoked: false
- write executed: false
- contradiction node: null

### compatible_contextual

- attempted adjudications: 1
- adjudication outcome: `validation_failed`
- deterministic validation: `invalid`
- failure: lexical_boundary_integrity — endOffset falls inside a Unicode alphanumeric word
- referee calls: 0
- writer invoked: false
- write executed: false
- contradiction node: null

### ambiguous_insufficient

- attempted adjudications: 1
- adjudication outcome: `validation_failed`
- deterministic validation: `invalid`
- failure: lexical_boundary_integrity — endOffset falls inside a Unicode alphanumeric word
- referee calls: 0
- writer invoked: false
- write executed: false
- contradiction node: null

## Canonical generated artifacts (immutable)

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| live-run-oneshot-claim.json | 539 | `0973a66f6c1b36fbef77625d435b83c14ee14cbf5530cf9c5d324d7b5504a65c` |
| frozen-live-run-plan.json | 3831 | `b3f8986b7bf7004fb6d111689cea90371aa82988a2c8f5a93a5354f7bf4d9129` |
| live-execution-receipt.json | 10419 | `74c12305a2dc15d166a37c6a054158996016f0bc66c6236d42a16868d1798e58` |

## Distinction

| Phase | Classification |
|---|---|
| Offline harness | `PASS_OFFLINE_LIVE_SEMANTIC_REPROOF_HARNESS_READY` |
| Live execution | `FAIL_TRUNCATED_OR_INVALID_EVIDENCE_SPAN` |
