# Phase 3C — Product / Design Architecture Contract

**Date:** 2026-06-12  
**Status:** CONTRACT LOCKED — docs-only (3C-1)  
**Validation base:** Backend `main @ a3c3cda`; Mobile reference `main @ 7ba728f`  
**Sources:** Phase 3C-0 audit; `docs/step2c-product-surface-ui-map.md`; Phase 6 mobile parity closeout; mobile implementation inspection  
**Scope:** Product and design architecture only. No backend intelligence work. No mobile UI implementation in this slice.

---

## 1. Phase 3C purpose

Phase 3C is **not visual polish alone**.

Phases 3A and 3B proved that mobile intelligence surfaces can be wired, backend-derived, and trust-safe. Phase 3B added mirror-object shaping and a light card hierarchy. The remaining gap is **product architecture and content shaping**: the app still reads as a vertically stacked intelligence dashboard with nicer cards rather than a **private personal intelligence operating system**.

Phase 3C turns working intelligence surfaces into a **coherent product architecture** by locking:

- what MindLab is and is not
- what every surface is for
- mobile information hierarchy (especially Today and Your Map)
- evidence/receipt representation rules
- visual identity direction (dual-mode, hierarchy-first)
- a staged implementation roadmap for 3C-2 onward

Every later mobile design or code slice must follow this contract. Random UI changes without architecture alignment are out of scope.

---

## 2. Product category

### Preferred category

```text
Evidence-backed personal intelligence system
```

### Public-facing framing

```text
A private operating system for understanding yourself.
```

Alternate suite-ready line:

```text
Personal intelligence. Life investigation.
```

### MindLab must not be framed as

- therapy app
- wellness app
- generic AI chatbot
- mood tracker
- productivity dashboard
- self-care companion
- AI friend / mentor app

### Suite context

MindLab may later sit inside a broader suite / OS family (MindLab / MindOS, FinanceOS, CreatorOS, StudyOS, etc.). Product language and visual identity must **not** be so therapy-coded that they cannot extend into a wider intelligence / productivity suite.

---

## 3. Core product thesis

### Frame

```text
Capture → reveal → understand → investigate → act → update the model
```

### Mirror objects

Life evidence transforms into **mirror objects** — structured, named, evidence-backed claims the user can inspect, correct, and act on:

| Object | Role |
|--------|------|
| User Map conclusions | Structured self-model / operating-system statements |
| Patterns | Repeated operating loops |
| Tensions | Competing pulls |
| Model updates (`What Changed`) | Explicit model movement events |
| Active Questions | Unresolved investigations |
| Watch For | Fieldwork / attention prompts |
| Actions / fieldwork | Experiments that test the model |
| Receipts / evidence trails | Proof linking claims to sources |

### Chat vs pages

- **Pages and cards** are mirror objects, not conversation.
- **Journal Chat** = capture.
- **Explore** = conversational interpretation.
- **Today** = living mirror (orientation, not analysis center).

---

## 4. Surface doctrine

These rules are non-negotiable for Phase 3C and later slices:

```text
Cards name the object.
Details show the basis.
Chat does interpretation.
Receipts prove the claim.
Actions test the model.
Timeline shows model movement.
```

### Surface roles (locked)

| Surface | Role |
|---------|------|
| Journal Chat | Capture |
| Explore | Interpretation |
| Today | Living mirror |
| Your Map | Structured self-model / operating system |
| Patterns | Repeated operating loops |
| Tensions | Competing pulls |
| Actions / Fieldwork | Experiments |
| Timeline | Continuity / model movement |
| Library / Receipts | Proof archive |
| What Changed | Model update feed |
| Active Questions | Unresolved investigations |
| Watch For | Attention prompts |
| Media | Future proof / input layer |

### Reflection meaning

**Reflection** means mirror reflection — looking at yourself in a mirror — not reflective journaling as a product category.

---

## 5. Surface-by-surface contract

### Today

