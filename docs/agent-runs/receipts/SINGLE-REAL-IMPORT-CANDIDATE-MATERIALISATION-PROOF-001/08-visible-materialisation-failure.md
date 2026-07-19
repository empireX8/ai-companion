# 08 — Visible materialisation failure history

## Campaign conclusion progression

| Layer | After accept | After first UI repair | After duplicate fix | After canonical Map repair | Kay visual |
|-------|--------------|----------------------|---------------------|----------------------------|------------|
| Database materialisation | PASS | PASS | PASS | PASS | PASS |
| Provider delivery | PASS | PASS | PASS | PASS | PASS |
| Human-visible profile materialisation | FAIL (facts missing) | FAIL (duplicate Preferences section) | FAIL (canonical Map omitted KNOWN PREFERENCES) | READY | **PASS** |
| End-to-end product proof | NOT PASSED | NOT PASSED | NOT PASSED | Pending Kay | **PASS** |

## Failure 1 — facts missing

Active ReferenceItems were never nested into Preferences / interests centre panel.

## Failure 2 — duplicate Preferences section

Attach looked up only canonical `ctx-interests`, missed remapped densograph id, created a new shell with implementation-facing summary, appended a second rail entry (5 → 6).

## Failure 3 — wrong Map component

Duplicate repair + profile UI targeted quarantined `orvek-v0/pages/map.tsx`. Production `/your-map` mounts `orvek-v0-canonical/pages/map.tsx`, which omitted `profileFacts` until the final repair.

## Resolution

See `15-actual-your-map-runtime-root-cause.md`, `16-actual-runtime-repair.md`, `17-human-visual-pass.md`.
