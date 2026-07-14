# DESKTOP-MOVEMENT-REPORT-COMPLETION-001 — Intake and Hard Definition of Done

**Branch:** `desktop-movement-report-completion-001`
**Baseline:** staging `@ a06e0c8` (`a06e0c8418fc86268efdfa033a85c69e0124eb29`)
**Mode:** final implementation + authenticated browser verification
**Permitted final verdicts:** `FULLY VERIFIED` | `FAIL`
**Forbidden:** `PASS WITH RISKS`, partial completion, accepted gaps

---

## Intake from assault residuals

Prior campaign `DESKTOP-MOVEMENT-REPORT-ASSAULT-001` left these hard leftovers:

1. Authenticated browser journey not proven
2. Overlay live-vs-reference labelling incomplete (zip `getObject` lookup)
3. `rep-weekly` still reachable from production Today aside / route intent
4. Hybrid shell merges parity-safe objects only — live Today view props not presented
5. Fixture seed retains rows (no cleanup)

---

## Hard definition of done

| # | Gate | Done means |
|---|---|---|
| 1 | Production report identity | One ModelUpdate ID across Today, Timeline, Inspector, overlay, `/api/what-changed/[id]` (+ evidence). No `rep-weekly` / zip / mock substitution on the production journey. |
| 2 | Explicit overlay provenance | Visible `LIVE MODEL UPDATE REPORT` vs `REFERENCE / SAMPLE REPORT` (not inferred from styling). |
| 3 | Real authenticated browser | Playwright + real local Next + Clerk session + local Postgres only. No mocked API / unauth / reference route for the production journey. |
| 4 | Positive journey | Seeded complete movement → Today → See Why → full report LIVE → Inspector same ID → Timeline same ID. |
| 5 | Negative journey | Sparse movement → See Why / full-report withheld → no fabricated after → no reference substitute → no misleading LIVE. |
| 6 | Inspector / overlay wiring | Selected ModelUpdate only; no global recent substitute; identity stable across Today↔Timeline. |
| 7 | Fixture lifecycle | Seed → identify → cleanup in finally → zero fixture rows remain. Reusable guarded cleanup. |
| 8 | Reference boundary | Reference report subtypes intentionally reference-route / SAMPLE labelled only. |
| 9 | Tests | Behavior + Playwright coverage for every gate above. |
| 10 | Verification | Full targeted + `verify-mindlab.sh`; only the seven known baseline Vitest failures allowed if unchanged on clean staging. |

**FULLY VERIFIED requires remaining movement/report blockers = `NONE`.**

---

## Explicit non-goals

- Broad page redesign
- Schema migration unless unavoidable
- Explore / Map / Decisions / Investigations work outside movement/report wiring
- Production-ready claim for the whole Orvek product
- Commit / push / PR
