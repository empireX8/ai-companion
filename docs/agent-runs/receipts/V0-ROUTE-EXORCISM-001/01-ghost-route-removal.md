# Route Boundary Repair

## Implementation

- Added a narrow legacy-public route block in [`middleware.ts`](/Users/user/ai-companion/middleware.ts).
- Preserved internal/dev routes so they are no longer caught by the exorcism boundary.
- Left old component files intact for hidden imports.
- Added a Playwright smoke harness at [`scripts/v0-route-smoke.spec.ts`](/Users/user/ai-companion/scripts/v0-route-smoke.spec.ts).
- Added Playwright config at [`playwright.config.ts`](/Users/user/ai-companion/playwright.config.ts).
- Added `@playwright/test` to [`package.json`](/Users/user/ai-companion/package.json) and the lockfile so the smoke test can run locally.

## Route categories

| Category | Route | Reason |
|---|---|---|
| `V0_PUBLIC_ALLOWED` | `/` | Live Today / Re-entry surface. |
| `V0_PUBLIC_ALLOWED` | `/journal-chat` | Live Capture surface. |
| `V0_PUBLIC_ALLOWED` | `/what-changed` | Live Reports surface. |
| `V0_PUBLIC_ALLOWED` | `/explore` | Live Explore / Analytical Log surface. |
| `V0_PUBLIC_ALLOWED` | `/your-map` | Live Map surface. |
| `V0_PUBLIC_ALLOWED` | `/timeline` | Live Timeline surface. |
| `V0_PUBLIC_ALLOWED` | `/watch-for` | Live Fieldwork surface. |
| `V0_PUBLIC_ALLOWED` | `/actions` | Live Decisions / Outcomes surface. |
| `LEGACY_PUBLIC_BLOCKED` | `/help` | Ghost public UI; not part of the v0 target set. |
| `LEGACY_PUBLIC_BLOCKED` | `/chat` | Ghost public UI; superseded by `/journal-chat`. |
| `LEGACY_PUBLIC_BLOCKED` | `/journal` | Ghost public UI; not part of the v0 target set. |
| `LEGACY_PUBLIC_BLOCKED` | `/patterns` | Ghost public UI; not part of the v0 target set. |
| `LEGACY_PUBLIC_BLOCKED` | `/history` | Ghost public UI; not part of the v0 target set. |
| `LEGACY_PUBLIC_BLOCKED` | `/contradictions` | Ghost public UI; not part of the v0 target set. |
| `LEGACY_PUBLIC_BLOCKED` | `/check-ins` | Ghost public UI; not part of the v0 target set. |
| `LEGACY_PUBLIC_BLOCKED` | `/active-questions` | Ghost public UI; not part of the v0 target set. |
| `LEGACY_PUBLIC_BLOCKED` | `/library` | Ghost public UI; not part of the v0 target set. |
| `LEGACY_PUBLIC_BLOCKED` | `/settings` | Ghost public UI; not part of the v0 target set. |
| `LEGACY_PUBLIC_BLOCKED` | `/account` | Ghost public UI; not part of the v0 target set. |
| `LEGACY_PUBLIC_BLOCKED` | `/import` | Ghost public UI; not part of the v0 target set. |
| `LEGACY_PUBLIC_BLOCKED` | `/context` | Ghost public UI; not part of the v0 target set. |
| `LEGACY_PUBLIC_BLOCKED` | `/memories` | Ghost public UI; not part of the v0 target set. |
| `LEGACY_PUBLIC_BLOCKED` | `/projections` | Ghost public UI; not part of the v0 target set. |
| `LEGACY_PUBLIC_BLOCKED` | `/references` | Ghost public UI; not part of the v0 target set. |
| `LEGACY_PUBLIC_BLOCKED` | `/audit` | Ghost public UI; not part of the v0 target set. |
| `LEGACY_PUBLIC_BLOCKED` | `/evidence` | Ghost public UI; not part of the v0 target set. |
| `LEGACY_PUBLIC_BLOCKED` | `/metrics` | Ghost public UI; not part of the v0 target set. |
| `INTERNAL_OR_DEV_PRESERVED` | `/internal/user-map/review` | Operational internal review tool; preserve unless explicitly retired. |
| `INTERNAL_OR_DEV_PRESERVED` | `/dev/orvek-v0-reference` | Development reference tool; preserve unless explicitly retired. |

## Exact route cut

Blocked public ghost routes:

- `/help`
- `/chat`
- `/journal`
- `/patterns`
- `/history`
- `/contradictions`
- `/check-ins`
- `/active-questions`
- `/library`
- `/settings`
- `/account`
- `/import`
- `/context`
- `/memories`
- `/projections`
- `/references`
- `/audit`
- `/evidence`
- `/metrics`

Preserved internal/dev routes:

- `/internal/user-map/review`
- `/dev/orvek-v0-reference`

Retained v0 routes:

- `/`
- `/journal-chat`
- `/what-changed`
- `/explore`
- `/your-map`
- `/timeline`
- `/watch-for`
- `/actions`

Retained v0 support routes:

- `/your-map/[id]`
- `/watch-for/[id]`

## Verification

- `git diff --check` - PASS
- `npx tsc --noEmit` - PASS
- `npx playwright test scripts/v0-route-smoke.spec.ts` - PASS
- `npm run build` - PASS

## Smoke expectations

- V0 public route smoke: 8 routes mounted.
- Legacy public ghost route smoke: 18 routes returned 404.
- Internal/dev preservation smoke: `/internal/user-map/review` was preserved by middleware and returned a normal page-level 404 under the default local reviewer allowlist; `/dev/orvek-v0-reference` mounted successfully.

## Command to inspect

- `npx playwright test scripts/v0-route-smoke.spec.ts`
