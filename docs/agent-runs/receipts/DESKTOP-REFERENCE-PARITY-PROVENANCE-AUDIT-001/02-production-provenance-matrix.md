# Production Provenance Matrix

## Totals

Denominator: **45 recorded states**.

| LIVE | FALLBACK | MOCK | MIXED | UNPROVEN |
|---:|---:|---:|---:|---:|
| **0** | **15** | **3** | **25** | **2** |

No recorded state is wholly LIVE because every active-root state either retains reference presentation/graph fallback, depends on a conditional hybrid merge, uses an in-memory action, or lacks runtime proof.

Abbreviations: `EC` = Evidence / Context; `MM` = Model Movement. Gap classes follow the packet taxonomy.

## Today and initial Explore

| # | Reference state | Object | Production provider / runtime source | Provenance | Creation/write path | Inspector depth / action | Gap | Confidence / exact evidence |
|---:|---|---|---|---|---|---|---|---|
| 1 | P1 00:00 Today empty | none | Hybrid mock base; Today reference branch | FALLBACK | N/A | Empty EC works | A_ADAPTER | High — `OrvekWorkbenchShell.tsx:8-13`; `today.tsx:139-156` |
| 2 | P1 00:25 decision EC | decision `d1` | Reference `d1`; Decisions overlay may supply other rows | FALLBACK | Actions API exists, not this fixture | Rich fixture EC; Add outcome not durable | C_WRITE_PATH | High — `orvek-data.ts`; `evidence-panel.tsx`; `decisions-api.ts` |
| 3 | P1 01:05 correction chip | decision correction | Workbench `corrections` React state | MOCK | No API write | Chip records only in session | G_MISSING_UX_CAPABILITY | High — `store.tsx:56-58`; `evidence-panel.tsx:713-741` |
| 4 | P1 01:15 Free Explore | chat + selected decision | Live session/messages can overlay; selected grounding object is reference | MIXED | `POST /api/message` is real | Live chat works; grounding/movement context absent | B_HYDRATION / E_AI_CONTRACT | High — `useOrvekExploreChat.ts`; `free-explore-chat-api.ts`; `explore.tsx:158-198` |
| 5 | P1 01:25 decision pressure MM | model update `mu-*` | Fixed recent `mu-1..3`; live Today model updates lack before/after | FALLBACK | Internal/dark-engine publish | Reference MM rich; live selected delta blocked | B_HYDRATION | High — `evidence-panel.tsx:134`; `today-api.ts:140-167` |
| 6 | P1 01:45 investigation EC | investigation | Live investigation fetch is too thin for merge gate | FALLBACK | Candidate/publish backend only | Reference hypotheses/missing evidence; live actions disabled | B_HYDRATION / C_WRITE_PATH | High — `investigations-presentation.ts`; `explore.tsx:674-812` |
| 7 | P1 02:00 Continue action | decision | Reference action calls `select("d1")` | FALLBACK | No differentiated command in active branch | Selection executes; intended continuation does not | D_INTERACTION | High — `today.tsx` reference primary actions; `today-workbench-routes.ts` |
| 8 | P1 02:30 scope loop | map-object/loop | Zip object through provider fallback | FALLBACK | Dark-engine conclusion paths do not create this ID | Fixture graph rich | A_ADAPTER / B_HYDRATION | High — `data-provider.tsx:148-157`; `orvek-data.ts` |
| 9 | P1 02:45 fieldwork | fieldwork | Reference `f1`; live experiment rows conditional | FALLBACK | Fieldwork DB exists | Check-in is local state | C_WRITE_PATH | High — `evidence-panel.tsx:546-567`; `experiment-api.ts` |
| 10 | P1 03:30 active question EC | active-question | Active-question API can merge into hybrid | MIXED | Investigation table/internal flows | EC is graph projection; correction not durable | B_HYDRATION / C_WRITE_PATH | Medium — `active-questions-api.ts`; presentation gate |
| 11 | P1 03:35 active question MM | active-question + global movement | Selected honest-empty plus fixed recent `mu-*` | FALLBACK | N/A | Separation is correct; report fallback | B_HYDRATION | High — `evidence-panel.tsx:241-291` |

## Map

