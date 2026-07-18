# 23 — Reference → live contract inventory

Campaign: `DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001`
Date: `2026-07-18`
Status: inventory for semantic-twin live-data gate (not a visual PASS)

## Providers compared

| Lane | Route | Provider | Presentation |
|------|-------|----------|--------------|
| Canonical fixture | `/dev/orvek-v0-canonical-reference` | `createCanonicalFixtureRuntimeData` ← frozen `getObject` + authored composition | `orvek-v0-canonical/**` |
| Canonical live | `/dev/orvek-v0-canonical-live` (and `/`) | `useOrvekHybridWorkbenchDataApi` → `buildCanonicalLiveRuntimeData` | same |

## Today composition

| UI element | Fixture field | Live source field | Notes |
|------------|---------------|-------------------|-------|
| Briefing line | `today.briefingLine` | `todayCopy.briefingLine` / `today.briefingDate` | Live uses adapter date line |
| Briefing title | `today.briefingTitle` (“Your model moved in 3 places.”) | `buildTodayBriefingTitle(snapshot)` → now movement-count phrasing | Repaired to match contract when N updates exist |
| Briefing meta | authored reviews/report meta | `buildTodayBriefingMeta` | Count-based; not identical wording |
| Lead object | `today.leadId` = `d1` | hero `inspectSelectId` / `selectionId` / `movementId` | Live prefers first intelligence update over decision |
| Lead narrative | authored | `hero.summary` / object `summary` | Mapped |
| Lead what changed | authored | `hero.whatChanged` | **Was dropped**; now mapped in live-provider |
| Lead last evidence | authored | `hero.lastEvidence` | **Was dropped**; now mapped |
| Lead kicker | authored | `hero.kicker` (+ prefix) | Mapped |
| NOW rows | `today.nowRows` (4 authored) | `today.nowRows` from attention/fieldwork/loops | Depends on snapshot density |
| Movements | `today.movements` (3) | `today.movements` from intelligence + depth | Needs before/after depth |
| Resurfaced | `today.resurfacedIds` | `todayResurfacedIds` | Evidence-pointer gate |
| Report | `today.reportId` = `rep-weekly` | live MU id when `reportReady` | **No `type: report` table** |
| Primary actions | 5 with icons | adapter list; icons ArrowRight/Plus only | Icon richness thinner |

## Object graph / Inspector

| Element | Fixture | Live |
|---------|---------|------|
| Typed objects | frozen densograph `OBJECTS` | hybrid overlays (Today/Map/Timeline/Decisions/AQ/Investigations/evidence-depth) |
| Receipts / sourceText | authored | SurfacedEvidencePointer + PatternClaimEvidence + cited quotes |
| Context profile | authored `ctx-*` | Mind-context / UEL context slots (partial) |
| Map claim/conflict/loop | subtypes on objects | Rail heuristics + partial subtype stamping |
| Decision densograph | options/pros/cons/projection | SurfacedAction thinner |
| Model Movement depth | authored before/after | movement-depth API + **MU compose** (re-enabled under canonicalRuntime) |
| Report overlay | `rep-weekly` object | openReport(live MU id) |

## Rails

| Surface | Fixture composition | Live composition |
|---------|---------------------|------------------|
| Map categories | 8 authored id lists | `mapCategories` from map production API |
| Map header stats | 243 / 7 / mixed | `mapHeader` when hybrid provides |
| Decisions groups | Active/Chosen/Outcome due/Reviewed | `decisionListGroups` from surfaced actions |
| Explore grounding / movement | EXPLORE_* fixtures | live explore APIs (chat gated) |
| AQ / Investigations / Fieldwork | id lists | production explore overlays |
| Timeline groups | t1–t14 + import | projected timeline rows (no TimelineEvent table) |

## Known hard gaps (storage)

1. Weekly report as first-class `type: "report"` / `rep-weekly` — **PRODUCTION_STORAGE_CANNOT_REPRESENT_REFERENCE_CONTRACT** (live uses MU reportReady identity).
2. Durable timeline densograph ids `t1…t14` — projected only.
3. Decision options/pros/cons densograph — SurfacedAction cannot fully represent.
4. Fixture Explore sample conversation — **REFERENCE_ONLY_MOCK_BEHAVIOUR**.

## Repair targets for this gate

1. Map hero → lead whatChanged/lastEvidence/kicker (**done**).
2. Briefing title from movement count (**done**).
3. Re-enable MU inspector compose under `canonicalRuntime` (**done**).
4. Seed semantic twin through real persistence (**lib/semantic-twin-runtime-fixture.ts**).
5. Paired fixture vs live walkthrough with twin account (step8 script).
