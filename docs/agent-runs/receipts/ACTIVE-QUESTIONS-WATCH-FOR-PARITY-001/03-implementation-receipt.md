# Implementation Receipt

Changed files
- `app/(root)/(routes)/watch-for/page.tsx`
- `components/your-map/YourMapWorkbench.tsx`
- `lib/__tests__/phase3-watch-for-page.test.ts`
- `lib/__tests__/shell-legacy-route-cleanup.test.ts`

What changed
- The Watch For page footer now links to `/active-questions` instead of showing it as unavailable.
- The Your Map workbench footer now links to `/active-questions` instead of showing it as unavailable.
- The Watch For page test now expects the live Active Questions href.
- The legacy-surface cleanup test now expects the live Active Questions href in both places and keeps the preview-band non-linkability check narrowly scoped.

Copy principle
- The copy now reflects an existing route instead of implying a blocked or missing surface.
- The change keeps the existing Orvek framing and does not introduce new product language.
