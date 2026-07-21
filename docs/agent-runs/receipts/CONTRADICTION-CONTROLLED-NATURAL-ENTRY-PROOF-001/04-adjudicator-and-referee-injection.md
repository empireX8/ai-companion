# 04 — Adjudicator and referee injection

## Separate dependencies

| Role | Interface | Injection |
| --- | --- | --- |
| First adjudicator | `StructuredModelRunner` | `input.modelRunner` |
| Second referee | `ObjectivityReferee` | `input.objectivityReferee` |

Orchestrator wraps each with call counters (`adjudicatorCallCount`, `refereeCallCount`).

Tests prove both are independently invoked on Class A success.

## Deterministic fixtures

Test doubles return controlled structured outputs.
They are **not** live AI judgments and must not be labelled as such.

## Live Objectivity Referee

Still absent. CEQR-010 only proves the executable injection + validation boundary.
