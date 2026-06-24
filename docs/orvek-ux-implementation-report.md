# Orvek UX Implementation Report (Slices 1–10)

**Date:** 2026-06-24  
**Status:** Local commits only — not pushed  
**Product frame:** Orvek — Private Intelligence. Evidence-backed personal understanding: **capture → reveal → understand**.

---

## Scope

Slices 1–10 upgraded the Orvek workbench UX across shell, Inspector, and eight user-facing surfaces **without** new derivation engines, schema changes, or fake intelligence. Work was bounded to copy, hierarchy, re-entry wiring, and published-safe presentation of existing backend data.

### Commits included

| Commit | Slice | Summary |
|--------|-------|---------|
| `893938d` | 1 | Workbench shell + Inspector foundation |
| `023535f` | 2 | Orvek + Mind Model language alignment |
| `b1a9292` | 3 | Today re-entry hierarchy |
| `eb10b8c` | 4 | Map Mind Context foundation |
| `3967842` | 5 | Map movement + open questions previews |
| `c2d680a` | 6 | Fieldwork / Watch For surface |
| `84e51ad` | 7 | Decisions surface alignment |
| `0d49965` | 8 | What Changed report surface |
| `6270781` | 9 | Timeline semantic evolution polish |
| `c1d2d38` | 10 | Explore grounding polish |

---

## Product question — does the app coherently express the Orvek story?

**Yes, with known partial gaps.** After Slices 1–10, the integrated workbench reads as:

> Orvek turns real-life evidence into an inspectable Mind Model, shows what changed, explains why, and gives ways to re-enter through Today, Map, Fieldwork, Decisions, Timeline, What Changed, and Explore.

**Strengths**

- **Consistent Mind Model vocabulary** via `lib/trust-language.ts` and per-surface copy modules (`*-surface.ts`, `today-reentry.ts`).
- **Clear surface boundaries** — each primary/layer route has governed intro copy describing its role (not a generic feed, task list, or chatbot).
- **Published vs draft separation** — especially Explore (proposed strip above, published movement below) and What Changed / Timeline model layers (`user_visible` + `isMeaningful`).
- **Inspector as trust layer** — movement tab for `model_update`; evidence tab for pattern/conclusion/contradiction; unsupported types link to real pages (Timeline fieldwork, Explore review links).
- **Honest empty states** — no placeholder insights; copy explains what must happen before content appears.

**Partial gaps** (documented below, not blockers for this phase)

- Re-entry **footer links** exist on What Changed, Timeline, and Explore only — Today, Map, Fieldwork, and Decisions rely on nav + in-content hrefs instead.
- Shell layer nav label **“Watch For”** in `V1_LAYER_ROUTES` vs user-facing **“Fieldwork”** on the surface and global rail — intentional dual label, slightly inconsistent IA wording.
- **Active Questions** reachable via legacy nav and Today open-loops, not in re-entry footers.

---

## What changed by surface

### Workbench shell (Slice 1)

- `AppShell`, `GlobalRail`, `WorkbenchTopBar`, material styling (`ml-workbench.css`).
- Global rail: Today, Map, Decisions, Timeline, Explore + layer shortcuts (Reports → `/what-changed`, Fieldwork → `/watch-for`).

### Inspector (Slice 1 + wiring across slices)

- `InspectorContext`, `InspectorPanelRouter`, movement/evidence panels.
- Selectable types locked to: `usermap_conclusion`, `model_update`, `pattern_claim`, `contradiction_node`.
- Navigation clears cross-surface selection (`InspectorNavigationSync`).

### Today (Slice 3)

- Re-entry hierarchy: primary → attention → changes → fieldwork → open loops → receipts → capture.
- Movement preview with Inspector (`model_update` + movement tab).
- “View all” movement → `/what-changed`.

### Map / Your Map (Slices 4–5)

- Workbench list + detail pane; Mind Context sections.
- Movement + open questions previews; links to What Changed for full movement list.
- Inspector: `usermap_conclusion` from workbench.

### Fieldwork / Watch For (Slice 6)

- Orvek Fieldwork framing; active/assigned groups; detail evidence sections.
- Real `/watch-for/[id]` links; Inspector only for supported linked objects.

### Decisions (Slice 7)

- `/actions` presented as Decisions; stabilize/build tabs; outcome learning.
- Links to Fieldwork and Explore; pattern Inspector when `linkedClaimId` exists.

### What Changed (Slice 8)

- Report-style explanation layer: latest movement hero + earlier cards.
- Evidence for primary item only (when linked); re-entry footer.
- List-only (no `[id]` page); `user_visible` + `isMeaningful` filter.

### Timeline (Slice 9)

- Semantic evolution intro; rhythms/signals/evolution stream filters.
- Published movement merged into stream; fieldwork/investigations link to real pages.
- Explicit Inspector buttons; re-entry footer.

### Explore (Slice 10)

- “Think with your Mind Model” framing; grounding context panel.
- Proposed updates strip (draft/proposed badge) vs published movement strip (published badge).
- `ExploreInspectorAction` for supported types only; decision handoff from Decisions.

### Navigation / IA (`lib/v1-nav.ts`)

- Five primary surfaces + layer utilities + legacy support grouping.
- Regression tests in `lib/__tests__/nav-structure.test.ts`.

