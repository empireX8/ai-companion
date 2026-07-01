# Risk Review

Kept intentionally out of scope:
- Model Goals.
- Schema changes.
- Middleware/auth changes.
- Route renames.
- Styling or visual redesign.
- Prompt-generation rewrites unrelated to the context layer.

Residual risk:
- If a context item is missing from the production evidence projection, the inspector will fall back to an honest unavailable state rather than inventing a read.
- The correction flow captures evidence input in Capture Life Data using the existing `/journal-chat` route; it does not claim the model has already been updated.
- Any broader parity cleanup for other layers remains deferred to later phases.
