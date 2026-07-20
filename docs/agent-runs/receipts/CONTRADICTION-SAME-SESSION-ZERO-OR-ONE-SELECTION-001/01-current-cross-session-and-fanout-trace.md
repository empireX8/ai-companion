# 01 — Current cross-session and fan-out trace

## LIVE (before CEQR-004)

```
POST /api/message
→ current APP session and new user Message
→ after() background block
→ detectContradictions({ userId, messageContent })
→ user-wide ReferenceItem query (take: 50, no sourceSessionId filter)
→ legacy detectContradictionsFromData returns []
→ materializeContradictions only when detections exist (never, under CEQR-002)
```

### Defects

1. `detectContradictions` queried up to 50 user-wide references without requiring the current session.
2. Marker nomination still looped over matching references and truncated — retrieval fan-out, not zero-or-one semantic selection.
3. Live caller did not supply an explicit current session boundary.

## IMPORT (before CEQR-004)

```
one imported conversation
→ one imported Session
→ messages created
→ ReferenceItems extracted with sourceSessionId/sourceMessageId
→ detectContradictions({ userId, messageContent, referenceStatuses })
→ user-wide reference query (could include other sessions / prior imports)
→ import pair classifier
→ fan-out guard
→ materializeContradictions
```

### Defect

Import did not restrict Side A retrieval to the created Session of that conversation.

## KERNEL (already landed)

```
same-session Side A source unit + Side B source unit
→ adjudicateContradiction
→ model-assisted Class A/B/C/D result
→ deterministic semantic and exact-span validation
→ optional Objectivity Referee interface
→ persistenceDecision remains null
→ createCandidate remains undefined
```

## CEQR-004 repair

- Detection query now requires `sessionId` and filters `sourceSessionId`.
- New selection module owns zero-or-one semantic selection.
- Production materialisation remains fail-closed (legacy path still returns `[]`).
- No production model call added on live/import for non-persistable selection.
