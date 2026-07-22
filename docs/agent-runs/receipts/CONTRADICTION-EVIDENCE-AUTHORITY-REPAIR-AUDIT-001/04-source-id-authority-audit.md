# 04 — sourceId authority audit

## Before
Model authored `evidenceClaim*.sourceId`. Validator compared to authoritative Side A/B `sourceId`, producing `source_id_mismatch` when the model copied messageId/sessionId/wrong side/fabricated IDs.

## After
`bindExactEvidenceClaimFromOffsets` copies `sourceId` exclusively from the authoritative `KernelSourceUnit` for that ordered side.

## Result
`source_id_mismatch` caused by model-authored IDs is structurally impossible on the adjudication binding path.

Provider cannot substitute: messageId, sessionId, ReferenceItem ID, opposite-side sourceId, or fabricated sourceId.
