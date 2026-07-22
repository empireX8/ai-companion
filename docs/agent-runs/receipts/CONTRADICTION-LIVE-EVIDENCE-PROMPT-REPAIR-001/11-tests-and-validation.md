# 11 — Tests and validation

## New focused coverage

`lib/__tests__/contradiction-live-evidence-prompt-repair.test.ts` proves:

1. Honest new v2 version identity
2. Prior v1 no longer reported by repaired live adapter
3. Explicit sourceId-versus-messageId rules in captured system prompt
4. Forbids constructing/inferring source IDs
5. Requires Side A/B source IDs ordered
6. Character-for-character quote copying
7. Forbids paraphrasing / normalization / grammar correction / reconstruction
8. Distinguishes decoded sourceText from JSON delimiter quotes
9. Whole sourceText safest quote when whole unit is evidence
10. Offsets remain zero-based / start-inclusive / end-exclusive
11. No source-length metadata
12. `request.prompt` byte-for-byte unchanged
13. Provider object same by reference
14. No output-repair function introduced
15. `fabricated_quote` still fails closed
16. `source_id_mismatch` still fails closed
17. Valid exact evidence still passes
18. Class A invalid spans cannot reach referee
19. Valid non-Class-A does not reach referee
20. No live provider invoked

## Narrow updates to existing tests

- CEQR-012 provenance assertions updated to current v2 addendum
- CEQR-013 receipt test asserts historical receipt retains v1 (not coupled to
  current constant)
- CEQR-011 exit-code fixtures updated to current version literal for typing

## Commands (completed)

| Check | Result |
|-------|--------|
| Focused CEQR-014 | PASS (12) |
| CEQR-014+013+012+011 | PASS (96) |
| Related suites | PASS (322) |
| Full Vitest | 5 fail files / 7 fail tests (baseline unchanged); 319/4345 pass |
| `npx tsc --noEmit` | PASS |
| Changed-file ESLint | PASS |
| Production build | PASS with env loaded (Stripe dummy secret for page-data) |
| `git diff --check` | PASS |
| Secret scan | PASS |
| Personal-identifier scan | PASS |
| Source-length metadata scan | PASS |
| Output-repair pattern scan | PASS |
| Route/import/live-wiring scan | PASS |
| Trust language | PASS |
| Legacy surfaces | PASS |
| Live provider during validation | NO |
