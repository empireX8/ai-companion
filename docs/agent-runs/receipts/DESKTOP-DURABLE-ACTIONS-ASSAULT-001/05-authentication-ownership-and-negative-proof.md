# 05 — Authentication, ownership, and negative proof

## Authentication method

- Clerk Backend SDK: ephemeral user + session JWT per suite (`beforeAll`).
- Clerk testing token → `__clerk_db_jwt` cookie.
- Cookies injected: `__session`, `__clerk_db_jwt`, `__client_uat`.
- Local Postgres only: `postgresql://postgres:postgres@localhost:5432/companion`.
- Fixture gate: `ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE=1`.
- Session helpers: `refreshSessionToken()`, `refreshAuthCookies()`, `stabilizeAuthenticatedSession()` (nav shell + APIRequest + **in-page** authenticated `fetch`), `recoverAfterReload()` (token refresh before/after reload + sign-in recovery).

## Exact negative status codes (observed)

Evidence from closeout capture re-run (`decision outcome|fieldwork|negative proof` → **3/3 passed**), statuses logged from live responses:

| Case | Exact HTTP status |
|---|---|
| Unauthenticated PATCH conclusion | **404** |
| Missing parent fieldwork PATCH | **404** |
| Malformed JSON PATCH conclusion | **400** |
| Cross-user PATCH conclusion | **404** |
| Cross-user PATCH decision | **404** |
| Cross-user PATCH fieldwork | **404** |

## Other negative proof (same negative journey)

| Case | Result |
|---|---|
| Simulated PATCH **500** on correction | UI `durable-action-error`; no `durable-correction-recorded`; still absent after reload |
| No fallback object receives action | Map re-open shows no recorded correction after failed write |
| No unrelated movement claimed | Journey limited to ownership/auth reject paths |

## Parent-ID storage contract

- **Corrections** mutate the exact parent `UserMapConclusion` (`dev-durable-actions-assault-conclusion`) via `lastUserCorrection*` fields — no separate child action ID.
- **Fieldwork check-ins** mutate the exact parent `FieldworkAssignment` (`dev-durable-actions-assault-fieldwork`) via `observationNote` (status `active`) — no separate child action ID.
- **Decision outcomes** mutate the exact parent `SurfacedAction` row whose runtime id was `cmrl2j3kv0000qloo4k0zisi3` in the evidence capture — outcome written to `status` + `note` on that row.

## Suite agreement

- Playwright durable assault: **5/5** in final serial verification run; closeout evidence capture **3/3** on decision/fieldwork/negative.
- Fixture cleanup (final serial): deleted 1/1/1; remaining **0/0/0**.
- Remaining durable-action blockers: **NONE**.
