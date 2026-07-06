# 01 Handler Provider Mount (Slice E1)

**Slice:** `DESKTOP-FREE-EXPLORE-CHAT-SEND-HANDLER-AUDIT-001` — E1 handler provider plumbing  
**Branch:** `desktop-free-explore-handler-provider-mount-001`  
**Mode:** Plumbing only — send remains disabled

---

## Summary

Optional `OrvekPageHandlersProvider` plumbing mounted on the root Workbench tree. Root shell passes an empty handlers object. Ask/send remains disabled via the existing dual gate (`freeExploreSendHandlerAvailable === false` and no `explore.onSend`).

---

## What changed

### `components/orvek-v0/workbench.tsx`

- Added optional `handlers?: OrvekPageHandlers` prop
- Wraps `Layout` + `Overlays` in `OrvekPageHandlersProvider` with `handlers ?? {}`
- Reference route `<Workbench />` unchanged — defaults to empty handlers, mock API only

### `components/orvek-workbench/OrvekWorkbenchShell.tsx`

- Passes `handlers={{}}` explicitly to `Workbench` (no explore write handlers)

### Tests

- **Added:** `lib/__tests__/free-explore-chat-handler-provider-mount.test.ts` (6 tests)
- **Updated:** `free-explore-chat-tab-alignment`, `free-explore-chat-presentation-readiness`, `free-explore-chat-hybrid-fetch`, `hybrid-workbench-api`, `shell-quarantine`

---

## Policy confirmation

| Item | Status |
|------|--------|
| Handler provider plumbing mounted | **Yes** — `OrvekPageHandlersProvider` in Workbench |
| Ask/send enabled | **No** |
| `sendMessage` called from root | **No** |
| Production write handlers exposed | **No** — empty `handlers={{}}` |
| `freeExploreSendHandlerAvailable` | **Remains `false`** (hybrid merge unchanged) |
| Free Explore read-only transcript | **Preserved** |
| Reference route mock-only | **Yes** — `<Workbench />` without handlers/hybrid |
| Data bridge behavior changed | **No** |
| E2 ready | **Yes** — shell/hook can pass `handlers.explore` without Workbench restructure |

---

## Dual gate (unchanged)

`FreeExplore.canSend` requires **both**:

1. `freeExploreSendHandlerAvailable === true` → still false from hybrid merge  
2. `Boolean(exploreHandlers?.onSend)` → false (empty handlers)

Ask button stays disabled.

---

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS |
| `bash scripts/check-trust-language.sh` | PASS |
| `bash scripts/check-legacy-surfaces.sh` | PASS |
| `git diff --check` | PASS |
| Vitest (8 files, 136 tests) | PASS |

---

## Visual check

**Not required for E1.**

No UI, composer, or send behavior changed. Provider plumbing is invisible unless handlers are wired in E2/E3.

**Required** when E2 enables send flag and E3 binds draft/streaming UI.

---

## Recommended next slice (E2)

Wire `useOrvekHybridWorkbenchDataApi` → `handlers.explore` with `setDraft` / `sendMessage`, and pass `sendHandlerAvailable: true` through merge when session gate passes — still blocked until explicit slice + tests + PO visual check.

---

## Production readiness

**Not production-ready for send.** E1 is plumbing only; write path intentionally unopened.
