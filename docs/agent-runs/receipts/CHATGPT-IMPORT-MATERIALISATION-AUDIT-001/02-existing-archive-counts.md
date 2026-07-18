# 02 — Existing archive counts

Source: read-only query `audit-readonly-counts.mjs` → `audit-readonly-counts.json`  
User: `user_34TUYA53pI1QRLK73O22Kve1a1G`  
Queried: `2026-07-18T18:37:48Z`

## Provenance proof (not titles)

| Evidence | Value |
|----------|-------|
| `ImportUploadSession.id` | `cmp2ftxhj0000qlsyxi55jo20` |
| Status | `complete` |
| Filename | ChatGPT export zip (`…-2026-02-14-….zip`) |
| Bytes / chunks | 388,272,564 bytes; 186/186 chunks |
| Processed | 640 conversations, 18,582 messages |
| Created counters | `sessionsCreated=640`, `messagesCreated=18582`, `contradictionsCreated=25` |
| Window | started `2026-05-12T09:39:22Z` → finished `2026-05-12T09:41:37Z` |
| Session origin | **all 640** `origin=IMPORTED_ARCHIVE` |
| `importedSource` | **all 640** `chatgpt_export_json` |
| `importedExternalId` | **640/640** present |
| `importedAt` | **640/640** present (range `2026-05-12T09:39:29Z`–`09:41:37Z`) |
| Conversation `startedAt` span | `2025-09-08` → `2026-02-14` (original ChatGPT times) |

This is the historical ChatGPT import, not the full-reference seed (seed IDs use `dev-exact-rt-` and live in composition/report tables).

## Counts

| Metric | Count |
|--------|------:|
| Import batches (`ImportUploadSession`) | **1** (complete) |
| Imported conversations (`Session` IMPORTED_ARCHIVE) | **640** |
| Imported messages | **18,582** |
| Parsed source units / chunks | **No `SourceUnit` table.** Upload chunks: **186**. Extraction units: **5,922** `EvidenceSpan` on imported messages |
| Archive-level jobs | **1** upload-processing job (in-process queue on that session) |
| Extraction/analysis jobs (`DerivationRun` scope=`import`) | **635** |
| — completed | **635** |
| — failed | **0** |
| — pending/running | **0** |
| Unprocessed conversations (no span, no ref, no contradiction) | **18** |
| Conversations with evidence spans | **622** |
| Conversations with reference items | **28** |
| Conversations with contradiction nodes | **14** |
| Conversations with pattern-claim evidence | **28** |

### Derivation processor split

| `processorVersion` | Count |
|--------------------|------:|
| `import-chatgpt@1` | 634 |
| `pattern-v1` | 1 |

### Import diagnostics (aggregates only; private samples redacted in JSON)

From upload `resultErrors` diagnostics blob:

- User messages: 8,432; assistant: 10,150
- Reference candidates accepted: **29** / rejected: **5,893**
- Contradiction evidence accepted: **25**
- Pattern derivation triggered: **true**; pattern claims created: **7**

## Native captures (for separation)

| Metric | Count |
|--------|------:|
| APP sessions | 3 |
| APP messages | 44 (all in one explore session; two APP sessions empty) |
| Journal entries | 0 |
