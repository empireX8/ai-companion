# Authentication, Ownership, And Negative Proof

## Authentication lifecycle repair

- First proven intermittent Map `404` source:
  - Clerk middleware signed-out rewrite
  - route handler not entered
  - HTML `404` returned
- Correct repair layer:
  - browser authentication lifecycle
  - not the Map hook
- Standardized authenticated browser bootstrap:
  - real Clerk sign-in flow before protected navigation
  - browser-context cookies used only for Clerk dev bot-bypass support
  - auth preflight required both context-side and browser-side confirmation
- Temporary server-side diagnostics used during the Map `404` trace:
  - removed before final verification
  - preserved evidence remains only in receipt artifacts, not runtime logging

## Safe authenticated identity proof

- Safe probe route:
  - `GET /api/desktop-production-parity/auth-probe`
- Observed authenticated response shape:
  - status `200`
  - body `{"authenticated":true,"userId":"<fixture owner clerk user id>"}`
- Proof rule used before production journeys:
  - browser session authenticated
  - server-resolved user id matched expected fixture owner user id
  - no signed-out rewrite occurred

## Exact negative statuses observed

- unauthenticated investigation list:
  - `GET /api/investigations` -> `404`
- unauthenticated investigation detail:
  - `GET /api/investigations/cmrny5t7d000fqlichep227fs` -> `404`
- unauthenticated decision mutation:
  - `PATCH /api/actions/missing-action` -> `404`
- cross-user investigation detail:
  - `GET /api/investigations/cmrny5t7d000fqlichep227fs` from a different authenticated user -> `404`
- missing investigation:
  - `GET /api/investigations/missing-investigation-assault` -> `404`
- missing Explore message grounding:
  - `GET /api/explore/messages/missing-explore-message-assault/grounding` -> `404`
- malformed Explore message grounding:
  - `GET /api/explore/messages/%20/grounding` -> `400`
- cross-user Explore session list:
  - `GET /api/message/list?sessionId=a11ce001-ea01-4000-8000-000000000003` -> `404`

## Ownership result

- Production detail routes respected authenticated ownership boundaries.
- Cross-user ids did not resolve live detail.
- Missing ids did not fall back to reference objects.
- Unauthenticated production data was not exposed.
- Unauthorized mutation observed: `NONE`
