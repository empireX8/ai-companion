# Risk Register

- Reference and mock artifacts still contain historical language such as `Most consequential now` and `What Orvek would choose` in dormant or non-production surfaces. I treated those as residual risk unless they are mounted by a visible v0 route.
- Some tests still assert current Today labels and route expectations, so a future repair will need coordinated test updates rather than copy-only edits.
- The audit did not find a visible shell action exposing blocked legacy public routes in the sampled surfaces, but that is a routing observation rather than a language guarantee.
- `What Changed` and `Today` both appear intentionally summarized in current code, so repairing them will require product decisions about whether to expand the grammar or mark the surfaces unavailable.

