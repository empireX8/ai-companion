# 04 — Real account provenance counts

User: `user_34TUYA53pI1QRLK73O22Kve1a1G`  
Buckets: (1) ChatGPT-import-derived (2) native captures (3) full-reference seed (4) unknown

## Separation rules used

| Bucket | Strongest proof |
|--------|-----------------|
| **1 Import-derived** | `Session.origin=IMPORTED_ARCHIVE` + `importedSource`/`importedExternalId`/`importedAt`; upload session `cmp2ftxhj0000qlsyxi55jo20`; evidence/refs/contras/patterns citing those sessions; UELs with `sourceType=import_record` pointing at that upload |
| **2 Native** | `Session.origin=APP` (+ journal if any) |
| **3 Seed** | `CanonicalTodayComposition.source=full_reference_round_trip_seed`; IDs prefixed `dev-exact-rt-`; report id `dev-exact-rt-…-report-weekly`; importReview candidate ids `…-import-cand-ic1..ic4` |
| **4 Unknown** | Could not prove lineage (none claimed below without proof) |

---

## Counts by metric

| Metric | (1) Import-derived | (2) Native | (3) Seed | (4) Unknown |
|--------|-------------------:|-----------:|---------:|------------:|
| Imported conversations | **640** | 0 | 0 | 0 |
| Imported messages | **18,582** | — | 0 | 0 |
| APP conversations | 0 | **3** | 0 | 0 |
| APP messages | 0 | **44** | 0 | 0 |
| Source units / chunks | upload chunks **186**; spans **5,922** | spans **19** | 0 | 0 |
| Extraction attempts (`DerivationRun` import) | **635** completed, **0** failed | native runs **22** | 0 | 0 |
| Successful extraction outputs (spans + accepted refs/contras) | spans **5922**; refs **29**; contras **25** | — | 0 | 0 |
| Failed extraction outputs | **0** failed runs; high **rejection** counts inside successful runs (refs rejected 5893) | — | 0 | 0 |
| Generated candidates (ReferenceItem + ContradictionNode) | **29 + 25 = 54** | 0 | 0 | 0 |
| Pending candidates (still `candidate`) | **54** | 0 | 0 | 0 |
| Reviewed candidates (lifecycle advanced on those tables) | **0** (all still `candidate`) | 0 | 0 | 0 |
| Accepted / rejected candidates (ReferenceItem/Contradiction) | **0 / 0** | 0 | 0 | 0 |
| Seeded Import-review “candidates” (composition only) | 0 | 0 | **4** | 0 |
| Receipts / evidence from imports | spans **5922**; pattern evidence **33**; UEL rows tied to UM include import_record/message/span/etc. (**50** UEL total → one UM) | thin | densograph receipt objects inside seed payload (**not** DB EvidenceSpan) | 0 |
| Model objects from imports (by type) | PatternClaim **7** (`active`); UserMapConclusion **1** (promoted, UEL includes `import_record`); ModelUpdate **1** (`conclusion_added` for that UM); Investigation **0**; Fieldwork **1** (prompt “Wind down…” — **not** proven import-derived; treat as **native/other** unless later linked) | Fieldwork likely native/other | densograph **67** objects in composition | Fieldwork provenance weak → see note |
| Links from imports | PatternClaimEvidence **33** citing imported sessions; UEL **50** (all target one UM; includes 6 `import_record`) | — | densograph relatedIds inside seed | 0 |
| Decisions from imports | **0 proven** (`SurfacedAction` **7** exist — not import-lineage proven) | unknown mix | seed decision objects in composition | SurfacedAction **7** → unknown vs native |
| Patterns/loops from imports | **7** PatternClaims (3 repetitive_loop, 2 trigger_condition, 1 inner_critic, 1 recovery_stabilizer) | 0 | seed loop objects in composition | 0 |
| Contexts / questions / investigations / outcomes from imports | **0** first-class import-derived beyond patterns/UM | sparse | seed contexts/questions/investigations in composition | 0 |
| Model updates/movements from imports | **1** ModelUpdate affecting import-linked UM | 0 | seed movements in composition/report | 0 |
| Canonical composition from imports | **0** (composition is seed) | 0 | **1** composition + **1** weekly report | 0 |

### Fieldwork note

`FieldworkAssignment` id `cmqazrqi10000qlmbmvkyh9xv` (“Wind down 20 minutes before bed”) has **no** import provenance fields and is **not** counted as ChatGPT-import-derived.

### UserMap note

UM `cmq6frqdx0000ql8h6nkavzue` created `2026-06-09` (≈4 weeks after import). UELs include `import_record` → upload session `cmp2ftxhj0000qlsyxi55jo20` plus pattern/contradiction/message/span sources. Counted as **import-linked understanding object**, not as proof that automatic full-archive materialisation works at scale.

---

## Headline contrast

| | Import-derived reality | Seed presentation overlay |
|--|------------------------|---------------------------|
| Conversations | 640 | densograph `imp-1` summary claims archive scale |
| Review candidates in shell Import | **0 live DB candidates wired** | **4** `dev-exact-rt-…-import-cand-ic*` |
| Canonical objects | 7 patterns + 1 UM + 1 MU (+ stuck candidates) | **67** densograph objects |
