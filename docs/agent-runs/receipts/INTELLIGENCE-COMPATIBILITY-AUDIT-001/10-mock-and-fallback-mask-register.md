# 10 — Mock and fallback mask register

**Scope:** production root/live (`OrvekWorkbenchShell` → canonical live runtime).
**Frozen `/dev` fixtures kept separate.**
**No removals this campaign.**

Kay currently has `CanonicalTodayComposition` with `source=full_reference_round_trip_seed` — **primary live mask**.

---

## Register (live/root capable)

| ID | File | Fixture/composition | Condition | Merge behaviour | Surfaces | Genuine underneath? | Mode | Honest empty | Remove now? |
|----|------|---------------------|-----------|-----------------|----------|---------------------|------|--------------|-------------|
| M1 | `lib/exact-fixture-round-trip-seed.ts` + `canonical-today-composition.ts` | `full_reference_round_trip_seed`; ids `dev-exact-rt-{user}-*` | Composition row exists | Replaces Today; `applyCompositionWorkbenchRails` owns Map/Timeline/Decisions/Explore rails | Today, Map, Timeline, Decisions, Explore, Reports, Movement cards, headers | Yes (patterns/UM/MU/RI) but **masked** | **Replace** | N/A while present | **Breaks** seed parity — remove only after surface proofs |
| M2 | same | Map header 243 / 7 questions | composition workbench | replaces live headerStats | Map | live counts exist | Replace | live 0/— | after unmask |
| M3 | same | modelStatusCard 4/7/3 | composition | TopBar status | Nav badge | live generic copy | Replace | yes | after unmask |
| M4 | composition import ic1–ic4 | seed candidates | composition | **Overridden** by live importReview | Import | live 53 pending | Live wins | empty if none | low risk |
| M5 | `hybrid-workbench-api.ts` readiness gates | — | merge not ready | shell emptyCopy only | multiple | in flight | Withhold | yes | **Keep** |
| M6 | `injectLiveMovementIdsIntoTimelineGroups` | live MU ids | timeline not fully merged | Today-lane supplement | Timeline | genuine MU | Supplement | — | Keep |
| M7 | today evidence depth gate | blocks r6/r5/r2 auto-sub | production | withhold thin pointers | Today/Inspector | — | Gate | honest empty | **Keep** |
| M8 | `map-profile-facts.ts` defaultSummary | Interests/Constraints prose | section missing + facts | static summary + live facts | Map | facts genuine | Supplement | empty facts copy | low |
| M9 | `mock-api.ts` createMockOrvekDataApi | zip densograph | **not** root base (`EMPTY_ORVEK_DATA_API`) | — | tests/dev | — | — | — | root N/A |
| M10 | `fixture-provider.ts` | full fixture | `/dev` reference only | — | — | — | — | — | separate |
| M11 | overlays REFERENCE_IMPORT_CANDIDATES | ic1–ic4 | `referenceSurface===true` only | — | Import | — | — | — | LIVE N/A |
| M12 | CaptureOverlay fake saved | — | overlay capture | no API | Capture | — | Fake | — | unused if TopBar→journal-chat |
| M13 | SearchOverlay zip suggestions | m-loop-1,d1,… | search overlay | — | Search | — | Static | — | unused on prod TopBar path |
| M14 | reference-memory fallback | up to 3 recent actives | no scored memories | inject | Chat | genuine rows | Fallback | empty if zero | behavioral |

---

## Surface summary (Kay root)

| Surface | Typical truth | Mask risk |
|---------|---------------|-----------|
| Today | seed densograph | **High (M1)** |
| Map | seed rails vs live UM/patterns/facts | **High (M1)** |
| Decisions | seed groups vs SurfacedActions | **High (M1)** |
| Experiment | seed f* vs fieldwork | **High (M1)** |
| Explore | seed rails; chat prefers live when ready | **Medium–High** |
| Timeline | seed t1… vs live MU | **High (M1)** |
| Inspector | follows selected graph | High when graph seeded |
| Reports / Movement | seed weekly report | **High** |
| Import | **live 53** | Low (override) |
| Nav badges | seed status card | **High (M3)** |

---

## Honest empties (when genuine absent and seed gone)

- Map: “Nothing on your map yet.” / section emptyFactsCopy
- Decisions: “No decisions in your model yet.”
- Explore free: “Ask the model anything to begin.”
- Import: empty/disabled until pending
- Today: briefingMeta / “Nothing to show yet.”

JSON twin: `surface-mock-mask-register.json`.