| Field | Contract |
|-------|----------|
| **User question** | What matters right now in my operating picture? |
| **Dominant object** | One hero mirror object (strongest current signal) |
| **Secondary** | Compact capture, model updates (max 2), one Watch For, one Active Question, one continue-session |
| **Hidden** | Raw receipts, long evidence, backend scope stats, full lists |
| **Never appear** | Full pattern lists, fake insight-of-day, therapy prompts, mood dashboard as hero |
| **Payoff** | “I see myself clearly today” — orientation without overwhelm |
| **Borrow** | Finch daily return anchor; Notion dashboard clarity |
| **MindLab twist** | Hero = evidence-backed mirror object + model movement since last visit |

### Journal

| Field | Contract |
|-------|----------|
| **User question** | What am I capturing as raw material? |
| **Dominant object** | Capture composer |
| **Secondary** | Recent entries (limited preview) |
| **Hidden** | Analysis, pattern claims, word-count gamification |
| **Never appear** | Intelligence cards, model conclusions |
| **Payoff** | Low-friction deposit into the engine |
| **Borrow** | Reflect frictionless capture |
| **MindLab twist** | Capture-only; interpretation lives in Explore and mirror pages |

### Journal Chat

| Field | Contract |
|-------|----------|
| **User question** | Help me capture through dialogue |
| **Dominant object** | Conversation thread |
| **Secondary** | Voice input, session continuity |
| **Hidden** | Intelligence cards inline |
| **Never appear** | Explore-style interpretation as default mode |
| **Payoff** | Guided capture without analysis overload |
| **Borrow** | Rosebud conversational capture ergonomics (mechanic only) |
| **MindLab twist** | Explicit capture-mode chrome distinct from Explore |

### Explore

| Field | Contract |
|-------|----------|
| **User question** | Help me interpret this |
| **Dominant object** | Chat with optional seeded mirror context |
| **Secondary** | Linked pattern / tension / action chip |
| **Hidden** | Static conclusions as primary UI |
| **Never appear** | Therapy branding, persona characters |
| **Payoff** | Sense-making after mirror priming |
| **Borrow** | Mindsera depth-on-demand prompts; Character.AI session continuity (mechanic only) |
| **MindLab twist** | Opens from mirror detail with context; does not replace mirror pages |

### Your Map

| Field | Contract |
|-------|----------|
| **User question** | How does MindLab currently model me? |
| **Dominant object** | Current Understanding / operating-system statement |
| **Secondary** | Conclusion cards, confidence, linked signals |
| **Hidden** | Evidence drawer, correction history, raw backend families |
| **Never appear** | Profile-page layout, therapy insight tone, long synthesis paragraphs on list |
| **Payoff** | “This is my living self-model” |
| **Borrow** | Notion workspace area pages |
| **MindLab twist** | Structured OS panel, not mind-map graph (yet) |

### Patterns

| Field | Contract |
|-------|----------|
| **User question** | What loops keep repeating? |
| **Dominant object** | Named pattern + confidence |
| **Secondary** | Family grouping |
| **Hidden** | Evidence list, related tensions |
| **Never appear** | Full user model, backend scope metadata on list |
| **Payoff** | Pattern recognition with basis on tap |
| **Borrow** | Mindsera structured card density (mechanic only) |
| **MindLab twist** | Card names the loop; detail shows basis |

### Tensions

| Field | Contract |
|-------|----------|
| **User question** | What pulls compete inside me? |
| **Dominant object** | Two-pull frame + current read |
| **Secondary** | Context tags, related patterns |
| **Hidden** | Evidence timeline |
| **Never appear** | Problem list / diagnosis framing |
| **Payoff** | Tension clarity without pathology |
| **Borrow** | Stoic insight timing (mechanic only) |
| **MindLab twist** | Contradictions as investigation prompts |

### Actions / Fieldwork