---

## User-facing product improvements

1. **Product truth preserved** — understanding engine, not therapy/productivity/journaling app framing on touched surfaces.
2. **Movement is explainable** — What Changed and Timeline show *what* shifted with user-facing summaries and linked objects.
3. **Trust boundaries visible** — draft/proposed vs published called out in Explore; no lifecycle/internal fields on public surfaces.
4. **Re-entry paths** — Today ↔ What Changed ↔ Map movement previews; footers on three layer surfaces; global rail for all primaries.
5. **Inspector consistency** — same object types and tabs across Today, Map, Timeline, What Changed, Explore, Decisions handoff.

---

## Data / API / schema changes

**None** across Slices 1–10. All surfaces continue to use existing endpoints and Prisma queries with established public-safe filters (`user_visible`, `isMeaningful`, non-candidate pattern/contradiction links, etc.).

---

## Safety boundaries preserved

| Check | Status |
|-------|--------|
| Draft/proposed/internal movement not shown as published | ✅ Explore review vs movement strips; API filters on model-updates route |
| No fake evidence, outcomes, reports, or Inspector types | ✅ Empty states honest; `INSPECTOR_SELECTABLE_OBJECT_TYPES` capped at four |
| Public/user-visible filters intact | ✅ Covered by route + page tests |
| No lifecycle/internal field leaks | ✅ Audit tests on surface modules and API JSON projections |
| Unsupported objects → real pages | ✅ Timeline `Link` when `parseSelectableObjectFromHref` null; fieldwork hrefs |

---

## QA findings (Slice 11)

### Issues found

1. **Re-entry footer coverage is uneven** — only What Changed, Timeline, Explore have explicit “Re-enter from” blocks. Other surfaces use section links and global nav. Not a bug; document as UX gap.
2. **IA label drift: Watch For vs Fieldwork** — `V1_LAYER_ROUTES` label “Watch For”; surface title “Fieldwork”; rail label “Fieldwork”. Consistent enough for users but not in one constant.
3. **Explore re-entry omits Decisions** — Timeline includes `/actions`; Explore does not. Low impact.
4. **What Changed re-entry omits Explore and Decisions** — links Today, Map, Timeline, Fieldwork only.

### Issues fixed in Slice 11

- **None required.** No integration bugs or copy violations warranting code change in touched surfaces.
- Added **`lib/__tests__/orvek-ux-integration.test.ts`** for cross-surface re-entry, Inspector safety, and Today→What Changed bridge regression.

---

## Known gaps (intentionally out of scope)

- Full **decision lifecycle** (rich outcome workflows beyond current actions API).
- **Fieldwork** still maps to Watch For / fieldwork assignment model — no dedicated new object model.
- **What Changed** is a report-style *surface*, not a scheduled/generated report engine (no PDF/email/weekly jobs).
- **Timeline** polished semantically — not redesigned, no calendar view.
- **Explore grounding logic** unchanged; copy and draft/published boundaries only.
- **Mobile parity** not addressed.
- **Commits local only** — push/merge when Kay approves.

---

## Test coverage (integrated behaviour)

Existing meaningful coverage:

- `lib/__tests__/nav-structure.test.ts` — IA
- `lib/__tests__/today-reentry.test.ts` — Today hierarchy + safety
- `lib/__tests__/inspector-selection.test.ts` + `inspector-surface-wiring.test.ts` — Inspector contract
- `lib/__tests__/what-changed-surface.test.ts`, `phase3-what-changed-page.test.ts` — movement list safety
- `lib/__tests__/timeline-surface*.test.ts` — evolution stream
- `lib/__tests__/explore-*.test.ts` — draft vs published separation
- `lib/__tests__/your-map-*.test.ts`, `watch-for-surface.test.ts`, `decisions-surface.test.ts`
- `lib/__tests__/trust-language.test.ts` — banned terms

Added in Slice 11:

- `lib/__tests__/orvek-ux-integration.test.ts` — cross-surface re-entry + Inspector + surface module guards

---

## Verification run (Slice 11)

```bash
git diff --check
npx vitest run lib/__tests__/orvek-ux-integration.test.ts  # + full suite via verify script
npx tsc --noEmit
npm run build
bash scripts/verify-mindlab.sh
```

All checks passed at report time.

---

## Recommended next phase

1. **Push + human QA pass** on local commit stack in a running dev environment (shell rail, Inspector, each surface empty/populated states).
2. **Re-entry cohesion** (optional small slice) — shared `ORVEK_REENTRY_LINKS` helper or consistent footers on Map/Decisions/Fieldwork if product wants symmetric cross-linking.
3. **Today surface cohesion** — align any remaining section labels with global Fieldwork/Reports naming if IA label drift becomes user-visible confusion.
4. **Decision lifecycle** — when backend phase allows, without reframing as task management.
5. **Engineering ledger closeout** — `docs/engineering-ledger.md` entry for Slices 1–10 when Kay requests.

---

## Ready to commit?

**Slice 11 deliverables only:** `docs/orvek-ux-implementation-report.md` + `lib/__tests__/orvek-ux-integration.test.ts` are new/uncommitted. Safe to commit as a QA/report slice after review. **Slices 1–10 are already committed locally** and verification-clean; ready for push when instructed — not pushed in this slice.
