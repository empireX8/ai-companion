# Outcome And Closure Proof

## Outcome and closure implementation completed in code

Files:

- `components/investigations/InvestigationDetailActions.tsx`
- `app/(root)/(routes)/active-questions/[id]/page.tsx`

Visible production controls:

- `data-testid="investigation-outcome-input"`
- `data-testid="investigation-outcome-save"`
- `data-testid="investigation-transition-gathering_evidence"`
- `data-testid="investigation-transition-testing"`
- `data-testid="investigation-transition-resolving"`
- `data-testid="investigation-transition-resolved"`
- closed-state copy: `This investigation remains reviewable after closure.`
- reopen honesty copy: `Reopening is not exposed on this production surface.`

Detail page now renders:

- lifecycle string
- closure-state label
- durable resolution summary
- resolved timestamp when present
- linked evidence after closure
- linked fieldwork/check-ins after closure

## Live closure proof status

- starting open investigation ID: `cmrmqj2ny000yqlcytelf8esv`
- durable outcome text observed: `Investigations assault outcome: explicit stop-point naming reduced reopened scope pressure.`
- exact final lifecycle state observed in browser: `resolved`
- exact closure timestamp observed in browser/API: `2026-07-15T23:54:45.803Z`
- post-close active-list removal proof: `active-question row count dropped to 0 after reload`
- post-close reviewability proof: `the same investigation reopened from Explore Investigations and rendered at the canonical detail surface`
- exact Inspector status observed after closure: `Resolved · Closed as resolved`
