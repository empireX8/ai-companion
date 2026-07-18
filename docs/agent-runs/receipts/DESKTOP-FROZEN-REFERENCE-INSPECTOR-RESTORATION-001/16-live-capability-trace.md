# 16 — Live capability trace (canonical live candidate)

Campaign: `DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001`
Date: `2026-07-18`
Candidate route: `/dev/orvek-v0-canonical-live`
Presentation: `components/orvek-v0-canonical/**`
Provider: `buildCanonicalLiveRuntimeData` ← `useOrvekHybridWorkbenchDataApi`
Root cutover: **not performed**

## Runtime path (all surfaces)

```
Clerk auth / ownership
  → production APIs (today, map, decisions, explore chat, timeline, …)
  → useOrvekHybridWorkbenchDataApi → OrvekDataApi + OrvekPageHandlers
  → buildCanonicalLiveRuntimeData → CanonicalRuntimeData
  → CanonicalWorkbench + orvek-v0-canonical/pages/*
  → EvidencePanel (orvek-v0-authority) / Overlays
  → handlers / store actions (select, openReport, explore onSend, …)
```

Parallel `components/orvek-v0/pages/*` are **not** on this path.

---

## Per-surface trace

| Surface | Live source | Canonical provider input | Canonical component | Data complete? | Missing production contract | Action callback | Parallel pages involved? |
|---------|-------------|--------------------------|---------------------|----------------|-----------------------------|-----------------|--------------------------|
| Today | `buildTodayProductionDataApi` + hydration / hybrid merge | `today.*`, `todayCopy`, `todayResurfacedIds`, `getObject` | `orvek-v0-canonical/pages/today.tsx` | Depends on live readiness | Hero/meta may be empty until adapters fill | `select`, `openReport`, `setInspectorTab` | **No** |
| Map | `buildMapProductionDataApi` / conclusions fetch | `mapCategories`, `mapSelectedId`, `getObject` | `orvek-v0-canonical/pages/map.tsx` | When map merge ready; empty rail + “Nothing selected” when absent | Empty categories when not ready | `select`, corrections via store | **No** |
| Decisions | `buildDecisionsProductionDataApi` | `decisionListGroups`, `decisionsSelectedId` | `orvek-v0-canonical/pages/decisions.tsx` | When decisions merge ready; empty workspace when absent | Empty lists when not ready | `select`, `openReport(decision.id)`, handlers.decisions | **No** |
| Experiment / Investigations | investigations + experiment production APIs | `exploreInvestigationIds`, `getObject` | `orvek-v0-canonical/pages/explore.tsx` (Investigations tab) | Partial vs old parallel Explore detail; truthful empty when no ids | Production investigation workbench detail UI not re-hosted as separate page | `select` | **No** (old Explore page inactive) |
| Explore (Free) | `useOrvekExploreChat` → free-explore chat API | `exploreMessages`, `exploreGrounding`, handlers.explore | `orvek-v0-canonical/pages/explore.tsx` FreeExplore | When session/send ready | Reference sample conversation disabled (`referenceSurface: false`) | `onSend`, `onDraftChange`, `onQuickPrompt` | **No** |
| Timeline | `buildTimelineProductionDataApi` | `timelineGroups`, `timelineFilters` | `orvek-v0-canonical/pages/timeline.tsx` | When timeline merge ready | Empty groups when not ready | `select`, `setInspectorTab` | **No** |
| Evidence / Context | object graph via hybrid `getObject` + authority panel | `orvekDataApi.getObject`, selection store | `orvek-v0-authority/evidence-panel.tsx` | Object-dependent | MU production compose gated off when `canonicalRuntime` | LinkedRows → `select` / pushSelection | **No** |
| Model Movement | same graph + movement tab | movement fields on object / exploreMovement | evidence-panel Movement tab | Object-dependent | Conversation movement honesty for live Explore | Open report → `openReport` | **No** |
| Linked-object detail | relatedIds / contextIds / receiptIds on typed objects | `getObjects` | evidence-panel LinkedRow + Back stack | Object-dependent | — | Back restores tab/scroll via store | **No** |
| Report overlay | `openReport(reportId)` with live MU/report id | store `reportId` | `orvek-v0/overlays.tsx` ReportOverlay | When reportId set from live | Live id ≠ `rep-weekly` | Close → `openReport(null)` | **No** |

---

## Auth / ownership

Enforced by Clerk middleware on `/dev/orvek-v0-canonical-live` (`auth.protect`) and by existing production API ownership checks inside the hybrid fetch path. Fixture identities are not injected (`referenceSurface: false`).
