# 01 Explore Tab Visual Regression Plan

**Slice:** `DESKTOP-REFERENCE-INTEGRITY-AUDIT-001` (follow-on)  
**Branch audited:** `staging`  
**Classification:** VISUAL REGRESSION / REFERENCE INTEGRITY BREACH  
**Mode:** Audit + fix plan only — no runtime changes in this slice

---

## Product-owner finding

Explore sub-tabs (Free Explore / Investigations / Active Questions / Fieldwork Bridge) render as a **dark pill / segmented control** (`o-sunken` container + raised active chip). Product owner does **not** accept this. Accepted design is a **clean underline tab switcher**: plain text tabs with an active underline, no heavy pill container, closer to original v0 prototype intent.

---

## 1. Which file defines Explore tab strip styling?

**Primary (live):** `components/orvek-v0/pages/explore.tsx` — `ExplorePage()` lines **47–64**

```tsx
{/* segmented control */}
<div className="o-sunken mt-3 inline-flex flex-wrap gap-0.5 rounded-[9px] p-1">
  {TABS.map((t) => (
    <button
      className={cn(
        "o-calm rounded-[6px] px-3 py-1.5 text-[13px] font-medium",
        tab === t.id
          ? "bg-card text-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.16)]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
```

**Supporting CSS:** `app/styles/orvek-workbench.css` — `.o-sunken` (dark inset background)

**Legacy duplicate (quarantined, not root path):** `components/orvek-workbench/views/V0ExploreView.tsx` — identical pill markup (used by orphaned `OrvekExplorePage` route page)

**Tracked snapshot (also pill, not underline):** `.reference/v0-orvek-workbench/components/orvek/pages/explore.tsx` lines 38–55

---

## 2. Which commit/slice changed underline → pill?

### Git finding: pill predates all production-data bridge slices

| Commit | Date | What changed for tab strip |
|--------|------|----------------------------|
| **`e15e738`** — *Invert Orvek UI onto v0 component family* | 2026-06-25 | **Introduced pill strip** in initial `V0ExploreView` inside `explore.tsx` |
| **`35e2b92`** — *Preserve v0 production layouts for empty states* | 2026-06-26 | Replaced adapter `V0ExploreView` with direct reference-port `ExplorePage`; **carried same pill markup** (added `{/* segmented control */}` comment) |
| **`6ad7232`** — *Track Orvek v0 reference pages for verification* | — | Committed `.reference/v0-orvek-workbench/.../explore.tsx` **already with pill strip** |
| `a56ee63`, `7c77057`, `196e481`, `fdc2d4b`, `f99eb36` | 2026-07 | **Tab strip unchanged** — bridge slices only edited `FreeExplore`, `Questions`, `Investigations`, `FieldworkBridge` bodies |

**No commit in this repository ever contained an underline-style Explore tab strip** in `components/orvek-v0/pages/explore.tsx` (searched `border-b-2`, `underline-offset`, pill introduction via `git log -S`).

### Interpretation

- **Not caused by Free Explore / Investigations / Active Questions / Fieldwork bridge slices.**
- Pill styling is **latent since v0 inversion** (Jun 25–26).
- Product owner likely **noticed recently** because:
  1. Hard-swap root now renders the same `ExplorePage` as `/dev/orvek-v0-reference`
  2. Bridge work increased Explore usage and tab switching during parity validation
  3. Accepted mental model (underline prototype) was **never captured** in the tracked `.reference/` snapshot — creating a false “golden” baseline that already included pills

**Corrected prior audit note:** `00-reference-route-integrity-audit.md` stated Explore tab chrome was “unchanged” by bridge slices — **true for markup**, but the pill style was **already a reference-integrity breach** relative to product-owner acceptance, not a new bridge regression.

---

## 3. Does `/dev/orvek-v0-reference` share the drift?

**Yes — identical pill strip.**

Reference route: `app/dev/orvek-v0-reference/page.tsx` → `<Workbench />` → `<ExplorePage />` → same `explore.tsx` module.

No production hooks on reference; **presentation is fully shared.**

---

## 4. Were other tab strips similarly mutated?

| Surface | Tab strip style | Bridge slices changed strip? |
|---------|-----------------|------------------------------|
| **Explore sub-tabs** | `o-sunken` pill | No (pre-existing) |
| **Inspector** (`evidence-panel.tsx`) | `o-sunken` pill (Evidence / Model Movement) | No bridge edits to strip |
| Today / Map / Timeline / Decisions | No horizontal sub-tab strip of this pattern | N/A |

Explore is the **only page-level sub-tab strip** using this pill pattern. Inspector uses the same visual language but is a separate surface (not part of this PO report).

Recent bridge slices **did not** propagate pill styling to new surfaces — it was already present.

---

## 5. Production data leak vs shared presentation drift

| Question | Answer |
|----------|--------|
| Production data leaking into reference? | **No** — reference still uses `createMockOrvekDataApi()` only |
| Shared presentation drifted? | **Yes** — both routes render the same pill tab strip from shared `explore.tsx` |
| Bridge data wiring caused pill appearance? | **No** — tab strip markup untouched since `35e2b92` |

