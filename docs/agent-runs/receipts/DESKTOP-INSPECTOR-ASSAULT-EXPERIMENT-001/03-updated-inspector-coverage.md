# Updated Inspector Coverage

## Totals

Coverage denominator: **35 type/subtype units**.

| PASS | PARTIAL | FAIL | UNPROVEN |
|---:|---:|---:|---:|
| **0** | **30** | **1** | **4** |

Baseline was `0 / 28 / 1 / 6`. Counts unchanged; **reasons strengthened** for the three live-hydrated families after authenticated runtime replay.

No unit reaches PASS because durable correction/outcome/check-in/report write paths remain deferred and full browser navigation replay was not recorded.

## Runtime vs code/test proof

| Proof type | Families covered |
|---|---|
| **Authenticated HTTP replay** | receipt, map-object/claim (conclusion), model-update — **3 families only** |
| **Behavior-level tests** | Tab contract, push/goBack navigation, provenance composition, reference fallback classification |
| **Code/test only (not HTTP/browser replayed)** | active-question, reference decision/report, missing selection, empty states |

## Reclassification

| # | Type / subtype | Result | Current reason |
|---:|---|---|---|
| 1 | receipt | PARTIAL | **Live HTTP + behavior composition** — depth-safe pointer hydrates; provenance `live`; actions deferred |
| 2 | decision | PARTIAL | Explicit `reference_fallback`; outcome writes deferred; **code/test only** |
| 3 | report / Weekly Report | PARTIAL | Explicit reference fallback; no live report object; **code/test only** |
| 4 | report / What Changed | PARTIAL | Same |
| 5 | report / Decision Review | PARTIAL | Same |
| 6 | report / Fieldwork Result | PARTIAL | Same |
| 7 | report / Receipts Resurfaced | PARTIAL | Same |
| 8 | report / Stress Test | PARTIAL | Same |
| 9 | report / Import Source | PARTIAL | Same |
| 10 | fieldwork | PARTIAL | Honest unsupported/deferred; check-in not durable |
| 11 | map-object / claim | PARTIAL | **Live HTTP + behavior composition** — conclusion hydrates at `dev-live-evidence-depth-conclusion` |
| 12 | map-object / conflict | PARTIAL | Production path active; correction deferred; no fresh conflict replay |
| 13 | map-object / loop | PARTIAL | Same pattern as claim; graph depth conditional |
| 14 | map-object / goal | UNPROVEN | No production subtype contract |
| 15 | map-object / active-question | UNPROVEN | Top-level question supported; subtype path absent |
| 16 | map-object / model-update | UNPROVEN | Top-level update supported; subtype path absent |
| 17 | map-object / context | UNPROVEN | Top-level context supported; subtype path absent |
| 18 | context / context | PARTIAL | Production Inspector active; capture correction only |
| 19 | model-goal / goal | PARTIAL | Production Inspector active; durable edit deferred |
| 20 | active-question | PARTIAL | Production rendering; resolve/fieldwork deferred; **code/test only** |
| 21 | model-update | PARTIAL | **Live HTTP + behavior composition** — `cmrjd6ntp0002qlq3n6hbkh4c` hydrates; honest empty before/after |
| 22 | investigation | FAIL | Enrichment gate still cannot pass normal live list broadly |
| 23 | timeline-event / Model Update | PARTIAL | Selected hydration path active; movement depth conditional |
| 24 | timeline-event / Decision | PARTIAL | Source adapter conditional; decision detail unsupported |
| 25 | timeline-event / Report | PARTIAL | Report fallback explicit |
| 26 | timeline-event / Capture | PARTIAL | Related mapping conditional |
| 27 | timeline-event / Receipt resurfaced | PARTIAL | Receipt depth gate conditional; **live depth path proven for fixture pattern** (HTTP) |
| 28 | timeline-event / Active Question updated | PARTIAL | Top-level question selection supported |
| 29 | timeline-event / Fieldwork created | PARTIAL | Detail/write incomplete |
| 30 | timeline-event / Import | PARTIAL | Import/report detail incomplete |
| 31 | timeline-event / Decision reviewed | PARTIAL | Linked claim conditional |
| 32 | timeline-event / Map update | PARTIAL | Conclusion hydration when ID resolves; **live conclusion HTTP-proven** |
| 33 | timeline-event / Receipt researched | PARTIAL | Receipt graph conditional |
| 34 | pattern_claim | PARTIAL | Production panel active; fixture claim `dev-live-evidence-depth-claim` materialized |
| 35 | contradiction_node | PARTIAL | Production panel in active tree; not replayed |

## Interpretation

The aggressive shared-capability approach is **validated**: one mount/selection/provenance boundary improved receipt, map conclusion, and model-update handling with authenticated runtime proof for **three** families and honest fallback for decision/report/missing states.

Two-week parity remains **credible with conditions** — durable writes, investigation gate, and report object contract still block broad PASS counts.

## Evidence quality note

**Source-string coverage** (panel wiring tests) is distinguished from **behavior-level coverage** (tab contract, navigation state, provenance composition). Closeout repairs added behavior tests; source-string assertions alone are insufficient for tab stability and push/goBack claims.
