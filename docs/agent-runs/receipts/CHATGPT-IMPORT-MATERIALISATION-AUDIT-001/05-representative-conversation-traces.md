# 05 — Representative conversation traces

Upload batch: `cmp2ftxhj0000qlsyxi55jo20` (complete)  
Raw detail: `audit-readonly-traces.json`  
Private message bodies are not dumped here.

Lineage template:

`import batch → conversation → messages → spans → extraction → candidates → review → receipt → model object → links → model update → canonical surface`

---

## Trace 1 — Rich spans, no candidates

| Field | Value |
|-------|-------|
| Bucket | rich_evidence_spans |
| Conversation | `437b78dd-132f-4214-89b6-1d514f53bc7f` |
| Label | Branch · … · CodeSpring app overview |
| Provenance | `IMPORTED_ARCHIVE` / `chatgpt_export_json` / externalId `68ff8c57-…` / importedAt 2026-05-12 |
| Messages | 731 (319 user) |
| Spans | **176** |
| Refs / contras / patterns | 0 / 0 / 0 |
| Review / UM links | none |
| **First break** | **`spans_only_no_candidates`** — extraction units exist; no ReferenceItem/Contradiction/PatternClaim evidence for this session |

Topic character: long technical/product branch conversation; filters reject candidate formation.

---

## Trace 2 — Reference candidates stuck

| Field | Value |
|-------|-------|
| Bucket | has_reference_items |
| Conversation | `142d90bc-d5ef-4a45-935d-698bec04a0d2` |
| Label | Pre-structural work insights |
| ExternalId | `693c9a72-…` |
| Messages | 28 (13 user) |
| Spans | 11 |
| ReferenceItems | **2** (`goal`, status **`candidate`**) |
| Contras / patterns | 0 / 0 |
| Understanding links from messages | 0 |
| **First break** | **`candidates_or_patterns_exist_but_no_understanding_object_links`** — candidates never reviewed/accepted into model objects surfaced by composition |

---

## Trace 3 — Contradictions + pattern evidence

| Field | Value |
|-------|-------|
| Bucket | has_contradiction |
| Conversation | `d3fa4659-b504-4335-8957-2ad7a4118d4d` |
| Label | Branch · Mental Regulation Failure |
| Messages | (see JSON) |
| Spans | 10 |
| ContradictionNodes | **4** (status **`candidate`**) |
| Pattern evidence | **2** |
| Understanding links | 0 from this session’s messages |
| **First break** | candidates/patterns exist locally; **no path into shell Import review or densograph composition**; contradiction nodes never leave `candidate` |

---

## Trace 4 — Pattern evidence only

| Field | Value |
|-------|-------|
| Bucket | has_pattern_evidence |
| Conversation | `108eee97-c80c-4452-a25f-695a1f2a126c` |
| Label | Neurodiversity Inquiry |
| Spans | 7 |
| Pattern evidence | **2** (claims are account-level `active`) |
| Refs / contras | 0 / 0 |
| **First break** | pattern claims exist account-wide, but **this conversation does not produce a reviewed import candidate or composition object**; shell Import still shows seed ic1–ic4 |

---

## Trace 5 — No downstream at all

| Field | Value |
|-------|-------|
| Bucket | unprocessed_no_downstream |
| Conversation | `f21c9d63-6d83-4853-b319-e02fc6ae57dc` |
| Label | Philosophy Foundations Guide |
| Provenance | full import provenance fields present |
| Spans / refs / contras / patterns | **0 / 0 / 0 / 0** |
| **First break** | **`no_extraction_outputs`** after messages persisted |

One of **18** imported conversations in this class.

---

## Cross-trace coverage (account-level)

| Coverage | Sessions |
|----------|---------:|
| Imported total | 640 |
| Any EvidenceSpan | 622 |
| Any ReferenceItem | 28 |
| Any ContradictionNode | 14 |
| Any PatternClaimEvidence | 28 |
| Any UEL from message → understanding target | 6 |

**None** of the five traces reach: review accept → receipt materialisation → canonical densograph object under live (non-seed) composition.
