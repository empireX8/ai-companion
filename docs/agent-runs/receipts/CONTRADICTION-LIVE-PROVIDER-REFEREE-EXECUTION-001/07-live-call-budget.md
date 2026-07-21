# 07 — Live call budget (corrected)

## Caps

| Cap | Value |
|---|---|
| Max total provider attempts | 8 |
| maxRetries (both roles) | **0** |
| Native AI SDK timeout | validated `timeoutMs` (default 45000) |
| Synthetic cases | 3 |
| Retries to force classification | none |

Because `maxRetries: 0`, one `StructuredModelRunner` invocation equals one
underlying provider attempt. Receipt fields may therefore be called
provider-attempt counts.

## Observed corrected live run

| Metric | Value |
|---|---|
| Adjudicator attempts | 3 |
| Referee attempts | 0 |
| Total | 3 |
| Budget remaining | 5 |

Referee was not reached: every case failed closed at adjudication validation
with unmodified provider output.
