# 24 — Semantic twin live contract gate

> **RETRACTED (2026-07-18):** Comparison was invalid.
> Kay found: (1) `/dev/orvek-v0-canonical-live` escaped into `/` on navigation,
> (2) blank icon+arrow action card with no label, (3) Recent Model Movement
> populated on one side and empty on the misaligned compared state.
>
> See `27-semantic-twin-isolated-equivalence.md` for the isolation-fixed gate.
>
> Original verdict below is **not** authoritative.

Verdict: ~~SEMANTIC TWIN PASSED — LIVE PROVIDER MATCHES REFERENCE CONTRACT~~ **RETRACTED**

No hard fail reason recorded.

## Scope
- Fixture: `/dev/orvek-v0-canonical-reference`
- Live: `/dev/orvek-v0-canonical-live` with semantic-twin seeded account
- Presentation unchanged; repairs limited to live-provider / hydration / MU compose

## Seed
- Prefix: `dev-semantic-twin`
- User: `user_3GfsC3U59zEc1FzcOYadDRpM1rS` / `semantic-twin-primary-1784373826231@example.com`
- ModelUpdates: `dev-semantic-twin-user_3GfsC3U59zEc1FzcOYadDRpM1rS-model-update-mu-1`, `dev-semantic-twin-user_3GfsC3U59zEc1FzcOYadDRpM1rS-model-update-mu-2`, `dev-semantic-twin-user_3GfsC3U59zEc1FzcOYadDRpM1rS-model-update-aq-1-movement`
- KEEP_SEED: `true`

## Checks
- **today-briefing-title** (Today initial): `PASS` — Live briefing uses movement-count headline
- **today-semantic-titles** (Today initial / NOW / movements): `PASS` — Today shows core twin titles (3/16 global hits so far)
- **inspector-evidence** (Evidence / Context): `PASS` — Inspector Evidence/Context sections present
- **linked-navigation** (Linked object): `PASS` — MU Evidence receipt LinkedRow navigable
- **back-restoration** (Back): `PASS` — Back control restored prior selection path
- **model-movement** (Model Movement): `PASS` — Movement tab shows movement content
- **report-overlay** (Report overlay): `PASS` — Report overlay opened on live identity
- **map-composition** (Map): `PASS` — Map rails + twin object titles present
- **decisions** (Decision): `PASS` — Decisions rail populated
- **active-questions** (Active Question): `PASS` — Active Questions show twin titles
- **investigations** (Investigation): `PASS` — Investigations show twin content
- **explore-free** (Explore): `PASS` — Free Explore does not show fixture conversation
- **timeline** (Timeline): `PASS` — Timeline groups present (projected, not densograph t1–t14)

## Notes
- Seeded twin for user_3GfsC3U59zEc1FzcOYadDRpM1rS; MUs=dev-semantic-twin-user_3GfsC3U59zEc1FzcOYadDRpM1rS-model-update-mu-1,dev-semantic-twin-user_3GfsC3U59zEc1FzcOYadDRpM1rS-model-update-mu-2,dev-semantic-twin-user_3GfsC3U59zEc1FzcOYadDRpM1rS-model-update-aq-1-movement; reportCandidate=dev-semantic-twin-user_3GfsC3U59zEc1FzcOYadDRpM1rS-model-update-mu-1
- Semantic title hits on last live body sample: 3; missing sample: Let it express itself visually before design., You often need visual expression before locking architecture., Speed vs depth, Scope reopening under uncertainty, Build Orvek into a private intelligence system, Does public visibility trigger overbuilding?, Does visual prototyping reduce architecture uncertainty?, Which features are essential for first public value?
- Fixture baseline captured: true
- KEEP_SEED: user=user_3GfsC3U59zEc1FzcOYadDRpM1rS email=semantic-twin-primary-1784373826231@example.com password=Twin-1784373826231-Aa1!. Cleanup: SEMANTIC_TWIN_CLEANUP=1

## Real-account diagnosis (post-twin)
Anything still absent on a real populated account after twin PASS should be classified as intelligence/persistence gaps (not observed / not generated / not linked / insufficient evidence), not as provider presentation defects.
