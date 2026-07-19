# 14 — Intermediate result (superseded)

Duplicate-section repair was an intermediate step. Human visual later failed because canonical Map omitted `profileFacts`.

Final closeout: `17-human-visual-pass.md` + `18-final-result-for-kay.md`.

## Honest intermediate root causes

1. Composition remaps `ctx-interests` → `dev-exact-rt-…-obj-ctx-interests`; first attach missed remapped id and appended a duplicate rail entry.
2. UI was then only on quarantined `orvek-v0/pages/map.tsx`; production uses `orvek-v0-canonical/pages/map.tsx`.
