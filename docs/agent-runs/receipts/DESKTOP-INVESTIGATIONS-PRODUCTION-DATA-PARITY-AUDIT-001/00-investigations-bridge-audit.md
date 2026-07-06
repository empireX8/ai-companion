# 00 Investigations Production Data Parity — Bridge Audit

## Branch context

- Branch audited: `desktop-investigations-production-data-parity-audit-001`
- Base: `staging` after #90 merge (Active Questions bridge complete)
- Root workbench path: `OrvekWorkbenchShell` → `useOrvekHybridWorkbenchDataApi` → `Workbench` → `ExplorePage`
- **Already bridged in Explore:** Active Questions, Fieldwork Bridge (plus Today, Map, Timeline, Decisions at root)
- **Still reference/mock at root:** Investigations tab, Free Explore chat

## Product rule (non-negotiable)

**Reference visual/runtime parity beats production data visibility.**  
If production investigation data is thin, raw, duplicated, overlaps Active Questions, or fails readiness, the Investigations tab must stay on reference `inv-*` mock — not partially leak production rows.

---

## Active root Investigations component path

```
app/(root)/layout.tsx
  → OrvekWorkbenchShell (components/orvek-workbench/OrvekWorkbenchShell.tsx)
  → useOrvekHybridWorkbenchDataApi()
  → Workbench (components/orvek-v0/workbench.tsx)
  → OrvekDataProvider
  → PageContent case "explore"
  → ExplorePage (components/orvek-v0/pages/explore.tsx)
  → Investigations()  ← tab renderer
  → EvidencePanel (components/orvek-v0/evidence-panel.tsx) via Inspector rail
```

Legacy parallel route (quarantined from root shell; not the hard-swapped path):

```
app/(root)/(routes)/explore/page.tsx → OrvekExplorePage → ExplorePage (same component)
```

Do **not** restore `V0ExploreView`, route-first `/investigations` navigation, or global `displayContract: production` on the hybrid root API.

---

## Audit answers (1–13)

### 1. What component renders the Investigations tab in the hard-swapped workbench?

**`Investigations()`** inside `components/orvek-v0/pages/explore.tsx`, mounted when `ExplorePage` tab state is `"investigations"`.

Parent shell: `ExplorePage` sets `setExploreActive(true)` on mount (Inspector movement rail).

---

### 2. What reference/mock data shape does Investigations expect?

Reference id list (when production gate fails): `["inv-1", "inv-2", "inv-3"]`.

Per-object contract (`type: "investigation"`) from zip / `createMockOrvekDataApi`:

| UI region | Fields consumed |
|-----------|-----------------|
| Thread list | `title`, `status`, `evidenceCount` |
| Detail header | `title`, `status` |
| Why it matters | `whyItMatters` |
| Hypotheses | `hypotheses[]` (optional block) |
| Missing evidence | `missingEvidence[]` (optional block) |
| Linked objects | `relatedIds[]` → `getObject(relatedId).title` |
| Inspector evidence | `receiptIds[]`, `contextIds[]` (via EvidencePanel graph) |
| Secondary CTAs | Deferred when `isProductionDisplay(data)` |

Provider slots used:

- `exploreInvestigationIds?: string[]`
- `getObject` / `getObjects` (merged hybrid graph + zip fallback)
- `emptyCopyBySlot.exploreInvestigationsEmptyList` / `exploreInvestigationsEmptyDetail`

**Not present today:** `exploreInvestigationSelectedId`, `investigationsIsLoading`.

Production-shaped path in component today:

```ts
const ids = isProduction ? (exploreInvestigationIds ?? []) : ["inv-1", "inv-2", "inv-3"]
```

`isProductionDisplay(data)` is **never true** on hybrid root (no global `displayContract`), so Investigations always shows reference `inv-*` even though Active Questions now uses `hasLiveQuestions` pattern.

---

### 3. What ids does the reference tab use, and how does Inspector resolve them?

| Reference id | Mock title (summary) | Nested links |
|--------------|----------------------|--------------|
| `inv-1` | Why do I reopen scope before design? | `m-loop-1`, `aq-1`, `f1` |
| `inv-2` | Does visual prototyping reduce architecture uncertainty? | `d1`, `f2`, `aq-2` |
| `inv-3` | How should Explore extract useful model data from conversation? | `mu-3`, `aq-4` |

