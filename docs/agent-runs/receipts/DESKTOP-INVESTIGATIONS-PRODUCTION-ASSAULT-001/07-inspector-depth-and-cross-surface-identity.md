# Inspector Depth And Cross-Surface Identity

## Inspector domain completed in code

Files:

- `app/api/inspector/investigations/[id]/route.ts`
- `lib/inspector-object-api.ts`
- `components/inspector/panels/SelectedObjectEvidencePanel.tsx`
- `components/investigations/InvestigationDetailInspectorSync.tsx`
- `components/investigations/InvestigationInspectorButton.tsx`
- `components/watch-for/WatchForInspectorAction.tsx`
- `components/inspector/InspectorSelectButton.tsx`

## Exact Inspector fields now exposed for investigations

- `Investigation ID {id}`
- status label
- closure-state label
- created timestamp
- updated timestamp
- organizing question
- competing theories
- missing or pending evidence
- durable outcome text
- resolved timestamp
- linked evidence list with exact evidence IDs
- linked fieldwork/check-ins list with exact fieldwork IDs
- connected map item continuity

Relevant test ids:

- `inspector-investigation-panel`
- `inspector-investigation-id`
- `inspector-investigation-status`

## Cross-surface identity routing repaired

- watch-for Inspector action can now select linked investigations directly
- closed investigation continuity now resolves through `/active-questions/[id]`
- detail page auto-syncs the real investigation selection into the Inspector

## Live Inspector proof status

- create/reload Inspector identity: `Investigation ID cmrmqfgtf000uqlcyy5ebe8fe`
- linkage Inspector identity: `Investigation ID cmrmqgpuz000vqlcyyld7fl7r`
- closure Inspector identity: `Investigation ID cmrmqj2ny000yqlcytelf8esv`
- exact evidence IDs rendered in Inspector: `dev-investigations-assault-evidence-primary`, `dev-investigations-assault-evidence-secondary`
- exact fieldwork/check-in IDs rendered in Inspector: `cmrmqhemr000xqlcybzz0kdh7`, `cmrmqjvr00010qlcy87wigyl4`
- exact check-in note rendered in Inspector: `Investigations assault check-in: the stop point only held once I named it before the next ask.`
- exact outcome / closure rendered in Inspector: `Investigations assault outcome: explicit stop-point naming reduced reopened scope pressure.`
- exact Inspector closure label: `Resolved · Closed as resolved`
