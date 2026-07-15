# 08 — Fixture lifecycle and cleanup

## Status

**PASS** (Playwright test 5)

Final cleanup report from the passing assault run:

```
remainingConversations=0
remainingMessages=0
remainingProposals=0
remainingModelUpdates=0
remainingMovementEvidenceLinks=0
remainingSeededMapEvidenceObjects=0
```

Fixture sessions use deterministic UUIDs (required by Explore session review routes):

- `a11ce001-ea01-4000-8000-000000000001` (positive)
- `a11ce001-ea01-4000-8000-000000000002` (insufficient)
- `a11ce001-ea01-4000-8000-000000000003` (cross-user)

Clerk ephemeral users revoked/deleted after cleanup.