| Field | Contract |
|-------|----------|
| **User question** | What should I try or watch for? |
| **Dominant object** | One suggested move or one watch prompt |
| **Secondary** | Linked source (pattern / tension), outcome capture |
| **Hidden** | Outcome history depth |
| **Never appear** | Generic todo clutter |
| **Payoff** | Experiment / fieldwork loop closure |
| **Borrow** | Finch micro-completion (mechanic only) |
| **MindLab twist** | Actions = experiments; Watch For = fieldwork; outcomes feed model |

### Timeline

| Field | Contract |
|-------|----------|
| **User question** | How has my model moved over time? |
| **Dominant object** | Model movement section |
| **Secondary** | Grouped meaningful activity |
| **Hidden** | Raw activity noise (default off) |
| **Never appear** | Activity spam feed, dashboard widgets |
| **Payoff** | Continuity and model movement awareness |
| **Borrow** | Readwise recall / resurfacing |
| **MindLab twist** | Epistemic chronology, not social feed |

### Library / Receipts / Evidence

| Field | Contract |
|-------|----------|
| **User question** | What is the proof? |
| **Dominant object** | Source index + receipt metadata |
| **Secondary** | Filters by type |
| **Hidden** | Full private evidence text on mobile (policy) |
| **Never appear** | Intelligence synthesis as primary content |
| **Payoff** | Trust and auditability |
| **Borrow** | Readwise highlight archive |
| **MindLab twist** | Reverse traversal: receipt → claims it supports |

### What Changed / Model Updates

| Field | Contract |
|-------|----------|
| **User question** | What shifted in my model? |
| **Dominant object** | Change headline |
| **Secondary** | Affected object type, link to target |
| **Hidden** | Driving evidence (expand) |
| **Never appear** | Duplicate streams alongside Intelligence Updates on Today |
| **Payoff** | Explicit “your understanding changed” events |
| **Borrow** | Reflect periodic review rhythm |
| **MindLab twist** | Single Model Updates stream on Today |

### Active Questions

| Field | Contract |
|-------|----------|
| **User question** | What is unresolved? |
| **Dominant object** | Organizing question |
| **Secondary** | Status, linked map conclusion |
| **Hidden** | Evidence list, internal IDs |
| **Never appear** | Premature answers, raw backend labels |
| **Payoff** | Investigation momentum |
| **Borrow** | Mindsera framework thread structure (mechanic only) |
| **MindLab twist** | Unresolved investigations, not Q&A list |

### Watch For

| Field | Contract |
|-------|----------|
| **User question** | What signal should I notice? |
| **Dominant object** | Single notice prompt |
| **Secondary** | Reason, linked object |
| **Hidden** | Evidence spam |
| **Never appear** | Homework / task checkbox framing |
| **Payoff** | Low-effort observation loop |
| **Borrow** | Finch single daily prompt (mechanic only) |
| **MindLab twist** | Complete via check-in in under 20 seconds |

### Media

| Field | Contract |
|-------|----------|
| **User question** | What visual / audio proof exists? |
| **Dominant object** | Media index |
| **Secondary** | Link to source journal entry |
| **Hidden** | Analysis |
| **Never appear** | Intelligence cards |
| **Payoff** | Future proof / input layer |
| **Borrow** | — |
| **MindLab twist** | Proof attachments, not content gallery |

### Settings / Account

| Field | Contract |
|-------|----------|
| **User question** | Who am I here; is my data safe? |
| **Dominant object** | Auth status, privacy, export |
| **Secondary** | Theme (when ready), upgrade |
| **Hidden** | Backend internals |
| **Never appear** | Intelligence content |
| **Payoff** | Trust in private instrument |
| **Borrow** | Reflect E2E trust positioning |
| **MindLab twist** | Suite-ready account shell |

---

## 6. Today hierarchy contract

**Today is the next implementation target (3C-2).**

Today must **not** be a vertical dashboard of equal-weight feeds. It is the **living mirror / daily command surface**.

### Required section order

