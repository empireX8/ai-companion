# 00 — Intake and boundaries

## Task

`CONTRADICTION-LIVE-EVIDENCE-PROMPT-REPAIR-001` / campaign slice `CEQR-014`

## Worktree / branch / base

| Field | Value |
|-------|-------|
| Worktree | `/Users/user/ai-companion-worktrees/desktop-contradiction-live-evidence-prompt-repair-001` |
| Branch | `desktop-contradiction-live-evidence-prompt-repair-001` |
| Exact base | `0b8d3dbd42b11877211220ceada81840567eebd3` |

## Goal

Narrowest evidence-supported live-prompt repair addressing CEQR-013 codes:

- `fabricated_quote`
- `source_id_mismatch`

Repair improves provider instructions **before** generation. No post-generation output mutation.

## Allowed

- Live adjudicator evidence addendum wording
- Live addendum version identity
- Narrow live-adapter metadata for that identity
- Deterministic tests for the repaired prompt contract
- Narrow updates to tests asserting old identity
- CEQR-014 receipts

## Forbidden

- Provider-output rewriting / quote or sourceId repair after generation
- Validation / evidence-validation relaxation
- Source-length metadata
- Live provider execution
- Ordinary message-send / import / route wiring
- Real Prisma persistence / schema / migrations / UI
- Modification of the existing 25 rows
- Rewriting historical CEQR-011/012/013 receipts

## Live provider this slice

**Attempts: 0.** No live provider run occurred.