| # | Reference state | Object | Production provider / runtime source | Provenance | Creation/write path | Inspector depth / action | Gap | Confidence / exact evidence |
|---:|---|---|---|---|---|---|---|---|
| 12 | P1 03:45 loop | map-object/loop | User-map conclusions overlay onto mock Map | MIXED | Dark-engine candidates + user-map APIs | Root uses generic graph; no selection-aware detail refetch | B_HYDRATION / D_INTERACTION | High — `map-api.ts`; hybrid hook map fetch; missing `map.onOpenItem` |
| 13 | P1 04:15 claim | map-object/claim | Same | MIXED | User-map conclusion persistence | Receipt/context closure conditional | B_HYDRATION | High — `map-api.ts:82-178`; `map-presentation.ts` |
| 14 | P1 04:45 conflict | map-object/conflict | Same | MIXED | Disputed conclusion lifecycle exists | Correction local only | C_WRITE_PATH | High — user-map PATCH route; `store.tsx` correction state |
| 15 | P1 05:00 goal | model-goal | Goal-shaped conclusion projection | MIXED | Conclusion APIs; no goal editor | Root projection shallow; production panel dormant | B_HYDRATION / G_MISSING_UX_CAPABILITY | High — `map-api.ts:140-155`; `ProductionInspectorBridge.tsx` |
| 16 | P1 05:30 context | context | Mind-context snapshot from references/patterns | MIXED | Reference/pattern APIs | Root generic EC; capture-correction handoff exists only dormant | B_HYDRATION | High — `mind-context-surface.ts`; `map-api.ts:93-131` |
| 17 | P1 05:45 open question | active-question preview | `/api/active-questions` projection into rail | MIXED | Question/investigation flows | Rail has no inspector object ID | A_ADAPTER / B_HYDRATION | High — `your-map-preview-surface.ts:47-62`; adapter rail mapping |
| 18 | P1 06:00 model update | model-update preview | `/api/today/intelligence-updates` projection | MIXED | Internal publish | Rail lacks inspector object ID; before/after absent | B_HYDRATION | High — `your-map-preview-surface.ts:29-44`; `map.ts` adapter |
| 19 | P1 06:30 open question | active-question | Same conditional rail overlay | MIXED | Question flows | Related fieldwork/evidence may be thin | B_HYDRATION | Medium — presentation gate only; no current authenticated replay |

## Decisions

| # | Reference state | Object | Production provider / runtime source | Provenance | Creation/write path | Inspector depth / action | Gap | Confidence / exact evidence |
|---:|---|---|---|---|---|---|---|---|
| 20 | P2 00:05 active options | decision/action | `/api/actions` → Decisions overlay | MIXED | Action creation/sync exists | Options/reference chrome; production entry actions deferred | A_ADAPTER / D_INTERACTION | High — `decisions-api.ts`; `decisions.tsx:133-163` |
| 21 | P2 00:15 outcome due | decision/action | Same, with local outcome toggle | MIXED | `PATCH /api/actions/[id]` exists, UI does not call it | “Outcome recorded” can be local-only | C_WRITE_PATH | High — `actions-api.ts`; `decisions.tsx:395-408` |
| 22 | P2 00:45 decision MM | decision + fixed recent movements | Fixed reference recent movement | FALLBACK | No decision movement write | Honest no-delta possible; global report fallback | B_HYDRATION | High — `evidence-panel.tsx` |
| 23 | P2 01:15 active decision | decision/action | Live row in reference shell | MIXED | PATCH backend exists | Choose/review not wired | D_INTERACTION | High — zero active-component callers of `updateSurfacedAction` |
| 24 | P2 01:30 import vs Explore | decision/action | Live action row plus reference EC behavior | MIXED | Action backend | Ask in Explore changes page only; no context transfer | D_INTERACTION | High — `evidence-panel.tsx:698-709`; `explore-action-handoff.ts` library only |
| 25 | P2 01:45 chosen fieldwork | decision/action | Live status projection + reference detail fields | MIXED | Action/fieldwork APIs | Add outcome not persisted from v0 page | C_WRITE_PATH | High — Decisions page local state |
| 26 | P2 02:00 reviewed/report outcome | decision/report | Reference report/review affordances | FALLBACK | No live report object emitter | Rich fixture report only | C_WRITE_PATH / B_HYDRATION | High — `overlays.tsx:398-473`; report parity gate |

## Timeline

