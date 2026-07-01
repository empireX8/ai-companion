# Current State Evidence

- `lib/orvek-v0/production/map-api.ts` already projects:
  - conclusions with evidence-linked inspector state
  - Mind Context items as `context_profile`
  - Model Goals as `model_goal`
  - safe clickable hrefs only for v0-safe Mind Context links
  - blocked `/patterns/...` context links removed from clickable `detailHref`
  - model goal evidence copy that avoids overclaiming
- `components/inspector/panels/SelectedObjectEvidencePanel.tsx` already renders:
  - current read
  - evidence count
  - confidence / support language
  - linked path availability
  - correction affordance
  - capture handoff copy into `Capture Life Data`
- `lib/mind-context-surface.ts` already produces weak and missing evidence language for pattern reads.
- Existing tests cover selector safety, selection wiring, blocked route behavior, and capture handoff.
- I added focused acceptance coverage for weak / missing evidence wording and the absence of bracketed audit tags in the evidence panel source.

