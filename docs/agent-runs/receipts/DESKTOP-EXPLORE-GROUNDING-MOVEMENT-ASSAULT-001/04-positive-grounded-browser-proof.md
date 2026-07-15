# 04 — Positive grounded browser proof

## Status

**PASS**

## Evidence

- Authenticated Clerk cookies (`__session`, `__clerk_db_jwt`, `__client_uat`).
- Ask enabled naturally after composer input (no force-click).
- Exactly one `POST /api/message` (200) via UI.
- Conversation: `a11ce001-ea01-4000-8000-000000000001`
- User message: `825def98-6e6f-4f99-acab-341af6016fc2`
- Assistant message: `6ce635a4-20ca-4f24-8e6d-17d28e00c527`
- Grounding chips: VERIFIED `dev-explore-grounding-movement-assault-journal-verified`, INFERRED `dev-explore-grounding-movement-assault-claim-evidence`
- Inspector same source IDs after assistant click
- Reload preserves conversation + grounding
- Publish → proposal `cmrm9eju4000sql65ttck9xdp`, ModelUpdate `cmrm9fafw000tql65mitoswko`
- Idempotent retry same ModelUpdate ID

## Root causes fixed before this proof

See `10-final-result-for-kay.md`.
