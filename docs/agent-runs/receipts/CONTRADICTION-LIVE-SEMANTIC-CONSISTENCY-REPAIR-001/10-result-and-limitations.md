# 10 — Result and limitations

## Classification

`PASS_OFFLINE_SEMANTIC_CONSISTENCY_REPAIR_READY_FOR_NEW_LIVE_PROOF`

(Updated after final proof-completeness correction: real controlled-natural-entry
writer-block proof, exact CEQR-017 hash equality, nonblank abstention pattern
emission, and restored full-suite comparison.)

## Means

- Offline structural transport contract repaired (schema-v3) — preserved
- Mid-word truncation, surrogate-pair splitting, and the documented
  combining-mark boundary cases are blocked. This is not full UAX #29 grapheme
  segmentation or complete semantic adequacy.
- Source-authority invariants intact
- Controlled natural entry with injected deps proves writer never invoked on the
  CEQR-017 truncated Side-B span (0–27)
- Focused + contradiction-sweep + full-suite comparison complete
- A separately authorised future live proof may now be designed

## Does not mean

- Live semantic proof obtained
- Provider behaviour proven repaired in production calls
- Writer authorised
- Real-account persistence authorised
- Whole product / production ready
- Complete semantic evidence adequacy solved

## Limitations

1. Lexical boundary integrity is not proposition support.
2. No live provider call was executed in this slice.
3. CEQR-017 claim must not be reused; any future live proof needs a new claim.
4. Combining-mark policy is the narrow attachment rule documented in
   `05-evidence-span-boundary-contract.md` — not a full Unicode grapheme-cluster
   segmentation implementation (UAX #29).
5. `npm run build` was not rerun in the final proof correction. The earlier known
   Stripe page-data failure (missing apiKey/authenticator) was observed before the
   Unicode correction and is unrelated to this slice.
