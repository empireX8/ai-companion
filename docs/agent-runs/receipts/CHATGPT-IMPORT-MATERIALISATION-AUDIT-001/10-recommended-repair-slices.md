# 10 — Recommended repair slices

Kay-accepted dependency order. Keep as **separate campaigns**.  
Do **not** build new upload UX first.  
Do **not** clean the full-reference seed before a working DB-backed candidate review and materialisation path exists.

## Authoritative sequence

1. **Connect canonical Import review to genuine database candidates**  
   Wire shell Import / `importReview` to real `ReferenceItem`, `ContradictionNode`, and/or other import-derived candidate tables — not seed densograph `ic1–ic4`.

2. **Persist accept/reject decisions**  
   Replace local React-only overlay state with durable review writes.

3. **Materialise accepted candidates**  
   Accepted → receipts, typed objects, links, provenance (`Session`/`Message`/`import_record`), and model movement.

4. **Prove canonical providers surface materialised records**  
   Today / Map / Decisions / Experiment / Timeline / Inspector read the real post-accept model — not seed composition.

5. **Clean the full-reference seed**  
   Only **after** steps 1–4 exist; run **immediately before** genuine-data verification.  
   Plan: `09-seed-cleanup-plan.md`. Do not execute on this audit branch.

6. **Repair extraction / filter coverage**  
   After the downstream chain is proven. Improve yield / reprocess sparse sessions only once review→materialise→present works.

7. **New canonical archive-upload UX**  
   Later separate campaign. Backend `/api/upload/*` already exists. Not required to materialise the archive already stored.

---

## Mapping to prior slice labels

| Step | Prior label |
|------|-------------|
| 1–3 | Candidate review / materialisation repair (**first repair campaign**) |
| 3–4 | Receipt/object/link lineage + composition/provider proof |
| 5 | Full-reference seed cleanup |
| 6 | Extraction/job + candidate-generation repair |
| 7 | New canonical ChatGPT-export upload UX |

## First repair campaign title

**DB-BACKED CANDIDATE REVIEW AND MATERIALISATION** (steps 1–3 as the opening bounded campaign; step 4 as the acceptance proof for that campaign or immediate follow-on).
