# 07 — Stage PASS / FAIL matrix

Rule: **code existence ≠ operational PASS**. PASS requires evidence on Kay’s real imported archive.

| Stage | Verdict | Evidence |
|-------|---------|----------|
| Historical archive ingestion backend | **PASS** | Upload APIs + processor exist; Kay’s zip completed: 640 sessions / 18,582 messages |
| Historical archive ingestion UI | **PARTIAL** | Page exists; middleware 404; not in canonical shell |
| Stored archive presence | **PASS** | Proven via upload session + `IMPORTED_ARCHIVE` provenance fields |
| Automatic extraction | **PARTIAL** | 635 completed import derivation runs; 5,922 spans; but 18 sessions with no outputs; aggressive rejection |
| Candidate generation | **PARTIAL** | Only 29 refs + 25 contras from 5,922 considered messages; 7 pattern claims succeeded |
| Candidate review | **FAIL** | Real candidates never reviewed (all still `candidate`); shell Import reviews seed only; accept is non-persistent |
| Accepted-candidate materialisation | **FAIL** | No accept→model write from shell Import; internal publish path unused for the 54 stuck candidates |
| Receipt creation | **PARTIAL** | Spans + pattern evidence receipts exist; densograph “receipts” in seed are not import materialisation |
| Object creation | **PARTIAL** | 7 PatternClaims + 1 later UM + 1 MU; no broad typed Orvek object set from archive |
| Linking / lineage | **PARTIAL** | Session/message provenance strong; candidate→composition broken; one UM has rich UELs including `import_record` |
| Model movement | **PARTIAL** | One import-linked ModelUpdate; seed movements dominate presentation |
| Canonical composition | **FAIL** (for import-derived truth) | Composition is `full_reference_round_trip_seed`, not built from archive extrapolation |
| Current presentation | **PARTIAL** | Providers can render seed / sparse live data; do **not** present automatic full-archive understanding |
| Future canonical upload UX | **OUT OF SCOPE** | Known gap; not root cause for stored-archive materialisation |

### Historical ingestion path (secondary classification)

- Backend: **present**
- UI: **present but inactive**
- Canonical shell upload exposure: **absent** (Import button ≠ uploader)
