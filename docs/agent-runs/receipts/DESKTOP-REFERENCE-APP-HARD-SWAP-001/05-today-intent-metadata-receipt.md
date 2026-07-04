# 05 Today Intent Metadata Receipt

- No visual shell changes were made.
- No reference navigation changes were made.
- Production Today was not wired into the hard-swapped workbench.
- `href` values were preserved as fallback/permalink metadata.
- Workbench-native intent metadata was added to the production Today adapter.
- The `desktop-reference-app-hard-swap-001` #81 visual baseline was left untouched.
- This slice is not production-ready yet.
- The next slice should consume the new metadata in `TodayPage` separately.
- No stash was popped or reused.

Intent metadata now carried by the Today view model:

- `selectionId`
- `inspectSelectId`
- `movementId`
- `reportId`
- `pageId`
- `overlayId`
- `inspectorTab`

Mapped targets:

- `/what-changed` now carries `reportId: "rep-weekly"`.
- `/actions` now carries `pageId: "decisions"`.
- `/timeline` now carries `pageId: "timeline"`.
- `/explore` now carries `pageId: "explore"`.
- `/journal-chat` now carries `overlayId: "capture"`.
- `/your-map` now carries `pageId: "map"`.
- `/watch-for` remains href-only unless a selectable object target is present.

Deferred:

- No shell wiring was changed.
- No production route children were reintroduced as visible UI.
- No mock data was promoted to production-ready state.
- No changes were made to `WorkbenchProvider`, `OrvekWorkbenchShell`, or the Today page renderer.
