# Phase 3C-R1 — Suite OS Architecture Reconciliation Contract

**Date:** 2026-06-12  
**Status:** CONTRACT LOCKED — docs-only (3C-R1)  
**Validation base:** Backend/docs `main @ e14cb52`; Mobile reference `main @ 97853d9` (3C-2 Today redesign + 3C-SAFE trust cleanup complete)  
**Sources:** `docs/phase3c-product-design-architecture-contract.md` (3C-1); Phase 3C-0 audit; Deep Research report (*MindLab Phase 3C Competitor Retention and Product Design Research.pdf* — referenced in planning; **not present in workspace at authoring time**; mechanics reinterpreted below through suite meta-goal); mobile implementation state  
**Scope:** Product architecture reconciliation only. No backend code. No mobile code. No schema. No APIs. No UI implementation.

---

## 1. Executive decision

### Corrected hierarchy (locked)

```text
The meta-product is an OS suite.
MindOS is the central personal intelligence layer.
The web app is the full operating console.
The mobile app is the daily capture / quick mirror / action surface.
```

### What this means

| Layer | Role |
|-------|------|
| **Suite** | Long-term product family: MindOS + domain OS products sharing one intelligence substrate |
| **MindOS / MindLab** | Central cross-domain personal intelligence layer — patterns, tensions, User Map, model movement, investigations, fieldwork |
| **Web** | Full operating console / workbench — depth, structure, evidence review, cross-domain coordination |
| **Mobile** | Daily field instrument — capture, mirror, check-ins, watch-fors, lightweight control, notifications |

### Clarifications

- **Mobile matters** for habit, capture, fieldwork completion, quick review, notifications, and daily return. It is not the whole product.
- **Web matters** for depth, structure, control, evidence inspection, model editing, advanced investigation, exports, and cross-OS coordination. It is not secondary.
- **Both** must operate on the **same underlying object model** (Evidence, Patterns, Tensions, User Map conclusions, Model Updates, Active Questions, Watch For, Fieldwork/Actions, Goals, Decisions, cross-domain links).
- **Neither** should be designed as a standalone AI journal, therapy-lite app, or mobile-only habit product.

### Tension resolved

| Prior framing (A) | Corrected framing (B) |
|-------------------|----------------------|
| MindLab as mobile-first personal intelligence app | MindOS as web-led operating console + mobile field instrument within a suite |
| Consumer product = mobile app experience | Consumer product = suite intelligence layer with web console + mobile daily surface |
| Deep Research dark graphite as primary identity | Light-first suite identity; dark as optional focus mode later |
| Competitor journaling loops define meta-product | Competitor mechanics inform mobile/onboarding only; suite OS defines meta-product |

---

## 2. Suite vision

The long-term goal is a **suite of OS products** connected by MindOS as the central intelligence layer.

```text
MindOS / MindLab  — central self-intelligence
FinanceOS         — money behaviour and financial organisation
StudyOS           — learning and knowledge development
SpeakOS           — communication and fluency practice
CreatorOS         — content, audience, and creative workflow
(potentially more domain OS products later)
```

### MindOS / MindLab — central self-intelligence layer

**Purpose:** Cross-domain personal intelligence. The user's operating system for understanding themselves.

**Tracks and surfaces:**

- Patterns (recurring operating loops)
- Tensions (competing pulls)
- User Map (structured self-model / operating-system conclusions)
- Model Updates / What Changed (explicit model movement)
- Active Questions (unresolved investigations)
- Watch For (fieldwork / attention prompts)
- Fieldwork / Actions (experiments that test the model)
- Goals, decisions, identity/values/beliefs (as model objects mature)
- Cross-domain behavioural signals absorbed from domain OS products

**Doctrine (unchanged from 3C-1):**

```text
Cards name objects.
Details show the basis.
Chat interprets.
Receipts prove.
Actions test.
Timeline shows movement.
```

### FinanceOS — money behaviour and financial organisation

**Likely purpose:** Evidence-backed financial understanding and decision support.

**Possible surfaces:**

- Spending evidence and transaction-linked receipts
- Money patterns (avoidance, impulsivity, scarcity loops)
- Financial goals and budget/decision support
- Income/expense organisation
- Financial fieldwork (experiments around spending/saving behaviour)
- Financial tensions (security vs ambition, shame vs control)
- Links to MindOS patterns: avoidance, impulsivity, shame, risk, scarcity, ambition

