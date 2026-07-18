# 01 — Historical ingestion inventory

## Classification summary

| Layer | Classification |
|-------|----------------|
| Historical archive ingestion **backend** | **backend present** |
| Historical archive ingestion **UI** | **UI present but inactive** (middleware 404; not exposed by canonical shell) |
| Legacy one-shot API | **obsolete** (`POST /api/import/chatgpt` → 410) |
| Current canonical shell exposure of upload | **UI absent** from current Import button (separate capability) |

Backend can operate **without** the historical UI: authenticated clients can drive `/api/upload/*`.

---

## End-to-end historical path (still implemented)

```
POST /api/upload/init
 → POST /api/upload/chunk (×N)
 → POST /api/upload/finalize → enqueueImportProcessing
 → processChatImportSession (stream parse conversations.json)
 → importExtractedConversations → Session + Message
 → GET /api/upload/status | /api/upload/history
```

---

## Stage table

| Stage | Historical UI | API | Service | Schema | Input | Output | Provenance | Exists? | Reachable? | Old-shell tied? | Backend w/o UI? | Canonical shell exposes? |
|-------|---------------|-----|---------|--------|-------|--------|------------|---------|------------|-----------------|-----------------|--------------------------|
| Export upload | `/import` page dropzone | `POST /api/upload/init\|chunk\|finalize` | `import-upload-service.ts` | `ImportUploadSession`, `ImportUploadChunk` | zip/json ≤2GB | upload session + chunks | `userId`, filename, bytes | yes | API yes; page **no** (middleware) | page is legacy route | yes | **no** |
| File validation | client + server | same | `isValidFileType`, chunk checksums | session fields | mime/ext/size | accept/reject | — | yes | via API | no | yes | no |
| Archive parsing | — | processing after finalize | `import-upload-processor.ts`, `import-chatgpt.ts` (`extractConversationsJsonFromZip`, `parseConversationForImport`) | — | zip/json bytes | conversation structs | — | yes | server-side | no | yes | no |
| Conversation creation | — | — | `importExtractedConversations` | `Session` | parsed convo | `Session` rows | `origin=IMPORTED_ARCHIVE`, `importedSource`, `importedAt`, `importedExternalId` | yes | on process | no | yes | Timeline “Imported history” only |
| Message creation | — | — | same | `Message` | parsed msgs | `Message` rows | `sessionId`, `userId`, timestamps | yes | on process | no | yes | no direct Import UI |
| Import batch tracking | history panel/page | `GET /api/upload/history\|status` | upload service | `ImportUploadSession` (**no `ImportBatch` table**) | — | status/counters/`resultErrors` | session id | yes | API yes | UI inactive | yes | no |
| Duplicate handling | — | — | unique `(userId, importedExternalId)` skip | `Session` unique | external id | skip existing | external id | yes | on process | no | yes | n/a |
| User scoping | Clerk auth on routes | all upload routes | `auth()` → `userId` | all rows keyed by `userId` | session | scoped writes | `userId` | yes | yes | no | yes | n/a |
| Job creation | — | finalize enqueue | `import-upload-queue.ts` (in-process `setTimeout`, not Redis) | status machine on upload session | finalized upload | processing → complete/failed | session id | yes | yes | no | yes | no |
| Success/failure reporting | `/import` poll UI | status/history | counters + `resultErrors` + diagnostics blob | upload session | — | UI/API status | diagnostics in `resultErrors` | yes | API yes | UI inactive | yes | no |

### Key files

- UI: `app/(root)/(routes)/import/page.tsx` (blocked by `middleware.ts` `LEGACY_PUBLIC_BLOCKED_ROUTE_PREFIXES` including `/import`)
- APIs: `app/api/upload/{init,chunk,finalize,status,history}/route.ts`
- Core: `lib/import-upload-service.ts`, `lib/import-upload-processor.ts`, `lib/import-upload-queue.ts`, `lib/import-chatgpt.ts`, `lib/import-chunk-storage.ts`
- Obsolete: `app/api/import/chatgpt/route.ts` (410)

### Post-import hooks (ingestion-adjacent, not upload UI)

On complete (`onImportComplete` in `import-upload-queue.ts`):

1. `patternBatchOrchestrator.runForUser({ trigger: "import" })`
2. `tryCreateInternalUserMapCandidateFromImportCompletion` (dark-engine bridge)

---

## Reachability notes

- Canonical workbench Import button ≠ upload (see `06-current-import-button-boundary.md`).
- Stale links to `/import` remain in older shells/settings/help; middleware returns 404 for non-allowlisted legacy prefixes.
- Active production `RouteTopBar` may show Import as unavailable separately; canonical `components/orvek-v0/top-bar.tsx` enables Import only when `importReview` batch is present.