1. **Hero mirror object** — one dominant current signal (model update, active tension, or top map movement — backend-ranked when available; documented fallback hierarchy when not)
2. **Compact capture strip** — reduced footprint vs current hero composer block
3. **Model Updates stream** — merged Intelligence Updates + What Changed, **max 2 visible**
4. **Watch For** — max 1 preview
5. **Active Question** — max 1 preview
6. **Continue session** — max 1 (Journal Chat or Explore)
7. **Pattern OR Tension highlight** — max 1 each; **omit both** if hero already uses that object type
8. **View all / section anchors** → Intelligence tab (`patterns` screen) sections: your-map, what-changed, active-questions, watch-for

### Today explicit forbiddens

- Long evidence blocks
- Raw receipts inline
- Backend scope stats (e.g. “Scope: X messages across Y sessions”)
- Duplicate Intelligence Updates + What Changed streams (must merge into Model Updates)
- Generic repeated “Recent conversation” rows when backend provides label/preview
- Full pattern or tension lists
- Raw backend labels, internal IDs, dev fixture terms
- Therapy / wellness “daily mood” framing as the **main** object (check-in may exist as secondary telemetry, not hero)

### Today empty states (evidence-honest)

- No model updates: calm copy — keep capturing; model will move when signal accumulates
- No investigations: no active questions right now
- No fieldwork: hide Watch For section
- No suggested actions: suggestions appear when enough signal exists

---

## 7. Your Map contract

Your Map is the **core differentiation surface** — the structured self-model / operating-system panel.

### List rules

- **No** long backend synthesis paragraph on list cards
- **One** operating-system statement max on list (truncated if needed)
- Card shows: named conclusion, confidence/status chip, date, one-line OS statement
- **Not** a profile page; **not** a therapy insight page
- **Do not** expose raw backend family names as primary user language

### Detail rules (target: 3C-3)

- Full-screen detail (same rhythm as Pattern/Tension detail screens)
- Sections: what this says about your operating system → what it is based on → uncertainty → related signals → correction affordance (UI-only until backend phase)
- Evidence: metadata rows per §8, not placeholder spam
- Link outward to Patterns, Tensions, Library as verified

### Current mobile gap (reference state @ 7ba728f)

Your Map lives embedded in Intelligence tab (`PatternsList`) with inline accordion detail and full `operatingSystemStatement` on list — **violates list rules above**. 3C-3 addresses this.

---

## 8. Evidence / receipt representation contract

### Hard rule

**Never** render repeated rows saying:

```text
Evidence text is hidden on mobile.
```

This placeholder may exist once as a policy note in a detail footer if needed; it must **not** repeat per evidence row.

### Mobile evidence row must show (when backend provides)

- `sourceTypeLabel`
- Date (`createdAt` formatted)
- Safe `evidenceSummaryLabel` when available
- Receipt / signal count when useful at list level
- Link to Library / proof archive when href is supported
- Pattern / Tension source navigation when verified (`resolveEvidenceSourceNavigationTarget`)

### Raw private evidence

Raw private evidence text (`quote`, `snippet`, raw summary) **may remain hidden on mobile** per Phase 5 / Phase 6 trust policy. Hidden evidence must **not feel broken**: show metadata and links; optional truncated redacted snippet only if backend provides a safe public summary field.

### Unsupported links

Show fallback copy (`Linked target unavailable on mobile.` / `No linked detail available yet.`) — not silent failure, not fake content.

**Future implementation:** 3C-4 (primary); partial cleanup allowed in 3C-2 if Today evidence previews are touched.

---

## 9. Competitor mechanics to borrow / avoid

*Market metrics (revenue, users, retention) are research gaps unless separately sourced in a deep-research pass.*

### Closest product lane

| Reference | Borrow (mechanics) | Avoid (identity) | Relation |
|-----------|-------------------|------------------|----------|
| **Rosebud** | Conversational capture; voice input; insight pacing after history; session continuity | “Personal mentor,” self-care companion, proactive growth plans as center | Direct competitor |
| **Mindsera** | Structured investigation prompts; depth-on-demand; premium spacing; framework card density | Framework catalog as identity; personality/emotion scoring; therapy-style Minds | Direct competitor |
| **Stoic** | Morning/evening rhythm; optional streaks; segmented day structure | Mood tracker center; badges; therapy/CBT template library as hero | Direct competitor |

