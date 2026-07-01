# Implementation Receipt

## Summary

The visible v0 language layer now matches the locked contract more closely across Decisions, Journal Chat, What Changed, Today, and the residual library/mock copy cleanup.

## Files changed

- `app/(root)/(routes)/journal-chat/page.tsx`
- `app/(root)/(routes)/library/[id]/page.tsx`
- `components/orvek-v0/pages/decisions.tsx`
- `components/orvek-v0/pages/today.tsx`
- `components/orvek-v0/pages/what-changed.tsx`
- `components/orvek-workbench/views/V0DecisionsView.tsx`
- `components/orvek-workbench/views/V0TodayView.tsx`
- `lib/__tests__/decisions-surface.test.ts`
- `lib/__tests__/shell-legacy-route-cleanup.test.ts`
- `lib/__tests__/today-reentry.test.ts`
- `lib/__tests__/today-workbench-routes.test.ts`
- `lib/__tests__/what-changed-surface.test.ts`
- `lib/orvek-adapters/today.ts`
- `lib/orvek-adapters/types.ts`
- `lib/orvek-v0/reference-props.ts`
- `lib/today-intelligence-updates.ts`
- `lib/today-reentry.ts`
- `lib/today-surface.ts`
- `lib/mock.ts`
- `lib/what-changed-surface.ts`

## Implemented changes

- Decisions / Actions now use evidence-backed read language.
- Journal Chat now reads as capture-first / structure-later.
- Library detail journal_chat labels now render as `Evidence capture`.
- Mock journal-chat previews now say `Evidence capture`.
- What Changed now exposes the full briefing grammar, including disconfirming evidence, uncertainty, impact, reality gate, fieldwork, re-entry, and conclusion change conditions.
- Today now uses state / delta / why it matters / evidence pointer / re-entry trigger / capture path language.
- Tests were updated to assert the governed copy and reject the old wording.

## Scope guardrails held

- No schema changes.
- No middleware changes.
- No generation logic changes.
- No broad visual restyling.
