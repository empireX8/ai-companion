# 04 — Repair decision

## Decision

**Implement live-wrapper-only evidence addendum v2.**

## Why this boundary

Audit proved:

1. Evidence IDs and texts already enter the user prompt correctly.
2. Failures are model-authored evidence claims, not transport/schema failures.
3. `request.prompt` is already correct and must stay byte-for-byte unchanged.
4. Provider object is already returned by reference unchanged.
5. Generic kernel prompt already states basic evidence rules; the live path is
   where CEQR-013 ran and where stronger authority language is justified.

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Post-generation quote/sourceId repair | Forbidden output mutation |
| Validation relaxation | Would weaken evidence gates |
| `appendLiveSourceLengthMetadata` / `sourceTextLengthChars` | Speculative; CEQR-013 had no `invalid_offsets` |
| Generic kernel prompt version bump | Not required; live-wrapper sufficient |
| Live provider rerun in this slice | Explicitly deferred |

## Classification target

`PASS_WITH_NARROW_EVIDENCE_PROMPT_PATCH`
