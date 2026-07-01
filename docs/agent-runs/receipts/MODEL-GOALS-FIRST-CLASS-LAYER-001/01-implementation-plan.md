# Implementation Plan

Planned repair slice
- Add a dedicated Model Goal object contract to the shared Orvek model layer.
- Wire Model Goals into the production map/workbench selection path.
- Add inspector detail support with evidence summary, uncertainty, and correction affordance.
- Keep conclusion and Mind Context selection behavior intact.
- Update the mock/reference data so Model Goals are not only generic goal rows.
- Cover the selector contract and selection behavior with focused tests.

Non-goals
- No schema changes.
- No route renames.
- No middleware changes.
- No generation-logic changes.
- No visual redesign.
- No expansion into Active Questions or Watch For.

Safety rules
- Do not expose unavailable links as clickable targets.
- Do not claim the model changed just because a correction was captured.
- Do not collapse Model Goals back into generic memories or references.
