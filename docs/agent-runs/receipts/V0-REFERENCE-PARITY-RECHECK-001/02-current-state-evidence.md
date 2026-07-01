# Current State Evidence

- `app/(root)/(routes)/context/page.tsx` now states that Mind Context is "a correctable model read, not a final conclusion about you" and exposes a `Capture correction` action.
- `app/(root)/(routes)/watch-for/page.tsx` links to `Active Questions` as a real related surface and does not mark it unavailable.
- `app/(root)/(routes)/active-questions/page.tsx` exists and renders the Active Questions surface directly.
- `lib/orvek-v0/production/map-api.ts` projects:
  - conclusions with evidence-backed inspector state
  - Mind Context items as `context_profile`
  - Model Goals as `model_goal`
  - safe context detail links only when they are v0-safe
  - blocked `/references/...` and `/patterns/...` context links as non-clickable detail hrefs
  - weak evidence as `Thin support` and `Provisional`
- `components/inspector/panels/SelectedObjectEvidencePanel.tsx` shows:
  - current read
  - evidence count
  - confidence / support language
  - linked-path availability
  - correction affordance with Capture Life Data handoff
  - no visible bracketed audit tags in the source
- `lib/orvek-adapters/map.ts`, `lib/orvek-v0/production/map-selection.ts`, and `components/orvek-workbench/OrvekMapPage.tsx` preserve selection across conclusion, Mind Context, and Model Goal rails.

