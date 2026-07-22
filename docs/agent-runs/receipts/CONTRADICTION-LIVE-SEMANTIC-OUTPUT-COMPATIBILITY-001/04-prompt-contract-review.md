# 04 — Prompt contract review

## Runtime prompt changed in CEQR-012

**NO**

`LIVE_ADJUDICATOR_EVIDENCE_ADDENDUM` restored byte-for-byte to the CEQR-011 /
merge-base `57f702c` version.

## Removed speculative changes

- v2 version line in provider system prompt
- byte-for-byte / UTF-16 / required-field / proposedObjectType wording additions
- neutral formatting example
- emotional/physiological consistency line addition
- `appendLiveSourceLengthMetadata` / `sourceTextLengthChars`
- any modification of `request.prompt`

## Addendum identity (not injected into prompt)

Constant `contradiction-live-adjudicator-prompt-addendum-v1` is exposed only on
the live adapter bundle / live proof receipt for provenance. It is **not**
written into the provider prompt.
