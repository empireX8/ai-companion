# 16 — Actual runtime repair

## Repair

Ported the profile-facts centre-panel block into the component actually used at runtime:

`components/orvek-v0-canonical/pages/map.tsx`

Behaviour:

- Renders **KNOWN PREFERENCES** beneath Current understanding when the selected object maps to Preferences / interests (or Constraints)
- Reads `obj.profileFacts` / `profileFactsHeading` from the hybrid-attached object graph
- Skips on `referenceSurface === true`
- Does not create a second rail section
- Does not overwrite summary / why / supporting / corrections / inspector metadata
- Does not fabricate ModelUpdates

## Supporting changes

- `lib/__tests__/your-map-runtime-profile-facts.test.ts` — actual `/your-map` shell chain + attach → canonical getObject path
- Wiring tests updated to assert **canonical** Map (production), not only quarantined parallel Map

## Honest failure chain (pre-PASS)

1. First UI repair created a **duplicate** Preferences / interests section (lookup by canonical `ctx-interests` only; remapped densograph id missed).
2. Duplicate repair fixed attach-by-identity, but the visible UI was still on an **unused/quarantined** Map component.
3. Actual `/your-map` canonical Map omitted rendering `profileFacts`.
4. Final repair added the fact block to the **canonical** Map used at runtime.