**Selection flow:**

1. Thread click → `setActiveId(id)` + `select(id)` (workbench store)
2. Linked chip click → `select(relatedId)`
3. EvidencePanel → `useOrvekObjectGraph().getObject(selectedId)` → provider `getObject` first, then zip fallback (`resolveOrvekObjectFromGraph`)

No route navigation. No `resolve*OpenSelectionId` helper on Investigations tab today (unlike Active Questions / Fieldwork Bridge).

---

### 4. What production APIs / data sources currently exist for investigations?

| Source | Path / helper | Explore Investigations use today |
|--------|---------------|----------------------------------|
| **Engine list** | `GET /api/investigations` | No — returns all user rows, engine pagination/filters, **no public visibility guard** |
| **Engine detail** | `GET /api/investigations/[id]` | No — full `Investigation` row incl. JSON blobs, **no visibility/lifecycle guard** |
| **Engine mutate** | `POST /api/investigations`, `PATCH /api/investigations/[id]` | Engine clients only |
| **Public active-questions list** | `GET /api/active-questions` | Used by Today reentry, Timeline semantic layer, Map preview — **same `Investigation` rows**, filtered |
| **Public active-questions detail** | `GET /api/active-questions/[id]` | Thin projection (no hypotheses JSON) |
| **Public evidence continuity** | `GET /api/active-questions/[id]/evidence` | Target type `investigation` via public guard — **not Investigations-tab branded** |
| **Public visibility helper** | `buildPublicActiveInvestigationWhere` | Active Questions API only |
| **Safe slice mappers** | `toActiveQuestionListItem`, `toActiveQuestionDetailItem` in `public-intelligence-safe-slice.ts` | Map `competingTheories` → string[], `evidenceNeeded` → string[] on **detail** shape — not exposed on active-questions routes |
| **Internal review** | `/api/internal/investigations/*` | Operator-only; not for workbench |
| **Hybrid root hook** | `useOrvekHybridWorkbenchDataApi` | Fetches Today/Map/Timeline/Decisions/Fieldwork/Active Questions — **no investigations fetch** |
| **Explore production builder** | `buildExploreProductionDataApi` | Sets `exploreInvestigationIds: []` (legacy `/explore` route only) |

**There is no bounded public “Explore Investigations list” endpoint or `fetchInvestigationItems()` helper today.**

---

### 5. Are those APIs public/user-facing or engine/internal only?

| API family | Audience | Safe for Explore tab without new gate? |
|------------|----------|----------------------------------------|
| `/api/active-questions*` | Authenticated user, **public-filtered** (`user_visible`, lifecycle allowlist, status allowlist) | Partial — list is display-safe but semantically **Active Questions**, not Investigations threads |
| `/api/investigations*` | Authenticated user, **engine CRUD** | **No** — includes `internal_only` rows, proposed candidates, unnormalized JSON |
| `/api/internal/investigations/*` | Internal operator | **No** |
| Today / Timeline fetches of active-questions | User-facing side reads | Same overlap as Active Questions |

---

### 6. Do investigation rows overlap with Active Questions rows?

**Yes — same `Investigation` Prisma model and often the same rows.**

- Active Questions public filter: `visibility: user_visible`, status ∈ `{open, gathering_evidence, testing, resolving, reopened}`, candidate lifecycle ∈ `{null, promoted}`.
- Active Questions hybrid merge already surfaces ready rows as `type: "active-question"` on `exploreQuestionIds`.
- Reference mock **splits by id prefix** (`aq-*` vs `inv-*`) and object type, but production UUIDs have no such split.
- Today reentry and Timeline semantic layer both load investigations via **`/api/active-questions`**, not a separate investigations list.

**Risk:** Naïvely bridging Investigations from the same filter duplicates Active Questions in two tabs with different presentation contracts.

**Mitigation required before merge:** architect-defined complementary filter **or** explicit exclusion of `exploreQuestionIds` at hybrid merge time **or** status split (e.g. resolved-only threads on Investigations — product decision).

