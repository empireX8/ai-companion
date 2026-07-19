# 13 — Repair wave sequence

**Do not implement in this campaign.** Dependency/leverage order — not visual prominence.
Uploader and global mock cleanup are **not** first.

---

## Wave 0 — Controlling unmask readiness (foundational, no product mutation yet)

- **Goal:** Document composition presence; define cutover gates per surface
- **DB mutation:** forbidden
- **Success:** Kay knows seed is masking; Import remains live
- **Out of scope:** deleting composition

*(This audit = Wave 0 complete.)*

---

## Wave 1.R — Residual foundational translation (deferred; non-blocking for CN)

Clarified in `15-wave-sequencing-clarification.md`. These do **not** gate Wave 1.1 / 2.1:

- RI accept → UEL/MU schema expansion (currently documented intentional gaps)
- Goal read authority (RI vs ProfileArtifact vs UM remap)
- ProfileArtifact fate (archive vs translate)

---

## Wave 1.1 — ContradictionNode → Map Active-conflicts live projection (**NEXT**)

- **Goal:** Implement the missing read-path translation so an `open` ContradictionNode appears on canonical Map **Active conflicts**, is selectable, and opens Inspector `contradiction_node` — including a composition-safe rule so full_reference seed cannot wholly hide live conflicts during proof
- **Pathways:** W1-C (+ W1-F mask exception for conflicts)
- **Surfaces:** Map Active conflicts; Inspector; optional Timeline MU link readiness
- **Genuine records used for design:** 25 pending CN (read-only); 0 open today
- **DB mutation:** **forbidden**
- **Mock removal:** none (no composition delete)
- **Human verification:** automated tests + optional non-Kay fixture; Kay accept reserved for 2.1
- **Success:** unit/integration proof that open CN id is on Map conflicts rail under live (and composition-safe) merge; candidate CNs excluded
- **Out of scope:** accept/reject; goals; ProfileArtifact; RI MU schema; uploader; Wave 2.1 mutation

---

## Wave 2 — Distinct genuine-object proofs (one object family at a time)

Order (after Wave 1.1 PASS):

1. **ContradictionNode accept → open → Map conflict → MU** (Wave 2.1 — only valid after 1.1)
2. **Additional curated ReferenceItem accepts** (preference/constraint; optional goal after Wave 1.R)
3. **PatternClaim live Map proof** with composition still present or temporarily bypassed per-surface
4. **UserMapConclusion + ModelUpdate live visibility proof**
5. **SurfacedAction Decisions live list proof**

- **DB mutation:** human accept/reject only when Kay runs gate; no bulk scripts
- **Mock removal:** none until Wave 3
- **Success:** each family has one human-visible canonical proof without relying on seed object ids
- **Out of scope:** quality rewrite of all 53

---

## Wave 3 — Surface-by-surface production cutovers

Order by dependency: **Import (done) → Map → Timeline/Movement → Decisions → Explore rails → Today → Reports/badges**

- **Goal:** Live providers own rails; composition workbench blocked or deleted **after** per-surface proof
- **Mock removable after proof:** M1 rails per surface, M2/M3 headers, seed report
- **DB mutation:** may delete/disable composition only after Kay approval post-proof
- **Success:** each surface honest-empty or genuine-only
- **Out of scope:** Capture overlay; uploader

---

## Wave 4 — Extraction-quality improvements

- **Goal:** Reduce noise in candidates/patterns; improve titles/sides; gate PatternClaim auto-active
- **Records:** pending 53 + future imports
- **DB mutation:** reprocess policies carefully; no silent rewrite of accepted
- **Success:** sampled candidates mostly useful
- **Out of scope:** ChatGPT uploader UI

---

## Wave 5 — Controlled natural-entry sequence

- **Goal:** Prove journal-chat / Free Explore / durable outcome / correction paths end-to-end on genuine account
- **Entry points:** live paths only (not Capture overlay / disabled composers)
- **DB mutation:** yes (new messages/objects) under Kay supervision
- **Success:** new entry creates durable object visible on cut-over surfaces
- **Out of scope:** voice/attachment polish

---

## Wave 6 — Final mock/fallback removal

- **Goal:** Remove full_reference composition, seed report, residual reference fallbacks from root
- **Prerequisite:** Waves 2–3 PASS
- **DB mutation:** delete composition/report seed rows
- **Success:** root cannot show `dev-exact-rt-*` densograph
- **Out of scope:** `/dev` frozen fixtures (keep for reference)

---

## Wave 7 — Current ChatGPT uploader

- **Goal:** Re-enable honest archive upload into existing processors
- **Why not first:** pipeline already ran; materialisation/surface truth unfinished
- **Success:** new archive import → candidates → review without seed
- **Out of scope:** re-deriving historical noise without quality gates

---

## Wave 8 — Dead-button / interaction completion

- Track Decision, Log Conflict, Capture overlay, header Add outcome, `/journal-chat` voiding issues, etc.
- **After** durable write targets exist

---

## Wave 9 — Security and production-readiness audit

- Evidence leakage, public projections, auth, readiness → still **NO** until complete

---

## Recommended next implementation campaign

**WAVE 1.1 — ContradictionNode → canonical Map Active-conflicts live projection**

Rationale (dependency, not prior recommendation): CN accept write path is already implemented and unit-proven, but Map **Active conflicts** is populated from disputed `UserMapConclusion` only — not from `ContradictionNode`. Wave 2.1’s “Map conflict” success claim would be false until this read path exists. Composition full_reference seed also blocks live Map merge; Wave 1.1 must include a composition-safe conflicts rule. See `15-wave-sequencing-clarification.md`.

**Then:** WAVE 2.1 — Single genuine ContradictionNode accept → Map conflict → ModelUpdate proof (safety contract in receipt 15 §6).

JSON twin: `repair-wave-sequence.json`.
