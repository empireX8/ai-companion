# 04 — Import quarantine

## Change

`lib/import-chatgpt.ts` — `classifyImportedContradictionPair`:

1. **Rejection gates retained** (project/task noise, low-context, pasted plan, cross-topic, conversational sideA, weak sideB, technical sideB, unrelated low-overlap).
2. **Removed** behavioral-admission regex as an escape that made pairs “related enough” to become eligible.
3. **Removed** token-overlap escape that treated technical sideB with shared tokens as eligible.
4. **Fail closed:** when no hard rejection applies, return:
   ```ts
   { eligible: false, reasons: ["contradiction_semantic_adjudication_required"] }
   ```
5. Diagnostics distinguish quarantine (`imported_contradiction_quarantined` / `contradiction_semantic_adjudication_required`) from hard rejection (`imported_contradiction_rejected`).

## Combined with live detector quarantine

Because `detectContradictions` returns `[]`, the import loop never reaches materialisation for marker-only messages. Classifier quarantine remains the second fail-closed gate if detections ever reappear without semantic wiring.

## Contracts satisfied

| ID | Contract |
|----|----------|
| L–P | Token overlap / behavioral regex / “not rejected” ≠ eligibility |
| Q | Marker-only import → zero ContradictionNodes |
| R | No `contradiction_candidate` derivation artifact from quarantined path |
| S | Quarantine reason distinct from hard rejection |
| T | ReferenceItem extraction unchanged |
| U | Existing 25 not created/updated/deleted/backfilled |

## Explicit non-goals

- No adjudicator / referee / model-runner wiring into import
- No schema / materialisation / review UI changes