### Functional references

| Reference | Borrow | Avoid |
|-----------|--------|-------|
| **Character.AI** | Session re-entry; emotional return loop mechanics | Personas, roleplay, orb UI, companion framing |
| **Wrtn** | Multi-modal capture patterns; platform breadth within suite vision | Generic chatbot homepage; tool sprawl without OS frame |
| **Finch** | Daily return anchor; micro-completion; optional streaks; pause mode; widget appointment mechanics | Mascot dependency; pet gamification; wellness coding |
| **Notion** | Complex IA in simple shell; nested detail; calm density | Blank-canvas overwhelm; productivity-first identity |
| **Reflect / Readwise** | Archive/recall; source→highlight→claim pipeline; deep linking | Generic PKM graph as primary UX |

### Avoidance lane

| Reference | Risk |
|-----------|------|
| **Anchr** | Friend-bot accountability, recovery/therapy positioning |
| **Calm / Headspace** | Wellness gradients, meditation identity |
| **Therapy-lite apps** | Diagnosis language, CBT-as-brand, mood-dashboard hero |

### Locked borrow list (mechanics)

- Daily return loop
- Guided capture
- Insight pacing (show less, reveal more)
- Card hierarchy (hero → primary → feed → weak)
- Evidence / reward pacing (basis on tap, not upfront dump)
- Simple navigation around complex objects
- Archive / recall mechanics
- Premium spacing and depth
- Model movement awareness

### Locked avoid list (identity)

- Therapy language
- Wellness gradients
- Chatbot homepages
- Mascots
- Fake scores and gamification bars
- Mood-dashboard identity
- AI friend / mentor framing
- Generic “AI that remembers you” pitch

---

## 10. Visual identity direction

### Recommendation (locked)

```text
Direction C — dual-mode system
```

| Mode | Purpose |
|------|---------|
| **Light calm OS** | Daily clarity, readability, App Store-safe first impression |
| **Dark graphite / private instrument** | Premium identity, private operating-console feel, suite alignment |

### Shared requirements

- **Same surface hierarchy** across both modes (hero → sections → detail)
- **Do not ship dark mode** until product hierarchy is stable (after 3C-2 through 3C-5 minimum)
- Dark graphite references inform spacing, depth, floating widgets, tactile cards — **not** generic AI assistant kit copying

### “Mirror Instrument” design language

| Attribute | Definition |
|-----------|------------|
| **Adjectives** | Private, structured, calm, precise, receipt-backed, instrument-grade, quietly premium |
| **Typography** | System sans for UI; monospace uppercase for system labels / section eyebrows |
| **Hierarchy** | Mirror statement → card title → basis line → metadata |
| **Colour (light)** | Soft grey base, near-white cards, restrained teal signal, ember for tensions only |
| **Colour (graphite)** | Charcoal base, graphite panels, soft grey text tiers, teal/green signal accents sparingly |
| **Cards** | Hero mirror, primary mirror, feed mirror, weak mirror, basis row |
| **Icons** | Line icons (Lucide-class); no mascots, no orbs |
| **Motion** | 150–200ms press states; section reveal for evidence; no celebration gamification |
| **Empty states** | Calm, specific, evidence-honest |
| **Premium** | Instrument unlock framing — not “unlock AI insights” |

---

## 11. Implementation roadmap

### 3C-1 — Product / design architecture contract (this doc)

| Field | Value |
|-------|-------|
| **Scope** | Docs-only contract lock |
| **Forbidden** | Code, schema, API, mobile edits |
| **Exit criteria** | Contract published; ledgers updated; verification pass |
| **Likely files** | `docs/phase3c-product-design-architecture-contract.md`, ledger updates |

### 3C-2 — Today hierarchy redesign

