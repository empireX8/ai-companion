# Current State Evidence

Conclusion selection
- `lib/__tests__/map-production-api.test.ts` still proves conclusion projection, selected-id resolution, and detail fields on the map rail.
- `lib/__tests__/orvek-workbench-selection.test.ts` still proves conclusion preference remains the default when conclusions exist.

Mind Context selection
- `lib/__tests__/map-production-api.test.ts` proves `context_profile` items project as first-class context objects and raw aliases.
- `lib/__tests__/your-map-workbench.test.ts` proves Mind Context detail copy and correction handoff are present in the production workspace.

Model Goal selection
- `lib/__tests__/map-production-api.test.ts` proves `model-goal` objects project with safe map links, evidence summary, and raw aliases.
- `lib/__tests__/orvek-workbench-selection.test.ts` proves goal selections normalize onto the `goal-...` rail id.

Mixed rails
- `lib/__tests__/map-production-api.test.ts` already exercises mixed production input with conclusions, Mind Context, open questions, and empty-state branches.
- `lib/__tests__/your-map-workbench.test.ts` and `lib/__tests__/inspector-surface-wiring.test.ts` prove Mind Context and Model Goal behavior on the same production workspace surface family.

Blocked and unavailable links
- `lib/__tests__/map-production-api.test.ts` proves blocked `/patterns/...` context links are not exposed as clickable detail hrefs.
- The same test file proves v0-safe `/your-map/...` context links remain clickable.

Inspector handoff safety
- `lib/__tests__/inspector-surface-wiring.test.ts` proves Model Goal inspection routes through `model_goal` and uses Capture Life Data handoff copy.
- `lib/__tests__/orvek-ux-integration.test.ts` proves the published-safe selector allowlist includes `context_profile` and `model_goal`.
