# Intake Receipt

Phase: `ACTIVE-QUESTIONS-WATCH-FOR-PARITY-001`

Scope
- Narrow copy/path cleanup only.
- No schema changes.
- No middleware changes.
- No visual redesign.
- No Map, Mind Context, or Model Goals changes.
- No new product concepts.

Known acceptance target
- Watch For must not claim Active Questions are unavailable when the `/active-questions` route exists.
- Route-safe copy should preserve evidence, uncertainty, watch-for, active question, and re-entry framing.

Source of truth
- `app/(root)/(routes)/watch-for/page.tsx`
- `app/(root)/(routes)/active-questions/page.tsx`
- `components/your-map/YourMapWorkbench.tsx`
- `lib/__tests__/phase3-watch-for-page.test.ts`
- `lib/__tests__/shell-legacy-route-cleanup.test.ts`

Verification plan
- `git diff --check`
- `npx tsc --noEmit`
- `bash scripts/check-trust-language.sh`
- `bash scripts/check-legacy-surfaces.sh`
- `npx vitest run lib/__tests__/phase3-watch-for-page.test.ts lib/__tests__/shell-legacy-route-cleanup.test.ts`
