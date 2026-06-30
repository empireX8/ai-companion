# Residual Risk Register

- Unmounted legacy source components still contain stale blocked-route strings, such as old workbench top bars and the legacy `chat/ChatSurface.tsx` help link.
  - These components are not mounted by the audited v0 surfaces, so they did not affect acceptance.
  - If they are wired back in later, they would need a fresh routing audit.
- Legacy support pages outside the audited visible v0 set still contain blocked-route content.
  - Those pages are not exposed by the visible v0 shell navigation or the command palette.
- No visible v0 action on the audited surfaces silently no-ops or points to a blocked legacy public route.
