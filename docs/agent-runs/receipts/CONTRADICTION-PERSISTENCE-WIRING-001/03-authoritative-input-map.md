# 03 — Authoritative-input map

| Field on repaired candidate | Authoritative source | Not authoritative |
| --------------------------- | -------------------- | ----------------- |
| Semantic object | `SemanticallySelectedContradictionPair` | Caller-created free-form `semantic` bag |
| `userId` | CEQR-005 validated lineage (bound to selected pair) | Caller-only override |
| Shared `sessionId` | Selected pair + CEQR-005 lineage (must match) | Cross-session pairing |
| Side A / Side B span descriptors | CEQR-005 `spanEnsureDescriptors` bound to selected-pair claims | Marker search, substring search |
| Exact quotes / offsets / content hashes | Selected-pair evidence claims ↔ CEQR-005 sides | Full-message hash, trimmed/altered quotes |
| `sideA` / `sideB` node text | Adjudication `normalizedProposition` only | Caller proposition strings; exact quotes alone; markers |
| `confidence` storage band | CEQR-006 `recommendedStorageConfidence` | Manual low/medium/high; legacy type-derived confidence |
| Effective confidence / source | CEQR-006 result | Candidate volume; token overlap |
| Referee outcome | Selected pair + lineage + CEQR-006 must agree | Inferred PASS from missing referee |
| `title` | Deterministic display label from propositions | Caller title; marker family; eligibility signal |
| `type` | Side A `sourceType` (`goal`/`constraint`) after clear-contradiction eligibility | Caller enum; type alone as eligibility; default `belief_conflict` |
| `status` | Hard-coded `candidate` in repaired writer | `open` / `active` promotion |
| `sideASourceSpanId` / `sideBSourceSpanId` | Writer ensure/reuse of exact descriptors | Legacy singular evidence rows |
| `sourceSessionId` | Shared session | Singular-side grounding claim |
| `sourceMessageId` | Always `null` for repaired dual-side writes | Side A or Side B message id as singular authority |
| `sideBTriggerMessageId` | Inspectable plan metadata only | Schema singular source authority |

## Non-bypass rule

A caller cannot bypass CEQR-004/005/006 by constructing a superficially similar plan object.

Only `buildContradictionPersistencePlan` may register a plan in the module-private `WeakSet`. Version strings and former token strings do **not** grant authority.