| Field | Value |
|-------|-------|
| **Scope** | Today screen only: hero mirror, section order, merged Model Updates, caps, compact capture |
| **Forbidden** | Backend changes; navigation rewrite; dark mode; Your Map route; evidence system overhaul (except no repeated hidden-evidence placeholders if Today touches evidence previews) |
| **Exit criteria** | Today matches §6 order; ≤2 model updates; no scope stats; no duplicate update streams; hero present when data exists |
| **Likely files (mobile)** | `MindLabPrototype.tsx` (TodayScreen), `mobile-today-alignment.ts`, `primitives.tsx` (hero variant if needed), Today alignment tests |

### 3C-3 — Your Map redesign

| Field | Value |
|-------|-------|
| **Scope** | Your Map list + full-screen detail; one-line list statements; OS panel framing |
| **Forbidden** | Backend/schema; navigation tab addition (full-screen push OK); dark mode |
| **Exit criteria** | List obeys §7; detail matches Pattern/Tension detail rhythm; no inline accordion on list |
| **Likely files (mobile)** | `MindLabPrototype.tsx` (PatternsList / Your Map sections), `mobile-mirror-output.ts`, user-map alignment tests |

### 3C-4 — Evidence / receipt representation cleanup

| Field | Value |
|-------|-------|
| **Scope** | Remove repeated hidden-evidence placeholder; basis rows with metadata + Library links across detail screens |
| **Forbidden** | Raw evidence exposure policy change; new receipt namespaces; backend changes |
| **Exit criteria** | Zero per-row “Evidence text is hidden on mobile.”; all evidence rows show §8 fields |
| **Likely files (mobile)** | `InsightDetailScreens.tsx`, `MindLabPrototype.tsx` (inline evidence blocks), `mobile-receipts.ts` |

### 3C-5 — Pattern / Tension list + detail refinement

| Field | Value |
|-------|-------|
| **Scope** | Shared mirror detail template; list title truncation; remove scope metadata from Patterns list |
| **Forbidden** | Backend; new surfaces |
| **Exit criteria** | Patterns/Tensions feel named-object-first; detail pages consistent with Your Map detail |
| **Likely files (mobile)** | `InsightDetailScreens.tsx`, `MindLabPrototype.tsx` (PatternsList, TensionsList), `mobile-mirror-output.ts` |

### 3C-6 — Onboarding / positioning pass

| Field | Value |
|-------|-------|
| **Scope** | First-run copy; capture hub labels; check-in reframed as state telemetry copy |
| **Forbidden** | Fake onboarding intelligence; schema |
| **Exit criteria** | New user sees personal intelligence OS frame, not wellness/journal app |
| **Likely files (mobile)** | `MindLabPrototype.tsx`, `CenterHubMenu.tsx`, `AccountScreen.tsx` |

### 3C-7 — Dark graphite mode prototype

| Field | Value |
|-------|-------|
| **Scope** | Token layer + prototype on Today + Your Map detail only |
| **Forbidden** | Shipping dark as default; hierarchy changes |
| **Exit criteria** | Graphite tokens defined; two screens validated in both modes |
| **Likely files (mobile)** | `index.css`, `primitives.tsx`, targeted screen components |

### 3C-8 — Web / mobile alignment

| Field | Value |
|-------|-------|
| **Scope** | Shared language doc; align web Your Map / Today with mobile hierarchy where product allows |
| **Forbidden** | Breaking Phase 3 web safe-slice contracts |
| **Exit criteria** | Cross-surface naming and hierarchy documented; drift list closed or deferred |
| **Likely files** | `docs/step2c-product-surface-ui-map.md` (update), web surface components as separate slices |

### Roadmap sequence (locked)

```text
3C-1 → 3C-2 → 3C-4 (may overlap partial Today evidence fix) → 3C-3 → 3C-5 → 3C-6 → 3C-7 → 3C-8
```

Do **not** parallelize Today + Your Map + dark mode.

---

## 12. Next implementation contract (3C-2)

**3C-2 should implement Today hierarchy only.**

