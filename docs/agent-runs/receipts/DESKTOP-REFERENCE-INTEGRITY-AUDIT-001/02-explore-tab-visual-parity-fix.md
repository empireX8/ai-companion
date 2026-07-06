# 02 Explore Tab Visual Parity Fix

**Slice:** `DESKTOP-REFERENCE-INTEGRITY-AUDIT-001` — Explore tab chrome repair  
**Branch:** `desktop-reference-integrity-explore-tabs-001`  
**Mode:** Presentation-only fix

---

## Status

| Gate | Result |
|------|--------|
| Code / tests | PASS |
| First underline fix (PO review) | **VISUAL PARTIAL PASS / FEEL FAIL** |
| Refined tab strip (PO review) | **Pending — visual check required before commit** |
| Commit | **DO NOT COMMIT** until PO accepts feel |

---

## Summary

First pass replaced pill/segmented chrome with underline tabs but product owner reported it still felt too generic / AI-generated. Second pass refines toward the quieter original Orvek/v0 navigation row: thin underline, full-width divider, restrained typography, no transition polish on tab buttons.

No production data wiring, readiness gates, or tab panel logic changed.

---

## Iteration history

### Pass 1 (insufficient)

- Removed `o-sunken` pill container and active chip
- Added `border-b-2` underline + `text-[13px] font-medium` + `o-calm` transitions
- **PO feedback:** “A bit better but still doesn’t capture the feeling it had before.”

### Pass 2 (current — refined feel)

**Removed from tab strip:**
- `o-calm` transition class on tab buttons
- Heavy `border-b-2` active underline
- `text-[13px] font-medium` on all tabs
- Border on `<nav>` acting as both container and divider

**Added / changed:**
- Outer quiet full-width row divider: `border-b border-border/40`
- Thin 1px active tab underline: `border-b` (not `border-b-2`)
- Restrained type: `text-[12px] leading-none tracking-tight`
- Active: `font-medium text-foreground` only
- Inactive: `font-normal text-muted-foreground/85` with minimal hover `hover:text-foreground/75`
- Editorial spacing: `gap-x-5 sm:gap-x-7` (not equal-button padding)
- Minimal focus: `focus-visible:outline-none` only

---

## Files changed

| File | Change |
|------|--------|
| `components/orvek-v0/pages/explore.tsx` | `ExplorePage()` tab strip only |
| `lib/__tests__/explore-tab-visual-regression.test.ts` | Enforce thin underline, divider, no rounded/o-calm |

---

## Policy confirmation

| Item | Status |
|------|--------|
| Pill / segmented tab chrome removed | **Yes** |
| Refined toward quiet underline Orvek/v0 feel | **Yes** (PO sign-off pending) |
| Production data wiring changed | **No** |
| Hybrid fetches / readiness gates changed | **No** |
| Ask/send enabled | **No** |
| Free Explore behavior preserved | **Yes** |
| Fieldwork Bridge preserved | **Yes** |
| Active Questions preserved | **Yes** |
| Investigations preserved | **Yes** |
| Today / Map / Timeline / Decisions preserved | **Yes** |
| `/dev/orvek-v0-reference` mock data only | **Yes** |

---

## Visual classes changed (tab strip)

| Element | Classes |
|---------|---------|
| Row wrapper | `mt-5 border-b border-border/40` |
| Nav | `-mb-px flex flex-wrap gap-x-5 sm:gap-x-7` |
| Tab button (base) | `border-b pb-2 pt-0.5 text-[12px] leading-none tracking-tight focus-visible:outline-none` |
| Active tab | `border-foreground font-medium text-foreground` |
| Inactive tab | `border-transparent font-normal text-muted-foreground/85 hover:text-foreground/75` |

---

## Verification

Run before PO review:

```bash
npx tsc --noEmit
bash scripts/check-trust-language.sh
bash scripts/check-legacy-surfaces.sh
git diff --check
npx vitest run lib/__tests__/explore-tab-visual-regression.test.ts \
  lib/__tests__/free-explore-chat-tab-alignment.test.ts \
  lib/__tests__/active-questions-tab-alignment.test.ts \
  lib/__tests__/investigations-tab-alignment.test.ts \
  lib/__tests__/fieldwork-bridge-alignment.test.ts \
  lib/__tests__/shell-quarantine.test.ts \
  lib/__tests__/orvek-v0-inversion.test.ts
```

---

## Product-owner visual check (required before commit)

### URLs

1. Root: `http://localhost:3000/` → sidebar **Explore**
2. Reference: `http://localhost:3000/dev/orvek-v0-reference` → **Explore**

### Feel checklist (not just structure)

- [ ] Tabs read as **plain navigation text**, not a generated control
- [ ] **No** pill, box, or filled active background
- [ ] Active mark is a **thin, precise** underline sitting on a **quiet full-width line**
- [ ] Inactive tabs feel **muted but readable**, not disabled
- [ ] Spacing feels **editorial** (uneven/product-led gaps), not generic equal buttons
- [ ] Typography feels **small and restrained** (12px row), not loud SaaS tabs
- [ ] Hover/focus is **minimal** (slight text shift only)
- [ ] All four tabs switch correctly; panel content unchanged; Ask still disabled

### Screenshots to compare

Capture side-by-side (root vs reference — should match):

1. Explore header + tab row (Free Explore selected)
2. Tab row with **Investigations** selected (shows underline move)
3. Full Explore page width showing tab row + first content block

Compare against remembered target: line switch under tabs, clean text, no boxed chrome.

---

## Not done

- Inspector pill tabs — out of scope
- `.reference/v0-orvek-workbench/` snapshot update — after PO accepts feel
- Free Explore send enablement — blocked until visual sign-off

---

## Production readiness

**Not production-ready yet.** Visual feel pending PO acceptance; send/handlers still disabled.
