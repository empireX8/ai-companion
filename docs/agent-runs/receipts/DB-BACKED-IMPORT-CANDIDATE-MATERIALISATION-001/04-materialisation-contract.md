# 04 — Materialisation contract

## Destination by candidate semantics

| Candidate | Typed model object | Durable evidence | ModelUpdate |
|-----------|--------------------|------------------|-------------|
| `ReferenceItem` | Same row, `status=active` | Existing `sourceSessionId` / `sourceMessageId` FKs | **Gap** — `ModelUpdate.affectedObjectType` cannot target `reference_item` |
| `ContradictionNode` | Same row, `status=open` | UELs: message, evidence_span(s), session, import_record | Created when none exists; type `link_detected` (narrowest existing enum; noted in `internalNotes` + gaps) |

**Never** forced into `PatternClaim`.

## Gaps recorded (not silently downgraded)

1. `MODEL_UPDATE_TARGET_UNSUPPORTED` — reference accept cannot create MU
2. `UEL_TARGET_UNSUPPORTED` — UEL cannot target `reference_item`
3. `MODEL_UPDATE_TYPE_NARROWEST_DEFENSIBLE` — no `contradiction_opened` enum; used `link_detected`
4. `IMPORT_BATCH_LINK_UNAVAILABLE` — no completed upload session to link

## Existing genuine intelligence

- 7 PatternClaims: never created/updated/deleted by this path
- Import-linked UserMap + ModelUpdate: not recreated; accept only creates MU for **new** contradiction acceptances when no MU exists for that node id

## Provider visibility (after accept)

- Active references: `/api/reference/list?status=active` → mind-context
- Open contradictions: `contradiction-surface` TOP_ELIGIBLE includes `open`
- Contradiction MU: Timeline / Inspector model movement when live providers project `user_visible` ModelUpdates
- Today: only if composition/selection rules pick the object — **not required** for acceptance
