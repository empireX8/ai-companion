# Authentication, Ownership, And Negative Proof

## Exact live statuses observed on 2026-07-16

Unauthenticated:

- `GET /api/investigations` -> `404`
- `GET /api/investigations/:id` -> `404`
- `POST /api/investigations` -> `404`
- `PATCH /api/investigations/:id` update -> `404`
- `PATCH /api/investigations/:id` closure -> `404`

Cross-user:

- `GET /api/investigations` -> `200`
- `GET /api/investigations/:id` -> `404`
- `PATCH /api/investigations/:id` update -> `404`
- `PATCH /api/investigations/:id` closure -> `404`
- `POST /api/understanding/evidence-links` using another user's evidence -> `400`
- `POST /api/fieldwork` using another user's investigation -> `400`

Missing / malformed / invalid:

- `GET /api/investigations/missing-investigation-assault` -> `404`
- `POST /api/understanding/evidence-links` with missing evidence -> `400`
- `PATCH /api/fieldwork/missing-fieldwork-assault` -> `404`
- `POST /api/investigations` with `{}` -> `400`
- `PATCH /api/investigations/:id` malformed JSON -> `400`
- `PATCH /api/investigations/:id` malformed closure payload -> `400`
- `PATCH /api/investigations/:id` invalid `open -> resolved` transition -> `422`

## No unauthorized mutation proof

- cross-user list response excluded the primary user's investigation ID
- evidence-link count before and after cross-user / malformed attempts: unchanged
- fieldwork count before and after cross-user / malformed attempts: unchanged
- primary investigation status before and after negative assault: `open`
- primary investigation title before and after negative assault: unchanged
