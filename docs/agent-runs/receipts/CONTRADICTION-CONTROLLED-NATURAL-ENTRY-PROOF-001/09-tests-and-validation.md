# 09 — Tests and validation

## Focused

`lib/__tests__/contradiction-controlled-natural-entry-proof.test.ts`

Covers persisted-input construction (N1–N5), the original gate matrix, resolver-versus-writer integrity without plan egress, mixed-pool cross-session regression, presentation-after-write failure honesty, message-resolver exception before write, and capability non-egress source scans.

## Related

Adjudication, selection, referee, confidence, lineage, persistence plan, repaired writer, duplicate schema, dual-source presentation/routes/UI.

## Commands

- focused + related + full `vitest`
- `npx tsc --noEmit`
- `npx eslint` on changed TS files
- `npm run build` (with env)
- read-only account gate before/after
- `git diff --check`
