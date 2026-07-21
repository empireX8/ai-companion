# 09 — Failure and rollback matrix

## Pure plan gate (fail closed)

| Case | Code |
| ---- | ---- |
| Lineage not successful | `lineage_not_successful` |
| Lineage not continuation-ready | `lineage_not_continuation_ready` |
| Missing validated lineage | `missing_validated_lineage` |
| Unsupported lineage version | `unsupported_lineage_contract_version` |
| Confidence not successful | `confidence_not_successful` |
| Below candidate floor | `below_candidate_floor` |
| Confidence not continuation-ready | `confidence_not_continuation_ready` |
| Unsupported confidence policy version | `unsupported_confidence_policy_version` |
| Malformed effective confidence | `malformed_effective_confidence` |
| Invalid storage confidence | `invalid_storage_confidence` |
| User mismatch | `user_mismatch` |
| Session mismatch | `session_mismatch` |
| Missing/blank semantic fields | `missing_or_blank_semantic_fields` |
| Invalid contradiction type | `invalid_contradiction_type` |
| Missing span descriptor | `missing_span_descriptor` |
| Identical descriptors | `identical_side_descriptors` |
| Malformed content hash | `missing_or_malformed_content_hash` |
| Noninteger offsets | `noninteger_offsets` |
| Invalid offset ordering | `invalid_offset_ordering` |
| Upstream contract contradiction | `upstream_contract_contradiction` |

## Writer (fail closed; `writeExecuted: false`)

| Case | Code |
| ---- | ---- |
| Non-authorised plan | `plan_not_authorised` |
| Malformed plan object | `malformed_plan_object` |
| Unresolved source message | `unresolved_source_message` |
| Wrong-user message | `wrong_user_message` |
| Wrong-session message | `wrong_session_message` |
| Message content inconsistent | `message_content_inconsistent` |
| Existing span mismatch | `existing_span_mismatch` |
| Same span ID both sides | `identical_span_ids` |
| Node create missing id | `node_create_missing_id` |
| Transaction failure | `transaction_failure` |

## Rollback

Injected fake `$transaction` restores pre-transaction span/node snapshots on throw.
No error path returns a successful persistence result.