### StudyOS — learning and knowledge development

**Likely purpose:** Comprehension, coursework, revision, and knowledge mapping.

**Possible surfaces:**

- Study sessions and course evidence
- Comprehension gaps and revision plans
- Learning patterns and knowledge map
- Spaced review and academic fieldwork
- Links to MindOS patterns: focus breakdown, avoidance, confidence, procrastination, cognitive overload

### SpeakOS — communication and fluency practice

**Likely purpose:** Interpersonal and professional communication skill development.

**Possible surfaces:**

- Speaking practice and conversation drills
- Argument clarity and professional communication
- Podcast / presentation fluency
- Anxiety/exposure logs and feedback loops
- Links to MindOS patterns: social appeasement, identity threat, over-explaining, confidence under disagreement

### CreatorOS — content, audience, and creative workflow

**Likely purpose:** Creative production, audience relationship, and workflow intelligence.

**Possible surfaces:**

- Content pipeline and idea archive
- Audience feedback and performance analytics
- Production schedule and creator fieldwork
- Brand and positioning decisions
- Links to MindOS patterns: consistency, perfectionism, avoidance, identity pressure, creative confidence

### Suite rule (locked)

Each domain OS **generates evidence**. MindOS **absorbs** cross-domain evidence and **updates the central user model**. Domain OS products do not each become isolated chatbots or journals — they feed the shared intelligence substrate.

---

## 3. Central intelligence model

### Connection rule

```text
Every domain OS generates evidence.
MindOS absorbs cross-domain evidence and updates the central user model.
```

### Cross-domain examples

| Domain signal | MindOS update |
|---------------|---------------|
| FinanceOS: repeated bill avoidance | Pattern update — financial stress / avoidance loop |
| StudyOS: focus breakdown before assignments | Link to cognitive overload or procrastination pattern |
| SpeakOS: over-explaining under disagreement | Tension link — social appeasement vs directness |
| CreatorOS: posting drop after identity-triggering feedback | Pattern link — audience pressure and self-concept tension |

### Central object model (shared across web and mobile)

| Object | Role |
|--------|------|
| Evidence / receipts | Proof linking claims to sources |
| Events | Captures, check-ins, sessions, domain activities |
| Patterns | Recurring operating loops |
| Tensions | Competing pulls |
| User Map conclusions | Structured self-model statements |
| Model Updates | Explicit model movement events |
| Active Questions | Unresolved investigations |
| Watch For prompts | Fieldwork / attention prompts |
| Fieldwork / Actions | Experiments that test the model |
| Goals | Directed outcomes (future) |
| Decisions | Recorded choice points (future) |
| Domain-specific signals | Typed evidence from FinanceOS, StudyOS, etc. |
| Cross-domain links | Verified relationships between domain signals and central model objects |

### Non-negotiables (unchanged)

- No fake intelligence — all user-facing claims trace to stored evidence
- No raw private evidence in public/mobile projections without policy
- Candidate/internal lifecycle objects stay operator-side until published
- Chat interprets; pages name objects

---

## 4. Web vs mobile role contract

### Summary table

| Dimension | Web app | Mobile app |
|-----------|---------|------------|
| **Primary role** | Full operating console / workbench | Daily interface / field instrument |
| **User posture** | Deep work, review, curation | Quick capture, glance, complete |
| **Session length** | Long sessions supported | Short, frequent sessions |
| **Evidence** | Full archive, review, export | Metadata + basis summary; detail on tap |
| **User Map** | Full map, edit/curate flows (when backend allows) | Preview + anchor to web depth |
| **Model editing** | Primary venue | Read + lightweight correction affordances only |
| **Domain OS** | Full dashboards per domain (future) | Quick capture + notification hooks (future) |
| **Agents** | Control plane (future) | Notification/resurface surface (future) |

### Web app role — full operating console

**Web owns:**

- Full User Map (list, detail, evidence review, curation)
- Evidence / receipt archive and advanced search
- Long-form investigation and Active Question depth
- Domain OS dashboards (future)
- Cross-domain model view
- Model diffing and What Changed history
- Structured exports and imports/connectors
- Advanced search across evidence and model objects
- Agent control layer (future)
- Review / edit / curate flows
- Admin / operator review when needed

**Web is where the suite expresses its full intelligence potential.**

### Mobile app role — daily field instrument

**Mobile owns:**

