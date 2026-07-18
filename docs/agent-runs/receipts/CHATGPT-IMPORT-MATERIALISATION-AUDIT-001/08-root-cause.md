# 08 — Root cause

## Selected combination

**K — several failures exist across the chain**

With primary operational failure concentrated after storage/extraction:

| Letter | Applicable? | Notes |
|--------|-------------|-------|
| A archive stored but never analysed | **No** | 635 completed import derivation runs; 5,922 spans |
| B analysis jobs never created | **No** | Jobs exist and completed |
| C analysis ran but failed | **No** | 0 failed import derivation runs |
| D analysis ran but produced no candidates | **Partial** | Produced few: 29 refs + 25 contras; 7 patterns; vast majority filtered out |
| E candidates exist but never reviewed | **Yes** | All 54 ref/contra candidates still `candidate` |
| F reviewed but not materialised | **N/A / Yes for shell UI** | Shell “review” never persists; nothing to materialise from that UI |
| G receipts not converted to objects | **Partial** | Spans rarely become typed model objects; patterns did create claims |
| H objects exist but provenance/links lost | **No for sessions/messages**; **partial** for understanding objects (rare) |
| I objects exist but composition/providers don’t surface them | **Yes** | Real patterns/UM thinly represented; seed composition overlays presentation; Import review ignores DB candidates |
| J candidate-review button disconnected from real imported data | **Yes** | Feeds `dev-exact-rt-…-import-cand-ic*` seed candidates |
| Missing current-shell upload UI | **Not selected as primary** | Separate Capability D gap; archive already stored |

## Main post-import failure point

**Real import-derived candidates are not reviewed or materialised into the canonical Orvek model, and the shell Import control is wired to full-reference seed review data with non-persisting accept/reject — while aggressive extraction filters also leave most of the archive without candidates.**

In short: storage + extraction ran; **extrapolation into accepted, presented model objects largely did not.**

## Strongest evidence

1. Upload `cmp2ftxhj0000qlsyxi55jo20` complete → 640 / 18,582 with full provenance.
2. Diagnostics: 5,893/5,922 reference candidates rejected; 29 accepted — all still `candidate`.
3. Pattern batch did create 7 `active` PatternClaims (proves post-import jobs can write objects).
4. Composition `source=full_reference_round_trip_seed` with 67 objects + 4 seed importReview candidates; `refsInComposition=0`.
5. `ImportOverlay` accept/reject = local React state only; footer closes without writes.
6. Zero `internal_only` understanding candidates currently present; only one later promoted UM with import UEL linkage.

## What this is not

- Not “archive missing”.
- Not “backend ingestion deleted”.
- Not primarily “no upload button in current shell”.
