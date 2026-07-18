# 30 — Root-cause canonical data contract map

Campaign: `DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001`
Date: `2026-07-18`
Inputs: receipt 29 (28 mismatches), `exact-fixture-round-trip-manifest.json`, `lib/exact-fixture-round-trip-gaps.ts`

## Grouping (do not patch mismatches one-by-one)

| Domain contract | Receipt 29 mismatches covered |
|-----------------|-------------------------------|
| **A. Canonical Today Composition** | briefingLine, briefingMeta, leadTitle/Narrative/WhatChanged/LastEvidence/Kicker, nowRows.*, resurfacedIds.length, primary action destinations (via composition) |
| **B. Canonical Model Movement Entry** | movements[i].previous/updated/evidence, movement order (0↔2 swap), receipt linkage/count |
| **C. Canonical Model Movement Report** | reportTitle, reportMeta, report identity/destination (DOM mis-capture of action label was symptom of missing titled report contract) |
| **D. Ordered relationships & destinations** | nowRows order, movement order, resurfaced order, lead identity ≠ first MU, See why / report overlay destinations |

Out-of-band densograph gaps (timeline/explore/decision field depth) remain secondary until A–D emit through production; they share the same “explicit ordered composition + first-class objects” pattern.

---

## A. Canonical Today Composition

| Item | Detail |
|------|--------|
| **Canonical fields** | `briefingLine`, `briefingTitle`, `briefingMeta`, `leadObjectId`, `leadObjectType`, `leadNarrative`, `leadWhatChanged`, `leadLastEvidence`, `leadKicker`, ordered `nowRows[]` (id, kicker, title, status, destination), ordered `resurfacedObjectIds[]`, ordered `movementEntryIds[]`, `reportId`, ordered `primaryActionLabels[]` |
| **Current production source** | `pickTodayHeroItem` (first intelligence update), `buildTodayBriefingMeta` (counts), derived attention/fieldwork/open-loop rows, `todayResurfacedIds` from receipt cards |
| **Why insufficient** | Composition is inferred at adapter time; cannot select decision lead while listing MU movements; cannot emit authored briefing/NOW/resurfaced order |
| **Equivalent info in storage today?** | Partial object bodies exist (MU, fieldwork, investigations, pointers) but **not** as an explicit ordered Today layout |
| **Defect layer** | **Materialisation + query/hydration** (no stored composition); provider mapping currently forced to invent lead from first MU |
| **Minimal additive contract** | `CanonicalTodayComposition` row (`userId` unique + versioned JSON payload) loaded by Today/hybrid API and mapped into `V0TodayViewProps` / canonical today fields — **not** inferred in the live presentation provider |

---

## B. Canonical Model Movement Entry

| Item | Detail |
|------|--------|
| **Canonical fields** | stable id, affected object id/type, `previous`, `updated`, `explanation`, linked receipt ids, displayed receipt count, `rank`/order, action label (`See why`), destination object/report id, timestamp |
| **Current production source** | `ModelUpdate` before/after/summary + rationale in `internalNotes` + evidence links; Today movements sliced from hero+changeRows (incidental order) |
| **Why insufficient** | Explanation often dropped in depth hydration; order is DB/`createdAt` not rank; destination/report linkage not first-class on the entry card contract |
| **Equivalent info in storage today?** | **Yes partially** — before/after/summary/links exist; order + explicit explanation + destination need composition rank + reliable rationale materialisation |
| **Defect layer** | **Materialisation** (rationale→depth), **ordering** (no rank), **provider mapping** (evidence←summary title) |
| **Minimal additive contract** | Keep `ModelUpdate` as entry body; Today composition supplies **ordered movementEntryIds**; hydrate explanation from recorded rationale; card destination = entry id / linked report id from composition |

---

## C. Canonical Model Movement Report

| Item | Detail |
|------|--------|
| **Canonical fields** | stable report id, report type, title, status, meta/briefing text, period, ordered sections, related movement ids, related receipt ids, overlay destination, generatedAt |
| **Current production source** | Hardcoded `TODAY_REPORT_OUTPUT_TITLE` (“What Changed”) + count meta; reportReady MU projection as pseudo-report |
| **Why insufficient** | No first-class report entity; cannot emit “Weekly Model Movement report” / fixture meta/sections |
| **Equivalent info in storage today?** | **No** — MU is not a report |
| **Defect layer** | **Storage** missing; adapter **hardcoding**; live provider honest but starved |
| **Minimal additive contract** | `CanonicalModelMovementReport` table + Today composition `reportId`; adapter/API use stored title/meta when report exists (keep “What Changed” only when that is the stored title) |

---

## D. Ordered relationships and destinations

| Item | Detail |
|------|--------|
| **Canonical fields** | object order, movement order, NOW order, resurfaced order, relationship type, destination type, destination identity |
| **Current production source** | Incidental query order / “first result” hero |
| **Why insufficient** | Exact round-trip requires authored order |
| **Equivalent info in storage today?** | Relationship edges exist; **order does not** |
| **Defect layer** | **Ordering** + composition materialisation |
| **Minimal additive contract** | Ordered id arrays inside `CanonicalTodayComposition` (and later map/timeline/decisions payloads on the same composition row) |

---

## Implementation choice (smallest additive)

1. **`CanonicalTodayComposition`** — authoritative Today layout + ordered refs (+ optional densograph object projections for Inspector getObject).
2. **`CanonicalModelMovementReport`** — first-class report.
3. Reuse **`ModelUpdate`** + evidence links for movement entry bodies.
4. Production path: persistence → Today/hybrid query → hydration → live provider mapping → **unchanged** canonical presentation.
5. Exact seed writes ordinary rows through these contracts with fixture→production ID map.

Automatic intelligence generation for normal accounts is **out of scope**; document representable vs not-yet-generated after the gate.
