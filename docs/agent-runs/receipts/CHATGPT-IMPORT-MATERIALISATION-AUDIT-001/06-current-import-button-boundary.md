# 06 — Current Import button boundary

## Expected conceptual distinction

| Surface | Intended job |
|---------|--------------|
| Current canonical-shell **Import** button | **Candidate review** |
| Historical `/import` upload page | Archive **ingestion** (Capability A) |
| Future canonical upload UX | Capability D — **out of scope** |

## Trace (canonical shell)

| Concern | Finding |
|---------|---------|
| Component | `components/orvek-v0/top-bar.tsx` (`data-testid="orvek-import-button"`) |
| Handler | `setOverlay("import")` when enabled |
| Enable gate (production display) | `importReview.candidates.length > 0` **and** `importReview.sourceObjectId` set |
| Overlay | `ImportOverlay` in `components/orvek-v0/overlays.tsx` |
| Provider field | `OrvekDataApi.importReview` via `useOrvekData()` |
| API / data source | Hybrid/today APIs read `CanonicalTodayComposition.payload.workbench.importReview` — **not** a live query of `ReferenceItem` / contradiction / dark-engine candidates |
| What populates the modal on Kay’s account | **Seeded** batch: 4 candidates `dev-exact-rt-…-import-cand-ic1..ic4`; `sourceObjectId=dev-exact-rt-…-obj-imp-1` |
| Performs archive ingestion? | **No** |
| Only reviews existing candidates? | Reviews **composition/fixture-shaped** candidates only; **does not** load the 29 real `ReferenceItem` candidates |
| Accept/reject persist? | **No** — `useState` only; footer “Add N to model” / “Save for later” call `onClose` |
| Reviewed candidates materialise into model? | **No** |
| Retain ChatGPT conversation/message provenance? | Overlay writes nothing. Real import path retains `Message` + session provenance independently |

## Implementation contradiction?

**Partial contradiction with product language, not with the upload-vs-review distinction:**

- Conceptually the button is review-only — **matches** expected “not an uploader”.
- Operationally it reviews **seed densograph candidates**, not **import-derived DB candidates** — contradiction with the implication that Import reviews *Kay’s imported intelligence*.
- Copy says nothing enters the model until accept — but accept **does not** enter the model either (local state only). Documented previously in `DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001/34-import-review-interaction.md`.

## Contrast: real archive upload

| Item | Path |
|------|------|
| Page | `app/(root)/(routes)/import/page.tsx` |
| Reachability | Middleware 404 (`/import` in legacy blocked prefixes) |
| APIs | `/api/upload/*` still live |

## Classification

Current Import button = **candidate-review UI shell**, currently **seed-fed and non-persisting** — not archive ingestion, and not wired to real import candidates.