- Quick capture (text, voice, photo)
- Check-ins and state telemetry
- Today living mirror (hero + capped previews — implemented 3C-2)
- Watch For prompts and lightweight completion
- Action / fieldwork completion
- Lightweight Explore (interpretation with seeded context)
- Quick model update awareness (merged Model Updates, max 2)
- Notifications and resurfacing (future)
- Portable context and session continuity

**Mobile is not less important — it is the daily return loop and evidence ingestion layer. It is not the whole product.**

### Shared rules

- Same object model, same naming, same evidence gates
- Mobile deep-links to web for depth where product allows
- Mobile does not duplicate web-only operator or archive depth
- Web does not replace mobile capture ergonomics

### Current mobile state (reference @ 97853d9)

- Today hierarchy redesign complete (3C-2)
- Evidence placeholder cleanup complete (3C-SAFE): basis summaries replace repeated hidden-evidence rows
- Backend scope stats removed from Patterns list
- Intelligence tab consolidates Your Map, What Changed, Active Questions, Watch For destinations
- User Map still embedded in Intelligence tab — web remains primary depth venue per this contract

---

## 5. Light-first suite identity

### Decision (locked)

**Primary suite identity is light-first**, clear, modular, professional, and OS-like.

| Principle | Rule |
|-----------|------|
| **Brand default** | Light mode — supports finance, study, speaking, creator workflows and long web sessions |
| **Dark graphite** | May exist later as focus/private/premium mode — **does not define the brand** until light suite language is strong |
| **3C-1 Direction C** | Dual-mode remains valid architecture; **light calm OS is default**; dark graphite is deferred secondary mode (supersedes dark-centred Deep Research recommendation) |
| **Avoid** | Wellness gradients, mascot visuals, generic AI chatbot orbs, therapy-app softness, cold enterprise SaaS |
| **Aim for** | Clear intelligence furniture — part of the user's mental workspace |

### Visual language direction (suite-wide)

- Light neutral base
- Precise cards / panels with subtle depth
- Restrained accent colours **per domain OS** (MindOS teal/signal, Finance muted green, Study blue, Speak amber, Creator violet — indicative, not final)
- Modular widgets and evidence chips
- Model movement indicators
- Clean diagrams for cross-domain links
- Floating command surfaces on web
- Monospace uppercase for system labels / section eyebrows (carry forward from 3C-1 Mirror Instrument language)
- Line icons only — no mascots, no orbs

### What changes from 3C-1 §10

3C-1 locked **Direction C — dual-mode system** with dark graphite as co-equal premium identity. **3C-R1 elevates light-first as brand default** and demotes dark graphite to optional future focus mode. Hierarchy rules (hero → primary → feed → basis) unchanged across modes.

---

## 6. How to reinterpret competitor research

The Deep Research report is **useful for mechanics**, not for meta-product definition. It was overly framed around MindLab as a standalone mobile journaling-adjacent product. Filter everything through the suite meta-goal.

### Bucket A — Applies directly to MindOS suite

Use these as suite-level design requirements:

- Evidence-linked insight gap (claims must show basis)
- Inspectable continuity (receipt-backed traversal)
- Receipt-backed model objects (Patterns, Tensions, User Map, Model Updates)
- Trust via export / delete / evidence auditability
- Mobile / web role split (capture vs console)
- Weekly synthesis / What Changed / model movement awareness
- Watch For as resurfacing / fieldwork loop
- Fieldwork as progress mechanism (not generic todos)
- Structured objects over chat-first design
- Card hierarchy (hero → primary → feed → weak)

### Bucket B — Applies mostly to mobile / journaling lane

Use these to inform **mobile capture, Today, check-ins, onboarding** — **not** the meta-product:

- Rosebud daily journaling and conversational capture loops
- Mindsera capture / analysis pacing
- Stoic check-in cadence and day structure
- Finch micro-action return mechanics

**Do not** let these define MindOS category, web console architecture, or suite positioning.

### Bucket C — Applies later to agent / domain OS strategy

Use when designing domain OS and future agent layer:

- Wrtn tool breadth within a platform (maps to multi-OS suite)
- Character.AI continuity / discovery / re-entry mechanics (session return, not personas)
- User-controlled agents per domain
- Domain-specific assistants connected to goals and evidence

**Avoid from Character.AI lane:**

- Roleplay, parasocial attachment, entertainment identity, companion dependency, AI friend framing

### Explicit rejections from research over-application

