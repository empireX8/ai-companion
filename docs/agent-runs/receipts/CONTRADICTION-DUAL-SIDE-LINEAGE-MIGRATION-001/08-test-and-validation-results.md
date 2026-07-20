# 08 — Test and validation results

## Focused lineage suite

`npx vitest run lib/__tests__/contradiction-dual-side-lineage.test.ts`

- 48 passed / 0 failed

Covers required matrix items 1–50 (schema, migration, classification, happy paths, session/ownership, claims, offsets/quotes/hash, Class B/C/D, abstention, validation failure, referee gates, non-wiring, same-session ambiguity, cross-session exclusion, DetectedContradiction type proof).

## Related suites

| Suite | Result |
|-------|--------|
| `contradiction-adjudication-contract.test.ts` | 47 passed |
| `objectivity-referee-interface-contract.test.ts` | 28 passed |
| `contradiction-source.test.ts` | 31 passed |
| `derivation-lifecycle.test.ts` | 26 passed |

## Prisma

- `npx prisma validate` — schema valid
- `npx prisma generate` — client generated

## TypeScript / build

- `npx tsc --noEmit` — PASS
- `npm run build` — PASS

## Full suite

- 5 failed files / 7 failed tests — exact match to Objectivity Referee gate baseline
- 306 passed files / 4066 passed tests
- No campaign-caused new failures

## Static migration DML check

Executable SQL (comments stripped) contains no `INSERT INTO`, `UPDATE … SET`, `DELETE FROM`, or `DROP TABLE|INDEX|TYPE|CONSTRAINT`.
