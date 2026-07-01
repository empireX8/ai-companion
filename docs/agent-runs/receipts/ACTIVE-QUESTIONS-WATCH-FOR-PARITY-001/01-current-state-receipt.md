# Current State Receipt

Copy/path issue found
- The Watch For page footer labeled Active Questions as unavailable even though the route exists.
- The Your Map workbench footer carried the same stale unavailable phrasing for Active Questions.

Route state
- `/active-questions` exists and remains reachable.
- `/watch-for` already links back to Watch For correctly on the Active Questions detail surface.
- The stale copy was a footer label issue, not a missing route issue.

Acceptance implication
- The correct fix is to link to the live Active Questions route, not to hide the concept or invent a new unavailable state.