---

### 7. Which production fields are display-ready?

From **public active-questions list projection** (`ActiveQuestionItem`):

- `id`, `title`, `organizingQuestion`, `status`, `statusLabel`, `createdAt`, `updatedAt`

From **public active-questions detail** (still thin for Investigations UI):

- Above plus `resolvedIntoUserMapConclusionId` / href

From **engine investigation row** (if ever fetched — needs normalization first):

- `title`, `organizingQuestion`, `status` (with `formatInvestigationStatus`)
- `competingTheories`, `evidenceNeeded` as JSON → can map to `hypotheses` / `missingEvidence` via `toStringArray` (pattern in `toActiveQuestionDetailItem`)
- `resolutionSummary`, `reopenReason` (text, need length/safety caps)

From **evidence continuity** (when row passes public guard):

- Inspector continuity items via `/api/active-questions/[id]/evidence` (works for investigation target type)

---

### 8. Which production fields are raw JSON blobs, missing, stale, duplicated, or unsafe?

| Risk | Detail |
|------|--------|
| **No public Investigations list** | Cannot bridge tab without new contract or strict reuse rules |
| **`/api/investigations` unguarded** | Returns `internal_only`, non-promoted candidates, all statuses |
| **Raw JSON** | `competingTheories`, `evidenceNeeded` — need `toStringArray` + reject non-strings / oversized blobs |
| **Missing UI fields** | List APIs lack `whyItMatters` (only `organizingQuestion`), `hypotheses`, `missingEvidence`, `relatedIds`, `receiptIds`, `evidenceCount` |
| **organizingQuestion ≠ whyItMatters** | Reference UI treats them separately; only safe mapping candidate is capped `organizingQuestion` → `whyItMatters` |
| **Duplicate tab rows** | Same Investigation UUID in Active Questions + Investigations |
| **Stale `isProductionDisplay` gate** | Tab still uses global contract; hybrid never sets it (Active Questions already moved to `hasLiveQuestions`) |
| **No `exploreInvestigationSelectedId`** | Provider field not defined; selection sync pattern incomplete vs other bridges |
| **Linked objects missing** | No public projection of understanding links → `relatedIds` for Explore tab chips |
| **Evidence count fiction** | Reference list shows `evidenceCount`; production list does not — live rows would show `undefined linked` unless omitted or derived |
| **Engine fields leak** | `seedType`, `priority`, `candidateLifecycleStatus`, `visibility` must not surface raw in Explore UI |
| **Resolved/abandoned rows** | Excluded from Active Questions statuses; Investigations product meaning undefined |

---

### 9. What would break if production investigation IDs replaced reference `inv-*` IDs without a bridge?

| Breakage | Cause |
|----------|--------|
| Empty thread list | `getObject(uuid)` undefined — no hybrid merge registers `type: "investigation"` objects |
| Blank detail panels | Missing `whyItMatters`, `hypotheses`, `missingEvidence` on thin rows |
| Broken linked chips | `relatedIds` not populated; provider has no aliases |
| Inspector evidence empty | `receiptIds` not wired; evidence continuity not fetched into graph |
| List meta `undefined linked` | `evidenceCount` absent on production objects |
| Dual-tab duplication | Same UUID shown as active-question and investigation |
| False production mode | Setting global `displayContract` disables reference CTAs / forces empty skeletons |
| Internal row leak | Using `/api/investigations` directly exposes non-public investigations |
| Zip fallback confusion | Production UUID colliding with zip id unlikely, but related zip ids (`aq-1`, `f1`) still resolve while production links missing |

---

### 10. Does EvidencePanel have enough provider aliases to resolve live investigation objects?

**Partially — mechanism exists; Investigations-specific graph not populated.**

- EvidencePanel uses `useOrvekObjectGraph()` → provider-first, zip fallback.
- Renders `hypotheses`, `missingEvidence`, `receipts`, `related` when present on `OrvekObject`.
- Corrections rail includes `type === "investigation"`.
- Active Questions bridge registers production objects as `type: "active-question"` (not `investigation`) — **different tab contract**.
- No hybrid `mergeInvestigationsOverlay` yet; no `buildInvestigationsProductionDataApi`.
- Public evidence path exists only through **active-questions evidence route** with public guard — usable for overlapping rows if inspector target id matches, but Investigations tab does not fetch/register continuity into `receiptIds`.
- `investigation` is **not** an `InspectorSelectableObjectType`; linked inspector targets need alias pattern (cf. `resolveActiveQuestionsOpenSelectionId`, map conclusion aliases).

