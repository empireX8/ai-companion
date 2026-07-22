# 05 — Live addendum versioning

## Before (CEQR-011 through CEQR-013)

`contradiction-live-adjudicator-prompt-addendum-v1`

## After (CEQR-014)

`contradiction-live-adjudicator-prompt-addendum-v2`

## Honesty rules applied

- Version identity changed because the live addendum text changed.
- Historical CEQR-011 / CEQR-012 / CEQR-013 receipts were **not** rewritten to
  claim v2.
- CEQR-013 receipt tests now assert the historical receipt retains **v1** and
  that current code reports **v2**.
- Historical constant retained as
  `CONTRADICTION_LIVE_ADJUDICATOR_PROMPT_ADDENDUM_VERSION_V1` for explicit
  contrast; current export is v2.
- Version string is **not** injected into the provider prompt text.

## Runtime prompt changed

**YES** — live adjudicator **system** addendum text changed (v1 → v2).

## `request.prompt` changed

**NO**
