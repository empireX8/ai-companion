# Risk Register

- Risk: adding a goal layer by reusing generic reference types would keep the product frame blurred.
  - Impact: users would still see goals as memory or reference entries instead of model state.
  - Mitigation: add a distinct goal object contract before wiring surfaces.

- Risk: exposing goal detail links before a safe goal route exists would create dead ends.
  - Impact: the workbench would promise navigation that cannot complete.
  - Mitigation: keep unavailable routes unlinked until a v0-safe target is confirmed.

- Risk: goal selection could break existing conclusion selection if selection helpers are widened without care.
  - Impact: the Map/workbench could regress on the current conclusion rail.
  - Mitigation: preserve conclusion selection behavior and add targeted tests around goal selection only.

- Risk: correction UI could imply immediate model change.
  - Impact: the UI would overstate certainty and violate the evidence contract.
  - Mitigation: phrase correction as evidence capture or review input, not a verdict rewrite.

- Risk: tests could be updated only at the label level.
  - Impact: the code would still lack a real goal object path.
  - Mitigation: require tests that prove selectable object shape, inspector detail, and correction affordance.

