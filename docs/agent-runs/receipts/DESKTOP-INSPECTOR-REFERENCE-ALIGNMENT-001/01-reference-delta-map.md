# Reference Delta Map

Accepted v0 reference traits:
- Inspector is a fixed right evidence panel with calm shell chrome.
- Inner sections use `px-5 pt-4` rhythm, not dense legacy blocks.
- Evidence and related-object rows are compact cards with `o-calm`, small radius, and restrained shadows.
- The tab panel reads like a designed readout, not a report dump.
- Movement uses structured before/after/readout cards and compact evidence rows.
- Correction actions sit in a quiet rounded callout after the evidence read.

Production state before this slice:
- The outer production Inspector shell already matched much of the v0 reference rail through `ProductionInspectorAside`.
- The inner Evidence / Context panel still had legacy residue: border header, `ml-material` cards, `px-4` section rhythm, and dense secondary-background blocks.
- The Mind Model Movement panel still had legacy card treatment, border-heavy header, bare evidence refs, `ml-material`, `ml-hairline`, and old loading blocks.
- Evidence trust structure from the previous repair was correct but visually patched onto the older inner panel grammar.

Deltas repaired:
- Object headers now use the reference-style top spacing, type pill, title rhythm, and local back banner.
- Evidence / Context sections now use reference section rhythm and quieter readout density.
- Supporting evidence rows now use compact reference cards instead of legacy material blocks.
- Related object rows now use reference-like icon/title/arrow rows.
- Correction controls retain the previous trust repair but align with the v0 rounded callout treatment.
- Mind Model Movement now uses reference section rhythm, compact cards, structured before/after blocks, and designed evidence-reference rows.
- Loading and unavailable states no longer use old dark placeholder blocks.

Deltas intentionally not repaired:
- Production route auth/session setup was not changed.
- No live owner-selection data fixture was added.
- No Today, Decisions, Capture, Watch For, Map center-panel, Explore, Timeline, branding, or mobile surface was changed.

