# UX-PATH-AUDIT-001 Intake

- Repo: `/Users/user/ai-companion`
- Branch: `ux-path-audit-001-full-surface-interaction-map`
- Mode: audit only
- Scope: static UI button-to-UX-path inventory for the Orvek / MindOS workbench surface

## Audit Goal

Inventory every meaningful interactive UI element and UX path in the current app surface, then classify each path as wired, partially wired, visual-only, broken, duplicated, unclear, dead-ended, or unknown.

## Method

- Static code inspection first.
- Focused the pass on the mounted workbench shell, Today, Map, Decisions, Timeline, Explore, What Changed, Inspector, Watch For, Active Questions, Patterns, Contradictions, Library, References, Journal, Check-ins, Context, Help, Import, Account / Settings, Metrics, and the internal Audit surface.
- Treated route aliases and redirects as part of the path map only when they are reachable from current UI.
- Excluded unmounted legacy view trees and dormant components unless they are part of a currently mounted route.

## Non-Goals

- No UI redesign.
- No styling changes.
- No schema or API changes.
- No route rewrites.
- No product-feature additions.

## Evidence Rules

- User-facing claims must be backed by the current code.
- Placeholder copy, disabled controls, and return-early handlers are recorded as path health issues, not as successful wiring.

## Verification Plan

- `git diff --check`
- `npx tsc --noEmit`
- `npm run build`

