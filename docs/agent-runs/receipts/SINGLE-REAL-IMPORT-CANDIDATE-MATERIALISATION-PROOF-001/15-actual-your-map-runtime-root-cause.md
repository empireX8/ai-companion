# 15 — Actual `/your-map` runtime root cause

## Human observation (pre-repair)

After duplicate-section repair, Kay hard-refreshed `http://localhost:3000/your-map` and confirmed:

| Check | Result |
|-------|--------|
| Background / Context count = 5 | PASS |
| Exactly one Preferences / interests | PASS |
| Original Current understanding preserved | PASS |
| Original supporting evidence preserved | PASS |
| KNOWN PREFERENCES section | **ABSENT** |
| Accepted chicken-burger statement | **ABSENT** |

## Proven root cause

Production `/your-map` does **not** mount quarantined `components/orvek-v0/pages/map.tsx`.

Live path:

1. `your-map/page.tsx` → `OrvekMapPage` (voided by shell)
2. `OrvekWorkbenchShell` → `void children` → `CanonicalLiveRuntimeEntry`
3. `useOrvekHybridWorkbenchDataApi` fetches active ReferenceItems and calls `attachMapProfileFactsToDataApi` (**data layer OK**)
4. `buildCanonicalLiveRuntimeData` forwards enriched `getObject`
5. `CanonicalWorkbench` → **`components/orvek-v0-canonical/pages/map.tsx`**

The first profile-facts UI was wired only into the quarantined parallel Map. Canonical Map never read `obj.profileFacts`, so KNOWN PREFERENCES never appeared in the real browser.

## Exact loss point

**Render omission** in `components/orvek-v0-canonical/pages/map.tsx` (centre panel after Current understanding) — not attach, not fetch, not composition overwrite.
