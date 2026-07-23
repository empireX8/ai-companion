# 15 — CEQR-021 invalid-credential live result

## Execution identity

- Execution HEAD: `cb4d91698e3f40a439ed46e4d2049a86efb245fb`
- Frozen-plan SHA-256: `ec411a3c3bc8c2b99514ca2bc312604dfab1a64e766370f95322dad50e6072c1`
- One-shot claim state: `consumed`
- CEQR-021 may not be rerun.

## Raw-to-sanitized archival boundary

- Original local live-receipt SHA-256:
  `e30b995c38f24e853fac5859df255b45c9635f2702e67c9f945423f35c22cc73`
- Sanitized canonical live-receipt SHA-256:
  `000b98231443fe7d1dcf4b434d3305e2fe9e665986de72bf5fd067f558789014`
- The original receipt was preserved outside the repository.
- Only three provider error-message values were normalized.
- Credential-derived prefix, suffix, masking and provider account URL were removed.
- Accounting, timestamps, classifications, claim identity and all other fields remain unchanged.

## Actual result

The historical classifier emitted:

`FAIL_SCHEMA_V4_PARSE`

That classification is inaccurate.

Every case failed at:

`model_execution_failed`

The provider rejected the supplied credential before returning structured model output.

Therefore:

- structured model outputs received: `0`
- schema-v4 model-output parsing exercised: `NO`
- referee attempts: `0`
- automatic retries: `0`
- writer calls: `0`
- persistence calls: `0`
- real database calls: `0`
- production-ingestion calls: `0`
- contradiction nodes created: `0`

## Required repair

A later source repair must:

1. classify provider failure before schema-parse state;
2. redact credential-derived provider-error details before receipt finalization;
3. strengthen leak detection to reject masked key fingerprints;
4. retain CEQR-021 as immutable historical evidence;
5. use a new one-shot slice for the next live proof.

Production readiness remains `NO`.
