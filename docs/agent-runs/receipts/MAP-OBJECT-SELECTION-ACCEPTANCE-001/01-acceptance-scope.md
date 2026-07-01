# Acceptance Scope

In scope
- Verify the production Map/workbench is no longer conclusion-only.
- Verify the current implementation already exposes conclusion, Mind Context, and Model Goal selection paths.
- Verify selection stability and safety behavior using existing tests.
- Record whether any blocker exists before broader repair.

Out of scope
- No production source edits.
- No new product concepts.
- No Active Questions / Watch For repair.
- No schema changes.
- No middleware changes.
- No unrelated refactors.
- No receipt rewrites from prior phases.

Decision rule
- If acceptance coverage is missing, add only the smallest focused test needed to prove the gap.
- If coverage already exists, keep this slice receipts-only.