**Conclusion:** Provider lookup infrastructure is sufficient; **Investigations production object registration + link/evidence projection is missing.**

---

### 11. What public list/filter contract is needed before bridging?

A **new bounded public contract** (recommended: dedicated endpoint, mirror `fetchActiveQuestionItems` / `fetchWatchForItems`):

**Required properties:**

1. **Auth:** Clerk user scoped
2. **Visibility:** `visibility: user_visible` + candidate lifecycle allowlist (same fail-closed pattern as Active Questions)
3. **Status filter:** Product-defined set for “threads” — must be **documented relative to Active Questions** (e.g. complement or superset with dedupe)
4. **Overlap exclusion:** Exclude ids already merged into `exploreQuestionIds` **or** define disjoint status semantics
5. **Projection:** Safe list fields only (`id`, `title`, `organizingQuestion`, `status`, `statusLabel`, `updatedAt` minimum)
6. **Detail enrichment (optional second fetch):** Normalized `competingTheories` → hypotheses, `evidenceNeeded` → missing evidence; cap string lengths; reject raw JSON leak
7. **Limit:** Bounded `take` (e.g. 20)
8. **Response shape:** `{ items: InvestigationThreadItem[] }` consistent with fetch helper returning `[]` on failure
9. **No route navigation:** Workbench consumes provider ids only

**Not sufficient:** Raw `GET /api/investigations` or unfiltered reuse of `GET /api/active-questions` without exclusion rules.

---

### 12. Should Investigations bridge before or after Explore chat?

**Investigations before Explore chat.**

| Factor | Investigations | Explore chat |
|--------|----------------|--------------|
| Pattern maturity | Same tab-bridge pattern as Active Questions / Fieldwork (proven) | Requires session lifecycle, streaming, root handler wiring |
| API surface | Needs new public list contract + presentation gate | Multiple endpoints + `OrvekPageHandlersProvider` at root |
| Risk | Contained to one tab + hybrid merge slice | Movement rail, grounding, composer, fake-send risk |
| Dependency | Benefits from Active Questions bridge learnings (overlap exclusion) | Independent but larger |

Free Explore chat should remain a **separate multi-slice track** after Investigations tab alignment.

---

### 13. Smallest safe next implementation slice after this audit?

**Slice A (recommended first): Public Investigations list contract — design + tests only**

- Architect/product decision: status filter + Active Questions overlap rule
- Add `buildPublicExploreInvestigationWhere` (or extend visibility module) with explicit exclusion semantics
- Add `GET /api/explore-investigations` or equivalent bounded route + `fetchExploreInvestigationItems()` returning `[]` on failure
- **No** hybrid hook, **no** tab changes yet

**Slice B: Presentation readiness gate (code, no UI)**

- `investigations-presentation.ts` — normalize text, map JSON → hypotheses/missingEvidence, `shouldMergeInvestigationsProductionApi`, dedupe ids
- `buildInvestigationsProductionDataApi` — register `type: "investigation"` objects
- Tests only (mirror `active-questions-presentation-readiness.test.ts`)

**Slice C–E (later):** hybrid overlay merge → root hook fetch → `Investigations()` tab alignment (`hasLiveInvestigations` pattern)

Do **not** start tab alignment until Slices A+B pass audit + tests.

---

## Recommended gate requirements (implementation)

