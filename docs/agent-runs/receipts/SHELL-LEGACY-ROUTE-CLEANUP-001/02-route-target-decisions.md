# Route Target Decisions

**Branch:** `shell-legacy-route-cleanup-001`

| Visible action | Decision | Reason |
|---|---|---|
| Top bar `Import` | Disabled honestly | No v0 import surface is available, so the control must not imply a working legacy route. |
| Command palette legacy entries | Remove from visible commands | The app should not advertise blocked public routes as actionable commands. |
| Journal Chat `Open patterns` | Disabled honestly | `/patterns` is blocked and has no approved v0 destination. |
| Your Map `Open Context` / `Manage Memories` | Disabled honestly | `/context` and `/memories` are blocked legacy routes with no approved v0 replacement. |
| Your Map memory detail links | Disabled honestly | `/references/[id]` is a blocked legacy detail target. |
| Your Map `Active Questions` footer | Disabled honestly | `/active-questions` is blocked and should not be shown as a clickable destination. |
| Your Map open-questions preview rows / `View all` | Disabled honestly | The preview had pointed at `/active-questions`; it must not advertise a blocked target. |
| Watch For `Active Questions` footer | Disabled honestly | Same blocked legacy route, same honest-disabled treatment. |
| Decisions `Add outcome` | Disabled honestly | The action no-ops in production and must not look active. |

## Decision rule

When a visible action has no approved v0 destination, prefer an honest disabled state over a dead or blocked route.
