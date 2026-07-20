# 06 — Live and import wiring

## Live path

`app/api/message/route.ts` now passes:

- `sessionId: session.id`
- `messageId: userMessage.id`

to `detectContradictions`.

The detector DB query includes `sourceSessionId = session.id`.

Production materialisation remains fail-closed because `detectContradictions` still returns `DetectedContradiction[] = []`.

No unbounded production model call was added on every message for a non-persistable selection result.

## Import path

`lib/import-chatgpt.ts` now passes:

- `sessionId: created.sessionId`
- `messageId: importedMessage.id`

Each imported conversation only considers references from its created Session (via the same-session query).

No materialisation of selected semantic pairs in CEQR-004.

Import/reference extraction behaviour unrelated to contradiction selection is preserved.

## Backfill path

`lib/contradiction-backfill.ts` supplies session/message scope to the detector, but remains unable to generate repaired contradiction candidates until later persistence gates land.

Marker-only backfill creation is not revived.

## Same-message pairs

Policy permits same-message clause pairs because both source units share a session and message.

Runtime same-message proposition extraction by regex was **not** invented.

Pure selection tests may supply two exact `KernelSourceUnit`s pointing to the same message with distinct exact evidence claims.

Runtime same-message proposition extraction remains deferred.
