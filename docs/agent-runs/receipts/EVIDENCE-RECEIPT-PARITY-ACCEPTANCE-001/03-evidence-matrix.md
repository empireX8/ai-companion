# Evidence Matrix

| Area | Accepted behavior | Evidence |
| --- | --- | --- |
| Conclusion evidence | Conclusion objects remain selectable and evidence-linked | `lib/__tests__/map-production-api.test.ts`, `lib/__tests__/your-map-workbench.test.ts` |
| Mind Context evidence | Context reads show support shape, missing evidence language, and correction handoff | `lib/mind-context-surface.ts`, `lib/__tests__/mind-context-surface.test.ts`, `components/inspector/panels/SelectedObjectEvidencePanel.tsx` |
| Model Goal evidence | Goal reads show support shape, missing evidence language, and correction handoff | `lib/orvek-v0/production/map-api.ts`, `lib/__tests__/map-production-api.test.ts`, `components/inspector/panels/SelectedObjectEvidencePanel.tsx` |
| Inspector evidence panel | Shows current read, confidence, linked path state, and correction CTA | `components/inspector/panels/SelectedObjectEvidencePanel.tsx`, `lib/__tests__/inspector-surface-wiring.test.ts` |
| Weak / missing evidence | Uses thin / provisional wording rather than authority language | `lib/mind-context-surface.ts`, `lib/orvek-v0/production/map-api.ts`, `lib/__tests__/mind-context-surface.test.ts`, `lib/__tests__/map-production-api.test.ts` |
| Correction / capture handoff | Routes to the existing capture surface with context prefill | `components/inspector/panels/SelectedObjectEvidencePanel.tsx`, `lib/__tests__/your-map-workbench.test.ts` |
| Blocked route safety | Unavailable `/references/...` and `/patterns/...` links are not exposed as clickable detail links | `lib/orvek-v0/production/map-api.ts`, `lib/__tests__/map-production-api.test.ts` |
| No visible audit tags | The evidence panel source does not contain bracketed audit tags | `lib/__tests__/inspector-surface-wiring.test.ts` |

