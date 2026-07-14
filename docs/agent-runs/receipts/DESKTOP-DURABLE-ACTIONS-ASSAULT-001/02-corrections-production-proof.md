# 02 — Corrections production proof

## Fixture

- Conclusion ID: `dev-durable-actions-assault-conclusion`
- Title: `Durable actions assault correctable conclusion`
- Original assertion: `Original assertion: energy drops after meetings without a stop point.`
- Correction label: `This is wrong`

## Browser journey (Playwright)

**Result: PASS** (final serial run, ~52s)

Steps proven:

1. Seeded user-owned conclusion via `seedDurableActionsAssaultRuntimeFixture`.
2. Authenticated hybrid workbench at `/` (Clerk cookies + testing token).
3. Opened Map, selected conclusion by button name.
4. Clicked `durable-correction-chip-this-is-wrong`; PATCH returned **200**.
5. Map surface showed `durable-correction-recorded` with label before reload.
6. Full page reload + session stabilization (`recoverAfterReload`).
7. API poll confirmed `lastUserCorrectionLabel` and preserved `summary`.
8. Re-opened conclusion on Map; `durable-correction-recorded` visible on `orvek-v0-map-page`.

## API assertions (same run)

- `GET /api/user-map/conclusions/dev-durable-actions-assault-conclusion` → `item.summary` unchanged, `item.lastUserCorrectionLabel === "This is wrong"`.

## Lineage

- Original assertion remains in `summary`.
- Correction stored in `lastUserCorrectionLabel` / `lastUserCorrectionAt` / `correctionCount`.
- No ModelUpdate fabricated.

## Inspector

- Inspector panel also renders correction controls for selected conclusion; map-scoped assertions used in Playwright to avoid strict-mode duplicate locators.
