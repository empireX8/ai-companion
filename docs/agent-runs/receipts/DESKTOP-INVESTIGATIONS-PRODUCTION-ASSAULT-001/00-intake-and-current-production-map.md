# DESKTOP-INVESTIGATIONS-PRODUCTION-ASSAULT-001

- Date: 2026-07-15
- Repo: `empireX8/ai-companion`
- Worktree: `/Users/user/ai-companion-worktrees/desktop-investigations-production-assault-001`
- Branch: `desktop-investigations-production-assault-001`
- Baseline commit: `15b7f77bd2b1853eceffbff4d7f7aa161b240f43`

## Baseline commands before implementation

- `pwd` -> `/Users/user/ai-companion-worktrees/desktop-investigations-production-assault-001`
- `git branch --show-current` -> `desktop-investigations-production-assault-001`
- `git rev-parse HEAD` -> `15b7f77bd2b1853eceffbff4d7f7aa161b240f43`
- `git status --short --branch` -> clean at intake
- `git diff --check` -> pass at intake

## Clean baseline reproduction at `staging @ 15b7f77`

Detached worktree: `/tmp/desktop-investigations-baseline`

- `git diff --check` -> PASS
- `npx tsc --noEmit` -> PASS
- `npx vitest run` -> FAIL
- `npm run build` -> FAIL
- `bash scripts/check-trust-language.sh` -> PASS
- `bash scripts/check-legacy-surfaces.sh` -> PASS
- `bash scripts/verify-mindlab.sh` -> `PASS: 4 / FAIL: 2`

Exact reproduced baseline Vitest failures:

1. `lib/__tests__/evidence-pointer-surfacing-rationale-schema.test.ts`
2. `lib/__tests__/surfaced-evidence-pointer-schema.test.ts`

Exact reproduced baseline build failure:

- `Error: Neither apiKey nor config.authenticator provided`
- `Build error occurred`
- `Failed to collect page data for /api/stripe`

## Canonical production model already present before edits

Relevant Prisma models in `prisma/schema.prisma`:

- `Investigation`
- `FieldworkAssignment`
- `UnderstandingEvidenceLink`
- `EvidenceSpan`
- `Session`
- `Message`
- `UserMapConclusion`

Relevant enums already present:

- `InvestigationStatus`
- `InvestigationVisibility`
- `FieldworkStatus`
- `UnderstandingLinkTargetType`
- `UnderstandingLinkSourceType`
- `UnderstandingLinkRole`

## Current production UI entry points

- `/active-questions`
- `/active-questions/[id]`
- `/watch-for`
- `/watch-for/[id]`
- `/explore`

## Current APIs audited

Canonical durable APIs:

- `GET/POST /api/investigations`
- `GET/PATCH /api/investigations/[id]`
- `GET/POST /api/fieldwork`
- `GET/PATCH /api/fieldwork/[id]`
- `GET/POST /api/understanding/evidence-links`
- `POST /api/evidence/create`

Public/mobile projection APIs:

- `GET /api/active-questions`
- `GET /api/active-questions/[id]`
- `GET /api/active-questions/[id]/evidence`
- `GET /api/watch-for`
- `GET /api/watch-for/[id]`
- `GET /api/watch-for/[id]/evidence`

Inspector API after this assault:

- `GET /api/inspector/investigations/[id]`

## Current reference/mock entry points audited

- `components/orvek-v0/pages/explore.tsx`
- `app/dev/orvek-v0-reference/page.tsx`
- `lib/orvek-v0/orvek-data.ts`
- `lib/orvek-v0/reference-props.ts`

## Exact production gaps found before edits

1. `components/orvek-v0/pages/explore.tsx` populated production Investigations and Active Questions tabs from reference rows whenever live production rows were empty. This violated the no-fake-production-data rule.
2. Public continuity for investigation links only resolved active investigations, so closed investigations could lose direct surface continuity.
3. Investigation detail hydration was spread across thin public adapters rather than one canonical durable read model.
4. Investigation Inspector depth was thin and could not show durable evidence, fieldwork/check-ins, outcome, and closure state from one canonical record.
5. Production surfaces had no real authenticated creation control for investigations.

## Final continuation on 2026-07-16

- authenticated Playwright artifacts written: `2026-07-16 00:55:52 BST`
- final Playwright metadata written: `2026-07-16 00:55:54 BST`
- authenticated Investigations assault result: `5/5 passed`
- final branch `bash scripts/verify-mindlab.sh`: `PASS: 5 / FAIL: 1`
- final closeout verdict moved to `10-final-result-for-kay.md`
