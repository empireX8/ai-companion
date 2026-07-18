# Presentation Gap Audit — Production vs Frozen Reference

Campaign: `DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001`
Date: `2026-07-17`
Status: post-repair audit (human visual acceptance still required)

## Authority

- Frozen route: `/dev/orvek-v0-reference`
- Shared chrome: `components/orvek-v0-authority/evidence-panel.tsx`
- Production ModelUpdate composer: `lib/orvek-v0/production/model-update-inspector-presentation.ts`

## Root presentation defect (pre-repair)

Production ModelUpdates used a separate dump path (`ProductionModelUpdateEvidenceDetail` / `ProductionModelUpdateMovementView`) that rendered the full `/api/what-changed` report as a long generic sequence inside reference chrome. That is **not** the reference view-model contract.

Reference contract:

| Tab | Structure |
|---|---|
| Evidence / Context | Identity → Summary → Why it matters → (optional Why resurfaced) → Model movement teaser → Receipt quotes → Supporting & conflicting → Context LinkedRows → Related LinkedRows → What would change → Ask / Correct |
| Model Movement | Selected before/after (or soft empty) → Recent model movement cards → Open Model Movement report |

## State-by-state mismatch matrix

| State | Reference element | Pre-repair production | Exact mismatch | Cause | Source component | Source field | Repair | Blocked by absent data? | Human importance |
|---|---|---|---|---|---|---|---|---|---|
| 01 Empty | Centered empty copy | Same shared empty | None material | — | `EmptyState` | — | None | No | High |
| 02 Evidence top | Badge + title + subtype · time | Generic `Link Detected · Related pattern` + metadata FactGrid | Wrong primary identity; metadata dump | Thin MU title + dump renderer | `ProductionModelUpdateEvidenceDetail` | `obj.title`, `detail.item.*` | Compose title from `userFacingSummary` / affected identity; drop metadata grid | No | Critical |
| 03 Evidence viewport | Curated sections only | Recorded metadata + Affected object unavailable + card dump | Raw dump IA | Dump renderer | same | report packet + affected context | Map into ObjectDetail section order | No | Critical |
| 04 Evidence mid | Receipt quotes / +/- lists | Full evidence cards repeating packet | Density / duplication | SupportingEvidenceCards + facts TextList | evidence links ∪ facts | Dedupe + quote-only receipts + +/- phrases | No | High |
| 05 Evidence lower | LinkedRows + corrections | Fallback prose + repeated resurfaced copy | Filler / repetition | Context fallback to whyResurfaced | contextIds empty | Related from affected object; omit filler | Partial if graph thin | High |
| 06 Movement top | Title + before/after | Report dump header + confidence FactGrid | Wrong movement IA | Dump movement view | `detail.report.*` | Curated before/after only | No | Critical |
| 07 Movement mid | Recent movement cards | Evidence used / inferences / weak / guardrails… | Report sections in Inspector | Dump movement view | report sections | Remove; keep recent list | No | Critical |
| 08 Movement lower | Open report CTA | Reality gate / watch / re-entry dump then CTA | Dump before CTA | same | same | Thin MovementView parity | No | High |
| 09 Linked detail | ObjectDetail for linked id | Same chrome; possible generic titles | Generic labels on aliases | `buildLinkedClaimAliasObject` title `Linked pattern` | decisions-presentation | Use claim summary as title | No | High |
| 10 Linked lower | Receipt source text etc. | Depends on linked object | Accept live-data variance | ObjectDetail | object fields | No redesign | Live-data only | Medium |
| 11 Back restore | Parent + tab + scroll | Identity restored; scroll reset; false unavailable flash | Scroll + flash | History without scrollTop; remount key; AffectedObjectSummary false copy | `store.tsx`, panel key, AffectedObjectSummary | Persist scrollTop; restore; keep cache; remove false copy | No | Critical |
| 12 Report overlay top | OverlayShell report | Live report overlay | Identity may differ (live vs `rep-weekly`) | Live data | `openReport(canonicalReportId)` | Keep overlay path; live id | No | Critical |
| 13 Report overlay lower | Receipts cited / related | Live report body | Content live-data | report object | — | Structure only | Live-data | High |
| 14 Report close | Return to Inspector | Must not Map-detour | Previously at risk via Map navigation | overlay close | `Close report` | Close restores movement tab | No | Critical |

## Secondary defects (A–D) repair status

| Defect | Status |
|---|---|
| A False unavailable flash | Repaired: cache retained across Back; resolving uses skeleton; false copy removed |
| B Back scroll position | Repaired: `scrollTop` stored on `pushSelection`, restored on `goBack` |
| C Generic labels | Repaired in presentation composer + linked claim alias title |
| D Report overlay | Preserved live overlay identity + close return capture |

## What remains for Kay

Automated tests and paired captures do **not** certify visual parity. Kay must review the new screenshot set and matrix.

Known acceptable live-data differences:

- Production titles/summaries come from authenticated ModelUpdate content
- Production report id is the live ModelUpdate id, not `rep-weekly`
- Recent movement list may be shorter/longer than the three fixture cards
