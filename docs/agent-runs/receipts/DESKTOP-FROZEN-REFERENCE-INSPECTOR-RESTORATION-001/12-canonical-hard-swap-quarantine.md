# Canonical hard-swap — quarantined parallel presentation

Campaign: `DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001`

After the production root mounts `CanonicalWorkbench` + live provider, the following parallel presentation paths are **inactive** (not deleted pending Kay review).

## Active production root

- `components/orvek-workbench/OrvekWorkbenchShell.tsx`
  - DurableActionsRefreshProvider
  - OrvekPageHandlersProvider
  - `CanonicalWorkbench` + `buildCanonicalLiveRuntimeData(dataApi)`
  - `enableProductionBridge`

## Active presentation

- `components/orvek-v0-canonical/**` — reference-derived page system
- Fixture verification: `/dev/orvek-v0-canonical-reference`
- Cold authority (immutable): `/dev/orvek-v0-reference` → `components/orvek-v0-reference-frozen/**`

## Inactive — do not mount as production visual root

| Path | Reason |
|------|--------|
| `components/orvek-v0/pages/today.tsx` | Parallel production Today composer |
| `components/orvek-v0/pages/map.tsx` | Parallel production Map |
| `components/orvek-v0/pages/timeline.tsx` | Parallel production Timeline |
| `components/orvek-v0/pages/decisions.tsx` | Parallel production Decisions |
| `components/orvek-v0/pages/explore.tsx` | Parallel production Explore (live chat wiring moved into canonical FreeExplore via handlers) |
| `components/orvek-v0/workbench.tsx` | Separate visual root; no longer mounted by OrvekWorkbenchShell |
| Production ModelUpdate compose branch when `data.canonicalRuntime === true` | Gated off in `components/orvek-v0-authority/evidence-panel.tsx` (`selectedModelUpdateId` requires `canonicalRuntime !== true`) |

## Preserved live infrastructure (not presentation)

- `useOrvekHybridWorkbenchDataApi`
- Auth / ownership / hybrid APIs
- Durable actions refresh
- Page handlers (Explore send, etc.)
- `ProductionInspectorBridge` + `InspectorProvider` inside CanonicalWorkbench when live