| # | Reference state | Object | Production provider / runtime source | Provenance | Creation/write path | Inspector depth / action | Gap | Confidence / exact evidence |
|---:|---|---|---|---|---|---|---|---|
| 27 | P2 02:15 grouped stream | timeline events | Activity + semantic + model-layer APIs in reference shell | MIXED | Source systems write elsewhere | Filter labels/logic mismatch | D_INTERACTION | High — `timeline-api.ts`; `timeline.tsx:62-88` |
| 28 | P2 02:30 model update | model-update event | `/api/timeline/model-layers` | MIXED | Internal publish | `beforeSummary` commonly null; MM partial | B_HYDRATION | High — timeline adapter; model-layers route |
| 29 | P2 02:45 decision event | timeline-event/decision | Activity/semantic projection | MIXED | Action update elsewhere | Generic event shell; related source conditional | A_ADAPTER | Medium — timeline semantic mapper |
| 30 | P2 03:00 capture event | timeline-event/capture | Activity API row; source-object mapping not runtime-proven | UNPROVEN | Capture source exists elsewhere | Related target may be null | A_ADAPTER | Medium — code mapping only |
| 31 | P2 03:15 active-question event | timeline-event/question | Semantic active-question fetch | MIXED | Question update elsewhere | No dedicated active-question event hydration | B_HYDRATION | Medium — semantic layers |
| 32 | P2 03:20 fieldwork event | timeline-event/fieldwork | Semantic watch-for fetch | MIXED | Fieldwork backend | Root generic EC only | B_HYDRATION | Medium |
| 33 | P2 03:25 decision-reviewed | timeline-event/action | Semantic actions fetch | MIXED | PATCH/action flow elsewhere | Linked claim only when available | A_ADAPTER | High — `timeline-semantic-layers.ts` |
| 34 | P2 03:20–03:25 import/report history | timeline-event/report/import | Mixed activity rows; no live report object contract | UNPROVEN | Import writes exist; report persistence not established | Report overlay uses zip only | B_HYDRATION / C_WRITE_PATH | High for report gap; medium overall |

## Explore

| # | Reference state | Object | Production provider / runtime source | Provenance | Creation/write path | Inspector depth / action | Gap | Confidence / exact evidence |
|---:|---|---|---|---|---|---|---|---|
| 35 | P2 03:30 Free Explore decision | live chat + decision | Real session/messages; selected decision/reference shell | MIXED | `POST /api/message` | Send real; movement/review bridge unwired | B_HYDRATION / E_AI_CONTRACT | High — `useOrvekExploreChat.ts`; session bridge has no caller |
| 36 | P2 04:00 grounding claim | map-object/claim | Live chat grounding intentionally `[]`; reference chip only | FALLBACK | No real grounding write from chat | Fixture claim rich | E_AI_CONTRACT | High — `free-explore-chat-api.ts`; live anti-mock-bleed tests |
| 37 | P2 04:15 grounding receipt | receipt | Reference chip/zip receipt | FALLBACK | Narrow depth-pointer write path is separate | Rich fixture depth, not current-chat evidence | E_AI_CONTRACT / B_HYDRATION | High |
| 38 | P2 04:20 context grounding | context | Reference grounding chip | FALLBACK | No chat-to-context write | Fixture EC only | E_AI_CONTRACT | High |
| 39 | P2 04:30 investigation | investigation | Thin live list fails richness gate | FALLBACK | Candidate/publish backend | Reference detail/actions; live actions disabled | B_HYDRATION / C_WRITE_PATH | High |
| 40 | P2 04:45 investigation | investigation | Same | FALLBACK | Same | Same | B_HYDRATION / D_INTERACTION | High |
| 41 | P2 05:00 active question | active-question | Live active-question overlay can pass | MIXED | Investigation table flows | “See evidence” works; other actions disabled | D_INTERACTION / C_WRITE_PATH | High |
| 42 | P2 05:15 active question | active-question | Same | MIXED | Same | Missing-evidence/result flow absent | C_WRITE_PATH | High |
| 43 | P2 05:30 fieldwork check-in | fieldwork | Selected fixture/live projection; check-in local state | MOCK | No persistence from active Inspector | Save only flips component state | C_WRITE_PATH | High — `evidence-panel.tsx:546-567` |
| 44 | P2 06:15 Fieldwork Bridge | fieldwork | `/api/watch-for` → experiment overlay when gate passes | MIXED | FieldworkAssignment backend | Rich experiment fields partially synthesized | A_ADAPTER / B_HYDRATION | High — `experiment-api.ts`; `experiment-presentation.ts` |
| 45 | P2 06:05–06:30 fieldwork detail/check-in | fieldwork | Active generic Inspector with local check-in | MOCK | No durable result write | Reference-caliber display, simulated completion | C_WRITE_PATH / G_MISSING_UX_CAPABILITY | High |

## Exact runtime proof boundary

The authenticated receipt at `DESKTOP-LIVE-EVIDENCE-DEPTH-BROWSER-AUTH-VALIDATION-001` proves one stored pointer replaced `r6/r5/r2`, opened a live receipt, and linked to one user-map conclusion. It does **not** change any matrix row to wholly LIVE because:

- the recording's complete state includes context, related depth, corrections and/or movement beyond that one graph edge;
- the authoring source was deterministic/operator-fed, not normal end-user creation;
- no equivalent runtime proof exists for the other 44 states.
