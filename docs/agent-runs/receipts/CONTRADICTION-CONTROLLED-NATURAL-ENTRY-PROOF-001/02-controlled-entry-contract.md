# 02 — Controlled entry contract

## What “natural entry” means in CEQR-010

Controlled **persisted-input** natural-entry construction:

- a persisted current Message as `CurrentMessageSource` (Side B)
- same-session `SameSessionReferenceRow`s with authoritative `sourceMessage` (Side A)
- assembled via landed `assembleCurrentMessageSourceUnit` / `assessReferenceSourceCompleteness`

It does **not** mean ordinary UI message-send or import ingestion.

## Typed inputs (`ControlledNaturalEntryProofInput`)

- `userId`, `sessionId` (harness never uses the real Kay account)
- `currentMessage: CurrentMessageSource`
- `references: SameSessionReferenceRow[]`
- `modelRunner: StructuredModelRunner`
- `objectivityReferee: ObjectivityReferee`
- `messageResolver` — authoritative lineage re-resolution
- `persistenceDb` — injected transactional writer boundary
- optional `presentationReader`
- `now` / `abortSignal`

**Forbidden public inputs:** `sideB: KernelSourceUnit`, `sideACandidates: SideACandidate[]`, `executePersistence`, plan egress fields.

## Honest outcomes

`created` | `reused` | `no_candidate` | `routed_elsewhere` | `more_evidence_required` | `abstained` | `failed_safely`

Presentation status (separate from persistence failure):
`not_requested` | `resolved` | `unavailable` | `failed`
