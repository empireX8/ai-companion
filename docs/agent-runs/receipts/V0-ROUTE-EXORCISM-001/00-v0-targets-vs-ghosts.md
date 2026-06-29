# V0 Route Policy Intake

- Repo: `/Users/user/ai-companion`
- Base branch: `staging`
- Working branch: `v0-route-exorcism-001`
- Slice: public v0 route exorcism with internal/dev preservation

## Route categories

| Category | Route | Reason |
|---|---|---|
| `V0_PUBLIC_ALLOWED` | `/` | Today / Re-entry is a live v0 surface. |
| `V0_PUBLIC_ALLOWED` | `/journal-chat` | Capture is a live v0 surface. |
| `V0_PUBLIC_ALLOWED` | `/what-changed` | Reports is a live v0 surface. |
| `V0_PUBLIC_ALLOWED` | `/explore` | Explore / Analytical Log is a live v0 surface. |
| `V0_PUBLIC_ALLOWED` | `/your-map` | Map is a live v0 surface. |
| `V0_PUBLIC_ALLOWED` | `/timeline` | Timeline is a live v0 surface. |
| `V0_PUBLIC_ALLOWED` | `/watch-for` | Fieldwork is a live v0 surface. |
| `V0_PUBLIC_ALLOWED` | `/actions` | Decisions / Outcomes is a live v0 surface. |
| `LEGACY_PUBLIC_BLOCKED` | `/help` | Old public UI help page; not part of the v0 spine. |
| `LEGACY_PUBLIC_BLOCKED` | `/chat` | Legacy public chat entrypoint; replaced by `/journal-chat`. |
| `LEGACY_PUBLIC_BLOCKED` | `/journal` | Legacy journal surface; not part of the v0 capture path. |
| `LEGACY_PUBLIC_BLOCKED` | `/patterns` | Legacy patterns UI; not part of the v0 surface set. |
| `LEGACY_PUBLIC_BLOCKED` | `/history` | Legacy history page; not part of the v0 surface set. |
| `LEGACY_PUBLIC_BLOCKED` | `/contradictions` | Legacy contradictions page; not part of the v0 surface set. |
| `LEGACY_PUBLIC_BLOCKED` | `/check-ins` | Legacy check-ins page; not part of the v0 surface set. |
| `LEGACY_PUBLIC_BLOCKED` | `/active-questions` | Legacy questions page; not part of the v0 surface set. |
| `LEGACY_PUBLIC_BLOCKED` | `/library` | Legacy library page; not part of the v0 surface set. |
| `LEGACY_PUBLIC_BLOCKED` | `/settings` | Legacy settings page; not part of the v0 surface set. |
| `LEGACY_PUBLIC_BLOCKED` | `/account` | Legacy account page; not part of the v0 surface set. |
| `LEGACY_PUBLIC_BLOCKED` | `/import` | Legacy import page; not part of the v0 surface set. |
| `LEGACY_PUBLIC_BLOCKED` | `/context` | Legacy context page; not part of the v0 surface set. |
| `LEGACY_PUBLIC_BLOCKED` | `/memories` | Legacy memories page; not part of the v0 surface set. |
| `LEGACY_PUBLIC_BLOCKED` | `/projections` | Legacy projections page; not part of the v0 surface set. |
| `LEGACY_PUBLIC_BLOCKED` | `/references` | Legacy references page; not part of the v0 surface set. |
| `LEGACY_PUBLIC_BLOCKED` | `/audit` | Legacy audit page; not part of the v0 surface set. |
| `LEGACY_PUBLIC_BLOCKED` | `/evidence` | Legacy evidence page; not part of the v0 surface set. |
| `LEGACY_PUBLIC_BLOCKED` | `/metrics` | Legacy metrics page; not part of the v0 surface set. |
| `INTERNAL_OR_DEV_PRESERVED` | `/internal/user-map/review` | Operational internal review surface; auth-gated and not public ghost UI. |
| `INTERNAL_OR_DEV_PRESERVED` | `/dev/orvek-v0-reference` | Development reference surface; keep alive unless explicitly retired. |

## Target spine

Kept as live browser surfaces:

- `/`
- `/journal-chat`
- `/what-changed`
- `/explore`
- `/your-map`
- `/timeline`
- `/watch-for`
- `/actions`

Kept as supporting permalink routes for the v0 surfaces:

- `/your-map/[id]`
- `/watch-for/[id]`

## Notes

- Old component files were left in place.
- API routes, Next internals, static assets, auth, and internal tooling were not changed.
- `package.json` and `package-lock.json` changed because the smoke harness needs `@playwright/test`.