- Do **not** optimize MindOS to win Rosebud/Mindsera/Stoic retention comparisons as a journal app
- Do **not** adopt dark graphite as primary brand because it fits "private journal instrument"
- Do **not** collapse web depth into mobile dashboards
- Do **not** treat chat as the product center

---

## 7. Agent / control layer vision (future — not current implementation)

### Long-term possibility

The suite may include **operating agents** attached to domains:

| Agent | Domain |
|-------|--------|
| MindOS agent | Central intelligence, cross-domain synthesis |
| Finance agent | Money behaviour, budgets, financial fieldwork |
| Study agent | Learning plans, comprehension gaps, revision |
| Speak agent | Communication practice, clarity, exposure |
| Creator agent | Content pipeline, audience, production |

### What these are not

- Not characters or companions
- Not therapists or coaches
- Not autonomous life-decision makers
- Not fake authority voices

### What these are

Operating agents connected to:

- Goals and decisions
- Evidence and receipts
- Domain workflows and tasks
- Model updates (with explicit approval)
- Fieldwork recommendations
- User permissions and audit trail

### Possible future agent actions (illustrative)

- Summarize domain state
- Suggest next moves grounded in evidence
- Surface unresolved tensions or Active Questions
- Prepare review plans or exports
- Compare evidence across time
- Organise tasks and fieldwork
- Recommend Watch For prompts
- Propose User Map updates **with explicit user approval**

### Hard constraints (locked)

- User remains in control
- No hidden autonomous life decisions
- No therapy / diagnosis / crisis care
- No fake authority or invented evidence
- Agent outputs must trace to evidence or explicit user instruction
- Agent UI belongs on **web control plane** first; mobile gets notifications/resurface only

**Current phase:** No user-facing agent control. Phase 7 advanced intelligence remains deferred.

---

## 8. Updated product architecture roadmap

Reframe 3C onward around suite meta-goal. Prior 3C-2 and 3C-SAFE mobile slices remain valid; sequencing below governs what comes next.

| Stage | Name | Scope |
|-------|------|-------|
| **3C-R1** | Meta goal reconciliation + suite OS architecture contract | **This doc** — docs-only |
| **3C-R2** | Deep Research synthesis filtered through suite meta-goal | Internal doc: mechanics → suite/mobile/web decisions |
| **3C-R3** | Web / mobile role contract and surface map update | Update `step2c-product-surface-ui-map.md` with explicit web/mobile ownership |
| **3C-R4** | Light-first suite design language audit | Tokens, domain accents, component language — web-led |
| **3C-R5** | Onboarding architecture for MindOS activation | Activate central OS idea, not journaling app frame |
| **3C-R6** | Your Map redesign — web + mobile concept | Web = primary depth; mobile = preview + handoff |
| **3C-R7** | Evidence / receipts as cross-platform trust system | Extend 3C-SAFE basis-summary pattern to web archive depth |
| **3C-R8** | Domain OS roadmap | FinanceOS, StudyOS, SpeakOS, CreatorOS — product architecture only |
| **3C-R9** | Agent / control layer future strategy | Docs-only; no implementation |

### Prior 3C slices — status and relationship

| Slice | Status | R1 relationship |
|-------|--------|-----------------|
| 3C-1 Product/design contract | Locked | Supplemented by R1; addendum added |
| 3C-2 Today hierarchy | Complete (mobile @ 97853d9) | Valid — mobile daily mirror role |
| 3C-SAFE Trust cleanup | Complete (mobile @ 97853d9) | Valid — cross-platform trust direction |
| 3C-3 Your Map redesign | Not started | **Reframe as 3C-R6** — web + mobile, not mobile-only |
| 3C-4 Evidence cleanup | Partially done on mobile | **Absorb into 3C-R7** cross-platform |
| 3C-5 Pattern/Tension refinement | Not started | Continue on mobile; web parity in R3 |
| 3C-6 Onboarding | Not started | **Reframe as 3C-R5** |
| 3C-7 Dark graphite prototype | Not started | **Deferred** — after R4 light-first audit |
| 3C-8 Web/mobile alignment | Not started | **Reframe as 3C-R3** |

### Implementation discipline

After R1/R2 synthesis, implementation must be **cautious and explicit**. No slice may expand scope without a bounded contract (PHASE, SLICE, ALLOWED, FORBIDDEN, VERIFICATION).

---

## 9. What this changes about prior 3C contract

