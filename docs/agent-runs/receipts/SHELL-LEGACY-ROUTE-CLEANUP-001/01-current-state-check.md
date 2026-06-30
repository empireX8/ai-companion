# Current State Check - Shell Legacy Route Cleanup

**Branch:** `shell-legacy-route-cleanup-001`

## Before repair

The audit showed visible v0 shell interactions leaking into blocked or dead paths:

- `Import` targeted `/import`
- Command palette exposed blocked legacy routes
- Journal Chat `Open patterns` targeted `/patterns`
- Your Map mind-context exposed `/context`, `/memories`, and memory detail routes
- Your Map and Watch For exposed `Active Questions` links to `/active-questions`
- Decisions `Add outcome` looked active but no-oped in production

## After review

The intended correction is to preserve the visible shell while removing dead-end legacy route targets and replacing no-op active-looking controls with honest disabled states.

## Constraints confirmed

- No schema change
- No middleware rewrite
- No generation logic change
- No new product surface
- No visual redesign
