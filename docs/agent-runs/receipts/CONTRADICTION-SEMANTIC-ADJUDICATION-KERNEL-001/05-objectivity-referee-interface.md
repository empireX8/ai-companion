# 05 — Objectivity Referee interface

## Status

| Item | Status |
|------|--------|
| Shared referee **interface** | Implemented |
| Shared AI Objectivity Referee | **Not implemented** |
| Auto-PASS / no-op production referee | **Prohibited / absent** |
| CEQR-001 default referee status | `not_run` |

## Outcome union

- `PASS`
- `PASS_WITH_LOWER_CONFIDENCE`
- `ROUTE_TO_DIFFERENT_OBJECT_TYPE`
- `REQUEST_MORE_EVIDENCE`
- `ABSTAIN`

## Input shape

proposed object type; validated semantic result; evidence summary; confidence; alternative interpretation; qualification/context; validation warnings.

## Hard boundary

Referee PASS (when later implemented) still cannot bypass deterministic span/schema validation.

This slice does **not** claim the shared AI Objectivity Referee now exists.
