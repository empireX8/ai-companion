# 04 — Target semantic contract

**Phase:** A — design specification (no implementation)
**Clarification:** Model-assisted semantic adjudication (not regex enlargement)
**Principle:** Do not silently redefine all tensions as contradictions to preserve candidate volume.
**Kernel:** ContradictionNode is the first object through the shared Orvek Intelligence Kernel (`11-shared-intelligence-kernel-architecture.md`).

---

## Shared principle

**AI determines what the evidence may mean.**
**Deterministic code verifies where the evidence came from, what object schemas are permitted, and what the system may persist.**

Keyword markers and token overlap may **nominate** material for review. They **cannot** determine final semantic classification or eligibility.

The model must be **allowed and encouraged to return no candidate** (abstain / Class C / Class D / insufficient).

---

## Classification taxonomy

| Class | Definition | May create ContradictionNode candidate? | May create unresolved-tension candidate? | Default action |
|-------|------------|----------------------------------------|----------------------------------------|----------------|
| **A. Clear contradiction** | Two propositions from the same scoped context that cannot both be true at the same time under the same actor, time frame, and modality | **Yes** — `ContradictionNode` candidate | No (contradiction subsumes) | Candidate → human review |
| **B. Plausible unresolved tension** | Genuine pull between commitments, intentions, or outcomes where both sides may be partially true, uncertain, or unresolved — not logical incompatibility | **No** — not a contradiction | **Yes** — if product supports tension objects; otherwise **no object** | Surface as tension/labeled doubt, not Active conflict |
| **C. Compatible states** | Apparent contrast explained by different scope, time, actor, modality, or coexisting truths | **No** | **No** | No object |
| **D. Insufficient or misaligned context** | Missing scope, cross-session mispairing, coding noise, unrelated overlap, or Side A/Side B not about the same subject | **No** | **No** | No object |

---

## Model-assisted structured result (contradiction adjudication)

CEQR-001 must implement a **model-assisted semantic adjudication contract**, not an enlarged collection of regexes and handcrafted compatibility rules.

For contradiction assessment, the structured AI result **must** include:

| Field | Purpose |
|-------|---------|
| Normalized Proposition A | Canonical Side A claim |
| Normalized Proposition B | Canonical Side B claim |
| Actor (each) | Who asserts / acts |
| Subject (each) | What the claim is about |
| Timeframe (each) | When the claim applies |
| Context and scope | Situational bounds |
| Negation | Explicit or implicit negation |
| Modality | Must / should / try / sometimes / etc. |
| Qualifications | Hedges, partial compliance, exceptions |
| Whether both can simultaneously be true | Logical compatibility |
| Whether changed belief over time | Temporal change vs simultaneous conflict |
| Whether intention versus outcome | Intention/outcome distinction |
| Whether goal versus obstacle | Goal/obstacle distinction |
| Whether emotional/physiological reaction versus reasoning standard | Sensation vs standard |
| Classification | A / B / C / D |
| Confidence | Calibrated confidence |
| Exact evidence span for each proposition | Source material for validation |
| Concise rationale | Why this class |
| Alternative interpretation | Competing reading |
| What would change the classification | Falsification / upgrade conditions |
| Abstention reason | Where applicable — encouraged when unsure |

### Deterministic post-conditions (non-AI)

Before persistence:

1. Exact evidence spans validate against original message text (offsets / span IDs).
2. Same-session rule holds (v1).
3. Zero-or-one eligible Side A selection holds — no fan-out, no forced-one.
4. Object schema and Objectivity Referee outcomes respected (`12-objectivity-referee-gap-and-integration.md`).
5. Markers/token overlap were not used as eligibility.

---

## Required distinctions (content of adjudication)

### Belief versus behaviour

| Pattern | Class | Rationale |
|---------|-------|-----------|
| Stated belief X; behaviour inconsistent with X in same scope/time | A or B | A if strict incompatibility; B if partial compliance or effectiveness doubt |
| Belief X; unrelated behaviour Y | D | Misaligned |
| Belief X; emotional/physiological reaction | C | Reaction ≠ belief violation |

### Intention versus outcome

| Pattern | Class |
|---------|-------|
| Intended to do X; failed to do X (same episode, no qualifying hedge) | A or B |
| Intended to do X; outcome unknown or in progress | B |
| Intended X; obstacle described without admission of non-compliance | C or B — not automatic A |

### Goal versus obstacle

| Pattern | Class |
|---------|-------|
| Goal G; message describes difficulty achieving G | **B** (tension) — **not** automatic contradiction |
| Goal G; explicit admission of not doing G when committed | A or B depending on qualifiers |
| Goal G; unrelated struggle in different domain | D |

### Change over time versus simultaneous contradiction

| Pattern | Class |
|---------|-------|
| Belief X at t1; belief not-X at t2, same scope | **B** or no object — **not** simultaneous contradiction |
| Simultaneous "I always X" and "I never X" | A |
| "I used to X" vs "I don't X now" | C (compatible change) |

### Different contexts or scopes / actors

| Pattern | Class |
|---------|-------|
| Side A from session 1; Side B from session 2; no explicit cross-time claim | **D** (v1) |
| Explicit scoped contrast in same message | Evaluate per scope — may be C |
| Different actors | D or C |

### Emotional/physiological reaction versus stated reasoning standard

| Pattern | Class |
|---------|-------|
| Objectivity attempt + somatic identity-trigger sensations while non-reactive | **C** |
| "I never let emotion affect decisions" + "I acted purely on anger" (same episode) | A |

### Partial compliance / uncertainty / rhetorical markers

| Pattern | Class |
|---------|-------|
| Partial compliance + doubt | **B** — not A |
| Uncertainty without negation of prior claim | C or B |
| Rhetorical `"but I mean"` without proposition conflict | **C** or D |

---

## Creation rules (target)

### ContradictionNode candidate (`status: candidate`)

**All must hold:**

1. Side A and Side B from **same session** (v1) with dual-message or same-message lineage
2. Model-assisted classification = **A** (clear contradiction), with confidence above persistence threshold after referee
3. Logical incompatibility under preserved qualifiers
4. Not Class B/C/D
5. Exact dual-side evidence spans validated
6. Zero-or-one Side A selection — not ranking among ineligible refs

### Unresolved-tension (future / optional)

Class B only; **not** ContradictionNode until product adds a tension object. Until then → **no object**.

### No object / abstain

Classes C and D, referee ABSTAIN / REQUEST_MORE_EVIDENCE, or zero eligible refs → no materialization.

---

## Confidence calibration (target)

| Signal strength | Confidence | Candidate? |
|-----------------|------------|------------|
| Same-message explicit incompatible propositions with validated spans | medium–high | Yes (after referee) |
| Same-session behavioural admission vs stated goal/constraint | medium | Yes (review) |
| Heuristic tension without incompatibility | — | No |
| Marker-only / token-overlap-only | — | **No** |

Fixed `"medium"` / `"low"` by type label is **not** acceptable.

---

## Relationship to existing 25 candidates

Under this contract: 0 Class A, 2 Class B, 13 Class C, 10 Class D.
Phase A / repair deploy must **not** mutate them — see `06-existing-candidate-treatment-plan.md`.

---

## Product language guardrails

- Map **Active conflict** only for accepted Class A (`status: open` after human accept)
- Do not present Class B as contradiction
- Do not imply symmetric lineage until span provenance is true