This is **pure presentation drift** (wrong chrome), not a data-bridge defect.

---

## Root cause

1. **Design intent mismatch:** Accepted product visual = underline tabs; implemented v0 inversion = `o-sunken` segmented pill (copied into reference port and `.reference/` snapshot).
2. **Shared component coupling:** `/dev/orvek-v0-reference` was never a frozen visual fork — it mounts live `explore.tsx`.
3. **False baseline:** `.reference/v0-orvek-workbench/components/orvek/pages/explore.tsx` encodes pill strip, so repo-tracked “reference” reinforced the wrong chrome.
4. **Visibility timing:** Hard-swap + Explore bridge validation made the pre-existing pill strip salient; bridge slices did not introduce it.

---

## Proposed minimal code fix

**Scope:** `components/orvek-v0/pages/explore.tsx` — **`ExplorePage()` tab strip block only** (lines 47–64).

**Do not touch:**
- `FreeExplore`, `Questions`, `Investigations`, `FieldworkBridge` logic
- Readiness gates, hybrid hooks, send/composer wiring
- `TABS` array, `tab` state, conditional rendering of tab panels
- Inspector, sidebar, or evidence panel

**Replace pill container with underline switcher:**

```tsx
{/* tab switcher — underline style (accepted v0 reference) */}
<nav
  aria-label="Explore sections"
  className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-b border-border/50"
>
  {TABS.map((t) => (
    <button
      key={t.id}
      type="button"
      onClick={() => setTab(t.id)}
      aria-current={tab === t.id ? "page" : undefined}
      className={cn(
        "o-calm -mb-px border-b-2 pb-2.5 text-[13px] font-medium transition-colors",
        tab === t.id
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {t.label}
    </button>
  ))}
</nav>
```

**Remove:** `o-sunken` wrapper, `rounded-[9px] p-1`, active `bg-card` + shadow chip styling.

**Optional follow-up (separate slice):** Update `.reference/v0-orvek-workbench/components/orvek/pages/explore.tsx` to match after PO visual sign-off (documentation snapshot only — dev route uses live file).

**Out of scope for this fix:** Inspector pill tabs in `evidence-panel.tsx` (PO complaint scoped to Explore page tabs).

---

## Tests required

Add `lib/__tests__/explore-tab-visual-regression.test.ts` (static source tests):

1. `ExplorePage` tab strip **must not** contain `o-sunken` in the tab-switcher block
2. Tab strip **must not** use active `bg-card` chip pattern for Explore sub-tabs
3. Tab strip **must** use underline indicator (`border-b-2` or equivalent) on active tab
4. `TABS` labels and `{tab === ... && <Component />}` routing **unchanged**
5. Tab strip block **must not** import or call hybrid/production hooks
6. Reference route still mounts `Workbench` without `dataApi` prop (from `00` audit)

Optional: Playwright screenshot on `/dev/orvek-v0-reference` Explore with each tab selected.

Update `00-reference-route-integrity-audit.md` risk row: Explore tab chrome = **High** (accepted design breach), not Low.

---

## Visual check required before commit

**Yes — mandatory product-owner sign-off.**

Verify on both:
- `http://localhost:3000/` → sidebar Explore
- `http://localhost:3000/dev/orvek-v0-reference` → sidebar Explore

Checklist:
- [ ] No dark pill container behind tabs
- [ ] Active tab = text + underline only
- [ ] Inactive tabs = clean muted text
- [ ] Tab switching still works (all four panels)
- [ ] Fieldwork / Questions / Investigations / Free Explore **content** unchanged
- [ ] Inspector Live badge behavior unchanged when on Explore

---

## Should implementation happen before Free Explore send enablement?

**Yes.**

This is a **presentation-only** fix with zero data-bridge impact. Restore accepted Explore chrome before Slice E (handler/send wiring) to avoid compounding visual debt and false parity comparisons.

---

## Risk classification

| Risk | Level |
|------|-------|
| Wrong Explore tab chrome vs accepted design | **High** (confirmed breach) |
| Production data leak on reference | **None** |
| Bridge regression from underline fix | **Low** (isolated markup) |
| Accidental data/handler change if scope creeps | **Medium** — enforce tab-strip-only diff |
| Inspector pill tabs still diverge from PO memory | **Low** — out of scope unless PO expands |

---

## Implementation readiness

| Item | Status |
|------|--------|
| Root cause identified | ✅ |
| Commits blame identified | ✅ |
| Minimal fix scoped | ✅ |
| Tests specified | ✅ |
| Runtime code changed | ❌ Not yet (plan only) |
| Ready to implement | ✅ **Yes** — single-file, ~20-line markup change |

---

## Summary for implementer

**PHASE:** Reference integrity repair  
**SLICE:** Explore tab strip underline restoration  
**ALLOWED:** `components/orvek-v0/pages/explore.tsx` (ExplorePage tab strip only), new static test file  
**FORBIDDEN:** Data bridges, gates, send/handlers, other tabs/surfaces, Inspector strip, commits without PO visual check  
**VERIFICATION:** `npx vitest run lib/__tests__/explore-tab-visual-regression.test.ts` + PO visual on root and `/dev/orvek-v0-reference`
