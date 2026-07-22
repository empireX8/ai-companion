# 08 — Deterministic regression results

Suite: `lib/__tests__/contradiction-live-semantic-output-compatibility.test.ts`

| Requirement | Result |
|---|---|
| Coarse CEQR-011 failure shape | PASS |
| Generic diagnostics have no live-addendum provenance | PASS |
| Live bundle reports addendum v1 | PASS |
| Provider system prompt = exact CEQR-011 addendum | PASS |
| User prompt unchanged byte-for-byte | PASS |
| Provider object unchanged by reference | PASS |
| Unlabelled fabricated quote → no false side attribution | PASS |
| Unlabelled Side B failures → no false Side A | PASS |
| Explicit cross-side → correct path | PASS |
| Unknown match state remains null | PASS |
| Budget skip gateStoppedAt null | PASS |
| Pre-result exception gateStoppedAt null | PASS |
| Validation rejection gateStoppedAt selection | PASS |
| Successful created gateStoppedAt null | PASS |
| Fail-closed evidence/consistency/malformed/abstention | PASS |
| Compatible cannot reach referee; clear can | PASS |
