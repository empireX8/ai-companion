# Watch-For, Evidence, And Fieldwork Linkage

## Production linkage implementation completed in code

Files:

- `components/investigations/InvestigationDetailActions.tsx`
- `components/watch-for/WatchForCheckInCard.tsx`
- `app/(root)/(routes)/watch-for/[id]/page.tsx`
- `components/watch-for/WatchForInspectorAction.tsx`
- `lib/watch-for-surface.ts`

Production actions exposed:

- attach evidence to investigation via `POST /api/understanding/evidence-links`
- create watch-for via `POST /api/fieldwork`
- record fieldwork check-in via `PATCH /api/fieldwork/[id]`

Visible durable IDs added to production UI:

- investigation detail: `Investigation ID {id}`
- linked evidence cards: `Evidence ID {evidenceId}`
- linked fieldwork cards: `Fieldwork ID {fieldworkId}`
- watch-for detail page: `Fieldwork ID {id}`

## Deterministic local fixture IDs added for browser assault

File:

- `lib/investigations-assault-runtime-fixture.ts`

Exact seeded fixture IDs:

- primary evidence span: `dev-investigations-assault-evidence-primary`
- secondary evidence span: `dev-investigations-assault-evidence-secondary`
- cross-user evidence span: `dev-investigations-assault-evidence-cross`
- cross-user investigation: `dev-investigations-assault-cross-investigation`
- primary session: `dev-investigations-assault-session-primary`
- secondary session: `dev-investigations-assault-session-secondary`
- cross-user session: `dev-investigations-assault-session-cross`

## Linkage proof status

- Linkage investigation ID: `cmrmqgpuz000vqlcyyld7fl7r`
- Linkage evidence ID: `dev-investigations-assault-evidence-primary`
- Linkage evidence-link ID: `cmrmqgunh000wqlcyfcg7hynf`
- Linkage watch-for / fieldwork ID: `cmrmqhemr000xqlcybzz0kdh7`
- Linkage Inspector identity text: `Investigation ID cmrmqgpuz000vqlcyyld7fl7r`
- Linkage check-in note recorded: `Investigations assault check-in: the stop point only held once I named it before the next ask.`
- Closure investigation ID: `cmrmqj2ny000yqlcytelf8esv`
- Closure evidence ID: `dev-investigations-assault-evidence-secondary`
- Closure evidence-link ID: `cmrmqj8k1000zqlcy63w491ut`
- Closure watch-for / fieldwork ID: `cmrmqjvr00010qlcy87wigyl4`
