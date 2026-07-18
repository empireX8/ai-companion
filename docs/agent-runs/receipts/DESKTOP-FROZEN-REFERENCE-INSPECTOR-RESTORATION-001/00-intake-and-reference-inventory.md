# 00 Intake And Reference Inventory

Campaign: `DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001`
Date: `2026-07-17`
Worktree: `/Users/user/ai-companion-worktrees/desktop-reference-authority-inspector-restoration-001`
Branch: `desktop-reference-authority-inspector-restoration-001`

## Baseline

- Requested baseline: `staging @ 1f8cb7c`
- Confirmed branch head: `1f8cb7cede1844d079a2dd0ab0ac434a132e761e`
- Confirmed `staging`: `1f8cb7cede1844d079a2dd0ab0ac434a132e761e`
- Confirmed merge-base(`HEAD`, `staging`): `1f8cb7cede1844d079a2dd0ab0ac434a132e761e`
- Verdict: the worktree is exactly based on the requested baseline commit.

## Search Scope

Repository-wide search was run from the requested worktree with these exclusions:

- `node_modules/**`
- `.next/**`
- `coverage/**`
- `dist/**`
- `build/**`
- `out/**`
- `.turbo/**`

Search covered:

- `.reference/**`
- repo-local media files: `png`, `jpg`, `jpeg`, `webp`, `gif`, `mov`, `mp4`, `m4v`
- docs mentioning recordings, screenshots, contact sheets, reference authority, `/dev/orvek-v0-reference`, and `rep-weekly`
- current mutable runtime entrypoints and Inspector swap points
- git history file-name scan for tracked media paths

## Authority Discovery

### 1. Repo-local stored visual reference assets

No repo-local stored screenshots, contact sheets, videos, GIFs, PNGs, JPGs, WEBPs, MOVs, or MP4s were found for the approved desktop reference.

Current working tree media results:

| Path | SHA-256 | Dimensions | Size | Role |
|---|---|---:|---:|---|
| `public/empty.png` | `e9bac2d1c741bb4cd71c65fe31dce97ddf030f628f4205cf20a239b9dc64524f` | `2160x2160` | `650298` bytes | Generic asset, not a desktop reference capture |
| `public/orvek-atmosphere.png` | `c4c2dfd6a891d9e49fb29d65364ea9a0c6494737baf682e8d98132d58f90658a` | `1024x1024` | `1334027` bytes | Generic background texture, not a desktop reference capture |

Git-history media path scan also found only those same two image paths.

Documents do reference prior recordings and sampled states, but no repo-local media file paths were found:

- `docs/agent-runs/receipts/DESKTOP-REFERENCE-PARITY-PROVENANCE-AUDIT-001/01-reference-state-inventory.md`
- `docs/agent-runs/receipts/DESKTOP-REFERENCE-INTEGRITY-AUDIT-001/00-reference-route-integrity-audit.md`

Verdict:

- Stored visual authority is **incomplete** in this repository.
- Visual-reference-path discovery result is **explicitly negative**.
- Runtime restoration initially proceeded against frozen code authority plus campaign instructions.

### 1A. Human authority confirmation after repo search

After the negative repo-media search above, Kay completed a direct live comparison on `2026-07-17`:

- historical accepted app at commit `5c56ba0` on `http://localhost:3001`
- current frozen route at `http://localhost:3000/dev/orvek-v0-reference`
- result: visually and behaviorally the same

Authority effect:

- the current frozen route is now confirmed as valid desktop authority
- visual authority is no longer blocked by the missing recording file
- the deleted original recording is not required for this repair
- production `http://localhost:3000/` remains the implementation under repair

### 2. Frozen code reference snapshot in `.reference/`

Tracked frozen snapshot:

- Snapshot commit: `6ad723216088987953cac776c8119693ea3bc982`
- Commit date: `2026-06-29T13:30:12+01:00`
- Commit subject: `Track Orvek v0 reference pages for verification`

Exact files:

| Path | SHA-256 | Size | Last commit |
|---|---|---:|---|
| `.reference/v0-orvek-workbench/app/page.tsx` | `7657ecad358f33b87b0edaad2b35f7830424f429b595d3915fdef71ba3f40918` | `116` | `6ad723216088987953cac776c8119693ea3bc982` |
| `.reference/v0-orvek-workbench/components/orvek/pages/decisions.tsx` | `0a31beebd0c802d77b1b1be31668d7e0e2468951036688be2865cc88316bfe31` | `16291` | `6ad723216088987953cac776c8119693ea3bc982` |
| `.reference/v0-orvek-workbench/components/orvek/pages/explore.tsx` | `71c4d3e742688a7ab94a2275e015caa3310b1dadffa6ded7c8f8d16bb80778db` | `17778` | `6ad723216088987953cac776c8119693ea3bc982` |
| `.reference/v0-orvek-workbench/components/orvek/pages/map.tsx` | `4cebfb8460800569ae73c3f2736e3176f81e707062f34eb21efed33bffabd45e` | `14046` | `6ad723216088987953cac776c8119693ea3bc982` |
| `.reference/v0-orvek-workbench/components/orvek/pages/timeline.tsx` | `4b2504f3fc2942aaf7d10b6d7c7d90f804e4ae09ed68a0ea53301e0cbfb86fb9` | `9617` | `6ad723216088987953cac776c8119693ea3bc982` |
| `.reference/v0-orvek-workbench/components/orvek/pages/today.tsx` | `ac623957779a94a787e4a61312783206e7e039bea50823766090cdb8bac16cf4` | `14291` | `6ad723216088987953cac776c8119693ea3bc982` |

Observed limitations:

- The `.reference` tree is **not a full runnable frozen package**.
- It contains page snapshots only.
- It does **not** contain frozen Inspector chrome files such as `evidence-panel.tsx`, `workbench.tsx`, `top-bar.tsx`, `sidebar.tsx`, `overlays.tsx`, or the store primitives.
- Snapshot imports still point at older module paths such as `@/components/orvek/workbench` and `@/lib/orvek-data`, confirming that this is a historical snapshot rather than a directly mountable package.

### 3. Provenance-matched frozen Inspector companion files from the same snapshot commit

Because `.reference/v0-orvek-workbench/` omits the Inspector implementation, the exact same frozen commit is the only repo-local code authority that can recover the approved Inspector presentation without guessing from today’s mutable files.

Companion files at commit `6ad723216088987953cac776c8119693ea3bc982`:

| Historical path | Frozen SHA-256 at commit `6ad723...` | Current working-tree SHA-256 | Role |
|---|---|---|---|
| `components/orvek-v0/evidence-panel.tsx` | `2aa11bc9ee72c27e618f433aca9f50b2c1b175efef76dbdb69ffd77fbb118c59` | `0a0c5142917968e4cd0d6b26d792423c8be79ec9556c1fb1bab40fca4e409e0d` | Frozen Inspector presentation authority candidate |
| `components/orvek-v0/workbench.tsx` | `f4ce251ca9d2d329fde14618a51902643b48db8ab3b75497404525e7adfb76e4` | `49791f715216766b8b1995bbd7fe8f53453937423e69ff79b0b7f2ed3d6b8773` | Frozen shell swap authority candidate |

Interpretation:

- These are **not** higher authority than the `.reference` snapshot.
- They are a provenance-matched supplement from the same frozen point because the `.reference` snapshot is structurally incomplete for Inspector restoration.
- This campaign may use them only to recover missing frozen Inspector chrome that is absent from `.reference/`.

### 4. Current frozen `/dev` reference route

Current route:

| Path | Runtime root | Current role |
|---|---|---|
| `app/dev/orvek-v0-reference/page.tsx` | `components/orvek-v0-reference-frozen/workbench.tsx` | Frozen reference entry route |

Current route body:

- imports `FrozenReferenceWorkbench` from `@/components/orvek-v0-reference-frozen/workbench`
- renders the frozen package inside `data-testid="orvek-v0-reference-route"`

Verdict:

- `/dev/orvek-v0-reference` now serves the frozen authority route described in `02-frozen-reference-route.md`.
- Kay's `2026-07-17` side-by-side comparison confirmed that this route matches the historical accepted app at commit `5c56ba0`.

### 5. Current mutable production override points under repair

Relevant mutable files:

| Path | SHA-256 | Last commit | Current role |
|---|---|---|---|
| `components/layout/AppShell.tsx` | `8cefbc16017ad926910fc8de8d46849fb35e1560d0ebcdf9e0d4a6185ffd449f` | `a1b24a330193a00badf48f2ce2d1f819e453c1fd` (`2026-06-25T10:28:10+01:00`) | Mounts `OrvekWorkbenchShell` |
| `components/orvek-workbench/OrvekWorkbenchShell.tsx` | `ff0bfa09d3481d65d0a793b40316901fca0af626e823d4928d24afcd700eee7d` | `3fcf7eaf6d16031bc3fe4347ecc5aefdb00551d1` (`2026-07-15T00:49:04+01:00`) | Discards route children and mounts hybrid `Workbench` |
| `components/orvek-v0/workbench.tsx` | `49791f715216766b8b1995bbd7fe8f53453937423e69ff79b0b7f2ed3d6b8773` | `0f161573fc3fd8d65484786b419e63fd45f7322b` (`2026-07-17T00:04:35+01:00`) | Swaps `RouteTopBar` and `WorkbenchInspector` when `dataApi` exists |
| `components/orvek-v0/evidence-panel.tsx` | `0a0c5142917968e4cd0d6b26d792423c8be79ec9556c1fb1bab40fca4e409e0d` | `3fcf7eaf6d16031bc3fe4347ecc5aefdb00551d1` (`2026-07-15T00:49:04+01:00`) | Mutable current v0 Inspector implementation |
| `components/inspector/WorkbenchInspector.tsx` | current mutable file | current production Inspector chrome |
| `components/inspector/panels/SelectedObjectEvidencePanel.tsx` | current mutable file | current production Inspector content |
| `components/orvek-v0/reference/ReferencePageHandlersProvider.tsx` | current mutable file | helper wiring for mutable reference interactions |

Historical intake failure shape:

1. `components/layout/AppShell.tsx` mounts `OrvekWorkbenchShell`.
2. `components/orvek-workbench/OrvekWorkbenchShell.tsx` mounts `<Workbench dataApi={dataApi} handlers={handlers} />`.
3. `components/orvek-v0/workbench.tsx` computes `productionInspector = Boolean(dataApi)`.
4. When `productionInspector` is true, the shell swaps:
   - `topBar={productionInspector ? <RouteTopBar /> : <TopBar />}`
   - `inspector={productionInspector ? <WorkbenchInspector /> : <EvidencePanel />}`

That was the starting defect at intake. It is superseded by the shared-authority restoration documented in `03-inspector-architecture-restoration.md`.

## Authority Hierarchy For This Campaign

Based on what now exists and what Kay validated on `2026-07-17`:

1. Kay's direct comparison between historical accepted app commit `5c56ba0` and `http://localhost:3000/dev/orvek-v0-reference`
2. Current frozen reference route:
   - `app/dev/orvek-v0-reference/page.tsx`
   - `components/orvek-v0-reference-frozen/**`
3. Frozen code authority:
   - `.reference/v0-orvek-workbench/**` from commit `6ad723216088987953cac776c8119693ea3bc982`
   - provenance-matched same-commit Inspector companion files recovered from git history where `.reference/` is incomplete
4. Explicit product-owner instructions in `DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001`
5. Current production implementation: implementation under repair, never its own target
6. Deferred redesign and future-theme docs: non-authoritative for this campaign and must be quarantined next

## Hard-Gate Verdict

The hard gate is now satisfied:

- the exact baseline commit is confirmed
- exact frozen code authority sources are named
- the repo-local visual-media search result remains explicitly negative
- Kay's human comparison promotes the current frozen `/dev` route to valid authority
- the deleted original recording is explicitly no longer required

Runtime Inspector restoration may begin only against the authority hierarchy above.
