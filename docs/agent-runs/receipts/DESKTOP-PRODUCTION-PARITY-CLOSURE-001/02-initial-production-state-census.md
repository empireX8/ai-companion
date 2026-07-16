# Initial Production State Census

## Recorded-state universe

- Source inventory denominator: `45`
- Inventory source:
  `docs/agent-runs/receipts/DESKTOP-REFERENCE-PARITY-PROVENANCE-AUDIT-001/01-reference-state-inventory.md`

## Exact initial provenance counts on the merged baseline

- `LIVE`: `12`
- `MIXED`: `7`
- `FALLBACK`: `8`
- `MOCK`: `1`
- `UNPROVEN`: `2`
- `INTENTIONAL EMPTY`: `0`
- `INTENTIONAL UNAVAILABLE`: `0`
- `EXPLICIT SAMPLE / REFERENCE`: `15`

## Exact initial row mapping

- `LIVE`
  - rows `20, 21, 27, 28, 35, 36, 39, 40, 41, 43, 44, 45`
- `MIXED`
  - rows `4, 12, 23, 24, 25, 29, 31`
- `FALLBACK`
  - rows `1, 5, 11, 22, 34, 37, 38, 42`
- `MOCK`
  - row `30`
- `UNPROVEN`
  - rows `32, 33`
- `EXPLICIT SAMPLE / REFERENCE`
  - rows `2, 3, 6, 7, 8, 9, 10, 13, 14, 15, 16, 17, 18, 19, 26`

## Confirmed pre-repair root causes present in the initial census

1. Production hybrid shell booted from a mock/reference base instead of an honest empty base.
2. Today depth gating rewrote live ids to reference ids `r6`, `r5`, and `r2`.
3. Production object lookup could resolve reference objects for live selections.
4. Direct route navigation could leave the shared shell page state stale.
5. Live rail/detail states could preserve reference arrays or sample reports when production arrays were empty or not ready.
6. Map detail hydration could suppress visible production rows even when the canonical list endpoint returned the live conclusion.
7. Browser authentication could fall through Clerk signed-out middleware rewrite and turn a protected production request into an HTML `404`.

## Final comparison target

For this campaign to close, the final matrix had to reduce `MIXED`, `FALLBACK`, `MOCK`, and `UNPROVEN` to `0` while preserving honest empty states and explicitly labelled reference-only states.
