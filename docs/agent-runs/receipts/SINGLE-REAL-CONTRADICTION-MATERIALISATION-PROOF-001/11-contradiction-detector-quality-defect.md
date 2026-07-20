# 11 — Contradiction detector quality defect

**Phase:** A2 documentation
**Exemplar false positive:** `cmp2fvq8f00aoqlsyy9z3sckc` (disqualified Phase A recommendation)
**Scope:** Import-time detection + materialisation policy — **not** Wave 2.1 accept-path code

---

## Summary

Kay's imported ContradictionNode cohort (25 pending) is dominated by **heuristic false positives**: cross-session reference pairing, substring contrast markers, and token-overlap eligibility that do not establish logical incompatibility. This is an **extraction-quality defect**, not evidence that the accept → open → UEL → ModelUpdate → Map/Inspector **write/read paths** are broken.

**Wave 2.1 must not silently patch the detector** to force a proof candidate. Repair belongs in a **later extraction-quality repair wave**.

---

## Defect 1 — Cross-session pairing

| What happens | During import, `detectContradictions` loads up to **50 goal/constraint ReferenceItems for the entire user** (`referenceStatuses: ["active","candidate"]`), not scoped to the current session. |
| Effect | Side A from conversation A is paired with Side B message from conversation B. |
| Exemplar | `cmp2fvq8f00aoqlsyy9z3sckc`: Side A from *Model Comparison Clarification*; Side B from *Identity Triggers and Sensations*. |
| Scale | **17 / 25** pending CNs are cross-session on Side A vs Side B. |
| Lineage risk | CN row stores `sourceSessionId` / `sourceMessageId` for **Side B only**. Side A lineage lives on ReferenceItem but is **not** represented on the CN row or accept UEL path. Inspector/implied lineage can misrepresent the tension as session-local. |

**Code:** `lib/contradiction-detection.ts` → `detectContradictions` (user-wide ref query) · `lib/import-chatgpt.ts` import loop.

---

## Defect 2 — Generic `"but i"` substring trigger

| What happens | `CONSTRAINT_VIOLATION_MARKERS = ["but i", "however i", "even though"]` — any Side B message containing `"but i"` triggers constraint_conflict pairing against **every** constraint ReferenceItem. |
| Effect | Conversational continuations ("But I mean…", "but I also don't dwell", "but I actually think") become false violations. |
| Exemplar | `cmp2fvq8f00aoqlsyy9z3sckc`: trigger at "but I also don't dwell" / "but I can literally feel" — not constraint breaches. |
| Scale | All **3** constraint_conflict candidates + several goal pairs use `"but i"` in non-failure contexts. |

**Code:** `lib/contradiction-detection.ts` → `detectContradictionsFromData`.

---

## Defect 3 — Loose token-overlap eligibility

| What happens | `classifyImportedContradictionPair` rejects pairs only when overlap < 2 **and** Side B is not a behavioral-admission regex match. |
| Effect | Unrelated cross-session pairs pass when they share common tokens (*that*, *what*, *just*, *don*, *identity*, *brain*, *feel*). |
| Exemplar | `cmp2fvq8f00aoqlsyy9z3sckc`: overlap 3 on generic tokens despite unrelated conversations. |
| Import classifier result | `{ eligible: true, reasons: [] }` for disqualified exemplar. |

**Code:** `lib/import-chatgpt.ts` → `contradictionPairOverlapCount`, `classifyImportedContradictionPair`.

---

## Defect 4 — Incomplete side-level provenance on CN row

| What happens | `materializeContradictions` sets `sourceSessionId` / `sourceMessageId` to the **Side B detection message** only. Side A is copied from ReferenceItem statement without persisting Side A message/session on the CN. |
| Effect | After accept, UELs link to Side B message/spans/session/import batch. Side A provenance requires separate ReferenceItem lookup. |
| Wave 2.1 impact | Human proof claiming "genuine evidence lineage" on Inspector is **weak** when Side A is cross-session or when Kay expects symmetric message lineage. |

**Code:** `lib/contradiction-materialization.ts` · `lib/import-candidate-review-actions.ts` → `materialiseAcceptedContradiction`.

---

## Defect 5 — False contradiction demonstrated by exemplar

**`cmp2fvq8f00aoqlsyy9z3sckc`**

| Side | Proposition |
|------|-------------|
| A | Having fun / not caring much **although** always optimising for objectivity |
| B | Somatic identity-trigger sensations **while not reactive** and not dwelling |

These are **compatible states** in context (see `08-candidate-interpretation-review.md`). Accepting would create an open CN + ModelUpdate that **overstates** a contradiction Kay correctly challenged.

---

## Why this belongs in extraction-quality repair wave (not Wave 2.1)

| Reason | Detail |
|--------|--------|
| Wave 2.1 purpose | Prove **one genuine** human accept → materialisation → Map → Inspector pathway |
| Current pool | 0 candidates meet strict semantic + lineage criteria |
| Patching detector now | Would conflate **proof of accept path** with **repair of import intelligence** — violates campaign boundaries |
| Accept path already unit-proven | `lib/__tests__/import-candidate-review.test.ts` |
| Map projection landed | Wave 1.1 — needs a **truthful** CN to prove on Kay account |
| Correct sequence | Extraction-quality repair → new import or re-derivation → **then** Wave 2.1 re-run |

---

## Repair directions (documentation only — out of scope here)

1. Session-scope (or provenance-scope) reference pairing during import detection.
2. Semantic or structural contrast detection replacing bare `"but i"` substring.
3. Stricter import pair classifier (semantic relation, not token overlap alone).
4. Persist Side A message/session ids on ContradictionNode **or** reject cross-session pairs at materialisation.
5. Fanout caps already exist for repeated Side A/B — may need tightening for shared constraint refs.

---

## What Wave 2.1 must not do

- Silently change `contradiction-detection.ts` or import filters to elevate a weak candidate.
- Accept or Reject any current candidate to "clean up" the queue.
- Present compatible states as Active conflicts on Map.
- Claim production readiness.

---

## Mutation confirmation

Documentation-only receipt · no product changes · no DB writes in Phase A2.
