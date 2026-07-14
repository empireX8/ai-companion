# 04 — Negative / sparse browser proof

## Fixture

`seedSparseOnlyMovementAssaultFixture` → sparse ModelUpdate ID:

`dev-movement-report-assault-sparse`

Sparse update is incomplete for full report depth (missing durable before-state / required report ingredients).

## Negative journey assertions (authenticated production UI)

Through Playwright on `/`:

| Assertion | Result |
|---|---|
| See Why for sparse ID withheld | `today-see-why[data-movement-id=sparse]` count = 0 |
| Full-report control for sparse ID withheld | `today-full-report[data-report-id=sparse]` count = 0 |
| No full-report control at all on sparse-only day | `today-full-report` count = 0 |
| No LIVE overlay | `report-overlay-provenance` count = 0; `LIVE MODEL UPDATE REPORT` count = 0 |
| No `rep-weekly` substitution | text count = 0 |
| No reference sample control on production | `reference-sample-report-control` count = 0 |
| Sparse not surfaced as a truthful movement row | `today-movement-row` for sparse ID count = 0 |

## Reference isolation (companion case)

`/dev/orvek-v0-reference` still shows `reference-sample-report-control` labelled `REFERENCE / SAMPLE REPORT` — intentionally reference-only, not used as a production substitute.
