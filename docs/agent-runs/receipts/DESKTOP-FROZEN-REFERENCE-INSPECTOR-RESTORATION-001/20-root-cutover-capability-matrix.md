# 20 — Root cutover capability matrix

| Existing production capability | Canonical-live equivalent | Populated runtime proof | Preserved? | Behavioural difference | Root-cutover blocker? |
|-------------------------------|---------------------------|-------------------------|------------|------------------------|-----------------------|
| Auth / ownership | Same Clerk + API ownership | Live candidate under auth | PRESERVED | None | No |
| Today + ModelUpdate identity | live provider → canonical Today | Capture 01–02; MU seed | PRESERVED_THROUGH_NEW_ADAPTER | Content ≠ fixture | No |
| Evidence / Context Inspector | orvek-v0-authority panel | Captures 03–06 | PRESERVED | None | No |
| Linked receipt / related | typed relatedIds/receiptIds + select | Captures 04–05 | PRESERVED_THROUGH_NEW_ADAPTER | Depends on object graph depth | No |
| Model Movement + live report | openReport(live id) | Captures 07–08 | PRESERVED | Live id ≠ rep-weekly | No |
| Map objects | mapCategories + MapPage | Capture 09 | PRESERVED_THROUGH_NEW_ADAPTER | Counts from live | No |
| Decisions | decisionListGroups + DecisionsPage | Capture 10 | PRESERVED_THROUGH_NEW_ADAPTER | Entry module still reference-shaped | No |
| Investigation thread (reference-equivalent) | typed investigation + Explore Investigations + detail enrichment (A+B) | Capture 11 | PRESERVED_THROUGH_NEW_ADAPTER | Uses canonical InvBlocks, not ProductionInvestigationWorkbenchDetail | No |
| Investigation attach-evidence / watch-for action cards | No accepted-reference equivalent; not mounted on current CanonicalWorkbench shell | Not reintroduced | **C — explicit Kay decision** | Old parallel Explore detail actions | **Yes — Kay must decide** if those action cards are required before cutover |
| Timeline | timelineGroups + TimelinePage | Capture 12 | PRESERVED_THROUGH_NEW_ADAPTER | None material | No |
| Explore Free send/stream | handlers + FreeExplore | Capture 13 | PRESERVED_THROUGH_NEW_ADAPTER | Fixture chat off | No |
| Parallel orvek-v0/pages/* | Inactive | Quarantined | OLD_BEHAVIOUR_INTENTIONALLY_REMOVED | N/A | No |

## Investigation capability decision

**Classification: A + B for reference-equivalent investigation detail; C for production-only deep action cards.**

- **A:** Accepted cold/canonical reference expresses investigations as typed `investigation` objects (title, whyItMatters, hypotheses, missingEvidence, relatedIds) in Explore → Inspector. Live hybrid already maps `/api/explore/investigations` into that object type.
- **B:** Competing theories / evidence-needed / linked evidence+fieldwork from `/api/inspector/investigations/:id` are now enriched into the typed object + linked objects (`enrichmentFromInspectorInvestigationDetail`) without mounting a production-specific renderer.
- **C (explicit):** `ProductionInvestigationWorkbenchDetail` attach-evidence / create-watch-for controls and inline evidence/fieldwork article cards have **no accepted-reference equivalent**. Restoring them would require new product design or Kay’s decision to keep them out of cutover. They are already absent from the current CanonicalWorkbench production shell (parallel Explore page inactive).

Root cutover may proceed on investigation **thread detail** (A+B). If Kay requires the old attach-evidence UI before cutover, treat that as a **product decision blocker**, not a silent deferral.
