# 29 — Exact fixture round-trip gate

Verdict: **EXACT ROUND-TRIP PASSED — PRODUCTION CAN REPRESENT CANONICAL CONTRACT**

Updated: `2026-07-18` after implementing Canonical Today Composition + Model Movement Report contracts (receipts 30–31).

Prior approximate twin pass (receipt 27) remains **rejected**. Report-card omission remains **retracted**.

Hard error: none
Today exact mismatches: **0**

Controlled timestamps (allowed): `reportGeneratedAt=2026-07-14T12:00:00.000Z`

See `31-canonical-data-contracts-implemented.md` and `step10-exact-round-trip-manifest.json`.

## Real-account boundary

| Contract | Status |
|----------|--------|
| Today composition + report + ordered movements/NOW/resurfaced | **representable and working** via seed → API → hybrid → live provider |
| Automatic composition generation for normal accounts | **not yet generated** |
| Map / Timeline / Explore dedicated composition payloads | densograph objects may be projected in Today composition; page-level payloads **not yet first-class** |
| Decision densograph via SurfacedAction alone | thinner than fixture; composition densograph covers Inspector for round-trip |

Automatic intelligence generation is a separate campaign.
