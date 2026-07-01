# Repair Recommendation

Minimum next repair slice
- Add a dedicated Model Goal object type or equivalent first-class object contract.
- Extend shared selector and inspector typing so goals can be selected without being collapsed into generic memories or references.
- Project Model Goals through the production map data api with evidence-linked detail, current read, uncertainty, and correction affordance.
- Keep conclusion selection intact while adding goal selection.

Implementation boundaries
- Do not change schema unless a bounded repair proves it is unavoidable.
- Do not broaden into full reference parity cleanup.
- Do not change routes, middleware, generation logic, or styling.
- Do not build Model Goals as a separate product area.

Expected repair shape
- A Model Goal selected from Map/workbench should open an inspector detail state.
- The detail state should show the current read, evidence summary, uncertainty when support is thin, and a clear correction handoff.
- The correction handoff should route into Capture Life Data or the existing capture surface with context attached.

