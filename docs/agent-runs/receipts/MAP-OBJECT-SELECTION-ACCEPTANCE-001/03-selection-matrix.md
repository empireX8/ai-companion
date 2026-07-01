# Selection Matrix

| Scenario | Evidence |
|---|---|
| Conclusion selection | `map-production-api.test.ts` and `orvek-workbench-selection.test.ts` |
| Mind Context selection | `map-production-api.test.ts` and `your-map-workbench.test.ts` |
| Model Goal selection | `map-production-api.test.ts`, `orvek-workbench-selection.test.ts`, and `your-map-workbench.test.ts` |
| Mixed object rails | `map-production-api.test.ts` plus the workspace wiring tests |
| Preferred selection stability | `orvek-workbench-selection.test.ts` |
| Empty states | `map-production-api.test.ts` and `your-map-workbench.test.ts` |
| Blocked / unavailable links | `map-production-api.test.ts` |
| Evidence / receipt states | `map-production-api.test.ts` and `your-map-workbench.test.ts` |
| Inspector handoff safety | `inspector-selection.test.ts`, `inspector-surface-wiring.test.ts`, and `orvek-ux-integration.test.ts` |

Acceptance conclusion
- The matrix is covered by existing tests, so no acceptance blocker remains.
- The Map/workbench is not conclusion-only anymore.
