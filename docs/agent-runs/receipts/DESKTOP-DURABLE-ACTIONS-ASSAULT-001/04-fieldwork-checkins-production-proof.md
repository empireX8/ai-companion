# 04 — Fieldwork / watch-for check-ins production proof

## Fixture

- Fieldwork assignment ID: `dev-durable-actions-assault-fieldwork`
- Prompt: `Watch for stop-point signal after meetings`
- Check-in note: `Durable assault check-in: noticed stop point after 4pm meeting.`
- Linked object: `pattern_claim` / `dev-durable-actions-assault-claim` (Watch For merge-ready)

## Browser journey (Playwright)

**Result: PASS** (final serial suite, ~51s)

Steps proven:

1. `GET /api/watch-for` (APIRequest + in-page `fetch`) includes fixture ID.
2. Remount via `recoverAfterReload` so hybrid Watch For overlay hydrates after auth cookies settle.
3. Explore → Fieldwork Bridge; exact parent prompt / live check-in controls (no reference prototype substitution).
4. Fill `durable-checkin-input`; submit; PATCH `/api/fieldwork/dev-durable-actions-assault-fieldwork` → **200**.
5. Write keeps status `active` so parent remains on Watch For (`assigned`/`active` only); observation stored in `observationNote`.
6. `durable-checkin-recorded` shows note on Bridge; Open fieldwork confirms Inspector hydration.
7. Reload → re-open Fieldwork Bridge → same parent + same recorded check-in.
8. `GET /api/fieldwork/{id}` returns exact parent id + observation note; status in `{assigned, active}`.
9. Idempotent PATCH retry → still one fieldwork row for user+id.
10. Cross-user PATCH → **401/404**.

## Product note

Check-in saves observation without completing the assignment. Completing would drop the row from public Watch For (`WATCH_FOR_VISIBLE_STATUSES`), which would replace the Bridge with reference UI after refresh.
