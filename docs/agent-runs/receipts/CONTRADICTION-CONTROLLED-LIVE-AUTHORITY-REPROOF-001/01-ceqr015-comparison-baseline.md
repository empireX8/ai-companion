# 01 — CEQR-015 comparison baseline

## Classification

`HOLD_LIVE_EVIDENCE_FAILURE_PERSISTS`

## Runtime (historical)

| Identity | Value |
|----------|-------|
| Provider | openai |
| Adjudicator | gpt-4o-mini |
| Referee | gpt-4o-mini |
| Schema | contradiction-adjudication-schema-v1 |
| Prompt | contradiction-adjudication-prompt-v2 |
| Addendum | contradiction-live-adjudicator-prompt-addendum-v2 |
| maxRetries | 0 |
| timeoutMs | 45000 |
| maxTotalCalls | 8 |

## Provider attempts

| Role | Count |
|------|-------|
| Adjudicator | 3 |
| Referee | 0 |
| Total | 3 of 8 |

## Case failures

| Case | earliestGate | validationErrorCodes | Referee | Writer |
|------|--------------|----------------------|---------|--------|
| clear_contradiction_candidate | deterministic_validation | fabricated_quote, clear_contradiction_requires_valid_spans, validation_failed | not reached | not reached |
| compatible_contextual | deterministic_validation | fabricated_quote, validation_failed | not reached | not reached |
| ambiguous_insufficient | deterministic_validation | source_id_mismatch, validation_failed | not reached | not reached |

## Account gate (before = after)

| Metric | Value |
|--------|-------|
| ContradictionNodes | 25 |
| candidate ContradictionNodes | 25 |
| EvidenceSpans | 5941 |
| complete dual-side | 0 |
| partial | 0 |
| legacy | 25 |
| duplicate groups | 0 |

Existing 25 rows remain legacy and must not be modified.

## Source receipts

`docs/agent-runs/receipts/CONTRADICTION-LIVE-EVIDENCE-PROMPT-RERUN-001/`
