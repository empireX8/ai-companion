# Target Decisions

## Decision 1

Treat `/what-changed` as an integrated Orvek workbench route.

Reason:
- The route already mounts `OrvekWhatChangedView`.
- That view already uses `OrvekV0PageShell`.
- The Today full report CTA should therefore route into the real What Changed report surface.

## Decision 2

Use two route allowlists instead of one.

- `Integrated workbench` routes keep the shared shell/Inspector contract.
- `Today re-entry` routes include valid visible v0 destinations even when they do not share the shell, such as `/watch-for` and `/journal-chat`.

Reason:
- Today re-entry should target correct output space, not just same-shell pages.

## Decision 3

Resolve Today now rows route-first, then Inspector fallback.

- If a row has a live Today re-entry route, navigate there.
- If the row route is blocked or absent but a registered Inspector selection exists, open Inspector.
- Otherwise leave the row non-interactive.

Reason:
- Fieldwork, decisions, and timeline rows own route output spaces.
- Pattern/tension rows still need Inspector fallback because their legacy detail routes remain blocked.

## Decision 4

Keep blocked Today affordances honestly unavailable.

- Active-question rows remain non-interactive because `/active-questions` is still blocked.
- Dormant quick check-in chips remain unavailable instead of linking to `/check-ins`.
