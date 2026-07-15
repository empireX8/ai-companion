# 07 — Cross-surface ModelUpdate identity

## Status

**PASS**

Canonical ModelUpdate ID from final positive run:

`cmrm9fafw000tql65mitoswko`

Explore-side proposal ID from the same run:

`cmrm9eju4000sql65ttck9xdp`

Same ID asserted on:

- Explore publish UI / response
- `GET /api/what-changed/[id]`
- `GET /api/what-changed/[id]/evidence`
- `GET /api/model-updates`
- `GET /api/timeline/model-layers?window=30d`
- `GET /api/today/intelligence-updates`
- Idempotent publish retry (`idempotent: true`)

No `rep-*` / reference substitution.
