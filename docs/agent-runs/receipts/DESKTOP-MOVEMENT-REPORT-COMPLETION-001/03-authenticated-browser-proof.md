# 03 — Authenticated browser proof (positive)

## Authentication method

- Clerk Backend SDK (`@clerk/backend`): create ephemeral user + session
- Session JWT in `__session`
- Clerk Testing Token in `__clerk_db_jwt` (dev-only testing token — not a production auth bypass)
- `__client_uat` from session JWT `iat`
- Real local Next app at `http://localhost:3000`
- Local Postgres only: `postgresql://postgres:postgres@localhost:5432/companion`
- Fixture allow flag: `ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE=1` (refused outside local DB / production NODE_ENV)

## Suite

`scripts/movement-report-completion.playwright.ts`
Command: `npx playwright test scripts/movement-report-completion.playwright.ts`

Final green run: **3 passed (39.4s)**

## Runtime ModelUpdate IDs (final green positive journey)

| Role | ID |
|---|---|
| Claim (canonical live report) | `cmrkkfvdt0000qllgyqwta84s` |
| Conclusion fixture companion | `dev-movement-report-assault-conclusion-update` |

## Positive journey assertions

A. Open production Today (`/`) after intelligence-updates + movement-depth return 200
B. `today-full-report` visible with `data-report-id=cmrkkfvdt0000qllgyqwta84s`
C. `today-see-why` visible with `data-movement-id` matching the same ID
D. Overlay provenance text = `LIVE MODEL UPDATE REPORT`
E. Overlay shows before, after, authored rationale, cited evidence (`FIXTURE_SOURCE_TEXT`), canonical ID
F. See Why → Inspector `inspector-model-update-id` = same ID
G. Overlay → Open in Inspector → same ID
H. Timeline row `[data-testid=timeline-movement-row][data-movement-id=…]` visible; click → Inspector same ID
I. API proof with Cookie header: intelligence-updates, movement-depth (evidence quotes), `/api/what-changed/[id]`, `/evidence` all return the same ID
J. `rep-weekly` absent; reference sample control absent on production Today

## Not used (hard exclusions)

- Source-string scans as sole proof
- Adapter-only / mocked API / fake production data
- Unauthenticated browser for the production journey
- Reference route as the production journey