| Prior assumption (3C-1 / Deep Research) | R1 correction |
|----------------------------------------|---------------|
| Mobile consumer product defines primary UX | **Suite + web console** define primary depth; mobile serves daily loop |
| Web is alignment target for mobile | **Web is full OS workbench** — not secondary |
| Direction C dual-mode with dark graphite co-equal | **Light-first brand default**; dark deferred |
| Deep Research drives product direction | **Filtered through suite goal** — mechanics only |
| Your Map redesign mobile-only (3C-3) | **Web + mobile concept** (3C-R6) |
| Onboarding = personal intelligence OS frame on mobile | **Onboarding activates central MindOS** across surfaces |
| Premium/pricing = mobile app tiers | **Suite depth and workbench value** likely drive premium |
| Human expert layer | Remains **deferred** |
| Agent/control layer | **Future OS suite strategy** — not current MindLab chatbot design |
| Competitor journaling apps = product lane | **Mobile/onboarding mechanics only** |

### What does not change

- Evidence-backed personal intelligence category
- Surface doctrine (cards name objects, receipts prove, etc.)
- Today hierarchy (3C-2 implementation stands)
- No fake intelligence rule
- Backend evidence gates and Phase 3 safe-slice contracts
- Trust-safe mobile evidence handling (3C-SAFE)

---

## 10. What should not be built yet

Protect against overbuilding before R2/R3 synthesis:

- No multi-OS product launch
- No FinanceOS / StudyOS / SpeakOS / CreatorOS implementation
- No user-facing agent control UI
- No autonomous agents
- No agent marketplace
- No human expert layer
- No dark graphite mode implementation
- No major navigation rewrite until web/mobile roles locked (R3)
- No onboarding implementation until R1/R2 synthesis complete
- No pricing / paywall implementation
- No schema / API changes for suite expansion
- No fake cross-domain signals or demo domain dashboards

---

## 11. Immediate next decision after R1

### Recommended next step: **3C-R2**

```text
Do R2 next: synthesize the Deep Research into suite-level decisions before more implementation.
```

**Why R2 before R3/R4/R5:**

1. R1 locks meta-goal; R2 translates competitor mechanics into **actionable suite decisions** without over-learning journal-app framing.
2. R3 (web/mobile surface map) needs R2 outputs to assign borrow/avoid mechanics to the correct surface.
3. R4 (light-first design audit) needs R2 + R3 to know which surfaces are web-primary vs mobile-primary.
4. Further mobile implementation (Your Map, onboarding) should wait until roles are reconciled — 3C-2 and 3C-SAFE already improved mobile trust without expanding scope.

### Option summary

| Option | Slice | When |
|--------|-------|------|
| **A (recommended)** | 3C-R2 Deep Research synthesis | **Next** |
| B | 3C-R3 Web/mobile surface role contract | After R2 |
| C | 3C-R4 Light-first design language audit | After R3 |
| D | 3C-R5 Onboarding architecture | After R2 + R3 |

---

## Appendix A — Relationship to prior docs

| Doc | Relationship |
|-----|--------------|
| `docs/phase3c-product-design-architecture-contract.md` | Foundational 3C-1 contract; R1 addendum supersedes meta-goal, web/mobile hierarchy, and visual default |
| `docs/step2c-product-surface-ui-map.md` | Foundational surface map; update in 3C-R3 for explicit web/mobile ownership |
| `docs/phase3-public-intelligence-surfaces-contract.md` | Web safe-slice contracts preserved |
| Phase 3C-2 / 3C-SAFE mobile work | Valid implementation; aligned with mobile role in §4 |

---

## Appendix B — Explicit non-goals (3C-R1)

- Implementation of any domain OS
- Mobile or web code changes
- Schema / API changes
- Agent UI
- Pricing model design
- Deep Research PDF ingestion (report not in workspace; mechanics captured via 3C-1 + user brief)

---

*Contract locked 2026-06-12. Supersedes 3C-1 for meta-goal, web/mobile hierarchy, and light-first visual default. Does not supersede 3C-1 surface doctrine or Today hierarchy rules.*

---

## Addendum — Phase 3C-R2 Deep Research Suite Synthesis (2026-06-12)

**Status:** Competitor mechanics synthesis locked in `docs/phase3c-r2-deep-research-suite-synthesis.md`

Read R2 for authoritative **accepted/rejected mechanics matrices**, destination buckets, and locked product decisions #1–17. **R3** (web/mobile surface roles) is the recommended next slice.
