# 02 — Production query implementation

## Modules

| File | Role |
|------|------|
| `lib/import-candidate-review-query.ts` | User-scoped pending list + key encoding |
| `lib/import-candidate-review-presentation.ts` | Map to `OrvekImportReviewBatch` |
| `lib/import-candidate-review-client.ts` | Browser fetch helpers |
| `app/api/import-review/candidates/route.ts` | `GET` authenticated list |

## Auth / scoping

- Clerk `auth()` required (401 otherwise)
- All Prisma filters include `userId`
- Cross-user IDs return not found on decide path (403/404)

## Seed exclusion

- Query never reads `CanonicalTodayComposition.workbench.importReview`
- Query never returns `dev-exact-rt-…-import-cand-ic*` ids
- Hybrid workbench **overrides** any composition `importReview` with live fetch

## Empty / loading / error

- Loading: `emptyImportReviewBatch({ loading: true })`
- Error: batch with `error` string, empty candidates
- Empty: `totalPendingCount: 0`, Import button stays disabled in production
