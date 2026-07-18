# 34 — Import Review interaction gap

Authority: `/dev/orvek-v0-reference` → shared `components/orvek-v0/{top-bar,overlays,store}`

## Reference path

1. TopBar Import → `setOverlay("import")` (enabled when not production display)
2. Workbench `overlay === "import"` → `Overlays` → `ImportOverlay`
3. Subtitle from `getObject("imp-1").reportSummary`
   (`18,582 messages · 243 receipts · 18 objects · 7 questions.`)
4. Proposal cards from local `REFERENCE_IMPORT_CANDIDATES` (ic1–ic4)
5. Close: Escape / shell close / footer buttons → `setOverlay(null)`

## What works in the reference

| Control | Behaviour |
|---|---|
| Import button | Opens overlay |
| Overlay open/close | Works |
| Accept / Keep as receipt only | Local React state only (visual card state) |
| Footer counts | Derived from local decisions map |
| Save for later | **Closes only** — no persistence |
| Add N to model | **Closes only** — no model write |
| Escape key | **Dead** — OverlayShell has no Escape handler; close via X / footer |

## Live repair

- `OrvekDataApi.importReview` + composition `workbench.importReview`
- TopBar enables Import when batch present on production display
- `ImportOverlay` reads provider batch (referenceSurface still uses local fallback)
- Full-reference seed persists remapped candidates + `imp-1` source id
- No separate modal; no fixture injection after the composition API boundary