```text
PHASE: 3C-2
SLICE: Today screen hierarchy redesign
REPO: /Users/user/Mindlabs-app
REFERENCE: docs/phase3c-product-design-architecture-contract.md §6

ALLOWED:
- MindLabPrototype.tsx (TodayScreen and Today-only helpers)
- mobile-today-alignment.ts (Today caps, merge rules, hero selection helpers)
- primitives.tsx (hero mirror card variant if needed)
- index.css (Today spacing tokens only if needed)
- Today alignment tests

FORBIDDEN:
- Backend changes
- Schema / API changes
- Navigation rewrite
- Dark mode
- Your Map standalone route
- Evidence system overhaul (except: no repeated hidden-evidence placeholders in any Today evidence preview touched)
- Pattern/Tension detail edits
- Fake intelligence / mock data

VERIFICATION:
- Mobile verify script / vitest Today alignment tests
- Manual smoke: Today shows hero + gated sections per §6; merged Model Updates; no scope stats

CONTEXT:
Mobile @ 7ba728f. Phase 3B mirror output is foundation. 3C-2 shapes hierarchy and content, not wiring.
```

---

## Appendix A — Current mobile navigation (reference @ 7ba728f)

**Bottom nav:** Today · Timeline · Intelligence · Actions + center New (capture hub)

**Capture hub:** Journal, Journal Chat, Explore, Check-in, Media, Library, Account

**Intelligence tab (`patterns`):** Segmented Patterns / Tensions + Intelligence destinations panel + Your Map section embedded in Patterns list

This navigation is **accepted for 3C-2**. Section anchors and View all links may deep-link within Intelligence tab without tab rewrite.

---

## Appendix B — Relationship to prior docs

| Doc | Relationship |
|-----|--------------|
| `docs/step2c-product-surface-ui-map.md` | Foundational surface map; Phase 3C refines mobile hierarchy and content shaping |
| `docs/phase3-public-intelligence-surfaces-contract.md` | Web safe-slice contracts preserved; 3C does not weaken evidence gates |
| `docs/phase5-receipt-link-architecture-standardization-contract.md` | Receipt namespace policy unchanged in 3C |
| Phase 6 mobile parity closeout | Backend-derived requirement unchanged; 3C is presentation architecture only |

---

## Appendix C — Explicit non-goals (Phase 3C)

- Full agent-control UI
- User-facing internal agents
- Backend intelligence engine overhaul
- Schema / new persistence
- Fake scores, streaks, badges as retention core
- Social / community features
- User correction persistence (UI affordance may remain disabled)
- Graph visualization / mind-map canvas
- Mock / static intelligence

---

*Contract locked 2026-06-12. Supersedes informal Phase 3C-0 audit recommendations for implementation sequencing.*

---

## Addendum — Phase 3C-R1 Suite OS Reconciliation (2026-06-12)

**Status:** Meta-goal correction locked in `docs/phase3c-r1-suite-os-architecture-contract.md`

Phase 3C-R1 reconciles this contract with the **suite OS meta-goal**. Read R1 for authoritative guidance on:

- **Meta-product:** OS suite with MindOS as central intelligence layer (not standalone mobile journal app)
- **Web vs mobile:** Web = full operating console; Mobile = daily capture / quick mirror / action surface
- **Visual identity:** Light-first suite brand default; dark graphite deferred to optional focus mode (adjusts §10 Direction C priority, not hierarchy rules)
- **Competitor research:** Mechanics only — filtered through suite goal; journaling-app framing must not define meta-product
- **Roadmap reframe:** 3C-R2 through 3C-R9 (see R1 §8); 3C-3/3C-6/3C-8 reframed as R6/R5/R3 respectively

**Unchanged by R1:** Surface doctrine (§4), Today hierarchy (§6 — implemented 3C-2), evidence rules (§8 — extended by 3C-SAFE on mobile), product category (§2), competitor avoid list (§9).

**Next recommended slice:** 3C-R2 — Deep Research synthesis filtered through suite meta-goal (docs-only).
