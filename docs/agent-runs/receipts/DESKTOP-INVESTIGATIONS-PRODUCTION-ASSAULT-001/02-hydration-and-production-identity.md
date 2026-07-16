# Hydration And Production Identity

## Hydration repairs implemented

Files:

- `lib/investigation-public-visibility.ts`
- `lib/fieldwork-public-visibility.ts`
- `lib/public-linked-object-continuity.ts`
- `lib/investigation-production-detail.ts`
- `app/(root)/(routes)/active-questions/page.tsx`
- `app/(root)/(routes)/active-questions/[id]/page.tsx`
- `components/orvek-v0/pages/explore.tsx`

## Exact contract enforced

Production list rows:

- `/active-questions` now reads durable `Investigation` rows for the authenticated user
- list rows visibly render `Investigation ID {id}`
- honest empty state remains when no rows exist

Production detail:

- `/active-questions/[id]` now hydrates from `loadProductionInvestigationDetail`
- the same `Investigation.id` is used for:
  - detail selection
  - evidence linkage
  - fieldwork linkage
  - Inspector selection
  - closure state

Public continuity:

- `lib/public-linked-object-continuity.ts` now resolves investigation detail continuity through `buildPublicInvestigationWhere(...)`
- closed investigations remain reviewable at `/active-questions/[id]`

## Reference substitution removed from production Explore

File:

- `components/orvek-v0/pages/explore.tsx`

Exact change:

- reference rows are now used only when `referenceSurface === true`
- production (`referenceSurface === false`) no longer substitutes:
  - `referenceQuestionIds = ["aq-1", "aq-2", "aq-3", "aq-4"]`
  - `referenceInvestigationIds = ["inv-1", "inv-2", "inv-3"]`

Production empty copy now remains honest:

- `No active questions are open yet.`
- `No investigations are active yet.`

## Live proof status

- Browser-hydrated durable investigation ID observed: `cmrmqfgtf000uqlcyy5ebe8fe`
- Exact browser title observed after reload: `dev-investigations-assault durable investigation create-and-reload 1784159371680`
- Exact browser organizing question observed in Inspector: `dev-investigations-assault organizing question create-and-reload 1784159371680`
- Empty/reference isolation proof completed separately in `TEST 4` and passed