| Gate | Requirement |
|------|-------------|
| Normalize | Strip `displayContract`; cap title/summary/why/hypothesis strings; reject error-like raw text |
| Row ready | Non-empty title + organizingQuestion; known public status; safe id; normalized hypotheses/evidence arrays |
| Merge ready | `shouldMergeInvestigationsProductionApi()` false when loading, empty, duplicate ids, unsafe JSON, overlap with merged Active Questions |
| Hybrid | `mergeInvestigationsOverlay` — set `exploreInvestigationIds`, optional `exploreInvestigationSelectedId`, `investigationsIsLoading`; **no** global `displayContract` |
| Tab | `hasLiveInvestigations = (exploreInvestigationIds?.length ?? 0) > 0` — **not** `isProductionDisplay` |
| Overlap | Fail closed or filter out ids present in `exploreQuestionIds` |
| Inspector | `resolveInvestigationsOpenSelectionId` for linked inspector targets; optional linked-object aliases |
| Evidence | Strategy: lazy evidence continuity → `receiptIds` or inspector-only continuity (honest empty if missing) |
| Fallback | Reference `inv-1`…`inv-3` when gate fails |

---

## Proposed minimal implementation plan

| Phase | Deliverable |
|-------|-------------|
| **0 — Audit** | This receipt ✅ |
| **1 — Public list contract** | Filter definition + bounded API + fetch helper + route tests |
| **2 — Presentation gate** | `investigations-presentation.ts` + `buildInvestigationsProductionDataApi` + readiness tests |
| **3 — Hybrid overlay** | `mergeInvestigationsOverlay` 8th arg (or ordered after active questions) + hybrid-workbench-api tests |
| **4 — Root fetch** | `useOrvekHybridWorkbenchDataApi` wiring + hybrid-fetch tests |
| **5 — Tab alignment** | `Investigations()` only — `hasLiveInvestigations`, selection sync, inspector resolution + tab alignment tests |
| **6 — Visual check** | Product-owner sign-off before commit |

**Explicit non-touch:** Active Questions, Fieldwork Bridge, Free Explore chat, Today/Map/Timeline/Decisions/Experiment bridges, old production shell.

---

## Tests required before implementation

| Layer | Tests |
|-------|--------|
| Public API | Auth 401, visibility guard, lifecycle guard, status filter, overlap exclusion, empty list, limit bound |
| Presentation | `investigations-presentation-readiness.test.ts` — normalize, unsafe JSON rejection, thin row rejection, overlap with active questions, displayContract leak rejection |
| Hybrid | `hybrid-workbench-api.test.ts` — merge/fallback, dedupe, no global contract, parity regressions |
| Hook | `investigations-hybrid-fetch.test.ts` — fetch wiring, Nth hybrid arg, loading fallback |
| Tab | `investigations-tab-alignment.test.ts` — consumes `exploreInvestigationIds`, reference fallback, inspector selection, no `/investigations` navigation |
| Regression | Active Questions, Fieldwork, chat untouched; shell quarantine; full parity suite |

Reuse patterns from:

- `lib/__tests__/active-questions-presentation-readiness.test.ts`
- `lib/__tests__/active-questions-hybrid-fetch.test.ts`
- `lib/__tests__/active-questions-tab-alignment.test.ts`
- `lib/__tests__/fieldwork-bridge-alignment.test.ts`

---

## Visual check

| Slice | Visual check |
|-------|----------------|
| **This audit** | Not required |
| **Implementation (tab alignment slice)** | **Required before commit** — thread list/detail, linked chips, Inspector evidence, reference fallback, no duplication with Active Questions |

---

## Explicit non-goals (this audit)

- No runtime code changes
- No Investigations bridge implementation
- Active Questions, Fieldwork Bridge, Explore chat, Today, Map, Timeline, Decisions, Experiment untouched
- No `/investigations` route navigation
- No old production shell restoration
- No commits in this slice

---

## Recommendation

**Do not bridge Investigations from `/api/investigations` or reuse `/api/active-questions` without an explicit overlap policy.**

Proceed in order:

1. **Product/architect decision** on public Investigations filter vs Active Questions (complement, exclude, or status split)
2. **Bounded public list API + fetch helper** (fail-closed, `[]` on error)
3. **Presentation readiness gate** (normalization only — mirror Active Questions Slice 1)
4. Hybrid merge → hook fetch → tab alignment (separate PRs)

**Investigations before Explore chat.** Chat remains the largest remaining Explore surface and should not block Investigations tab parity.

**Smallest safe next slice:** Public Investigations list contract definition + route/fetch helper scaffold with tests — **no tab or hybrid changes**.
