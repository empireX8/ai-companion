# Data Flow Findings

Core spine status:
- Mostly wired.
- Inspector boundary between Evidence / Context and Mind Model Movement is correct in code and covered by tests.
- What Changed report selection, map detail drill-ins, watch-for drill-ins, and journal-chat send flow are all connected.

Highest-risk failures:
- Explore `Ask` and quick prompts point to Inspector movement instead of sending chat data.
- Top-bar `Import` still targets `/import`, which middleware blocks.
- Command palette still exposes multiple blocked legacy routes.
- Journal Chat still exposes `Open patterns` to `/patterns`, which middleware blocks.
- Your Map mind-context exposes blocked legacy routes for `Open Context`, `Manage Memories`, and memory detail links.
- Your Map and Watch For still expose `Active Questions` links to a blocked route.
- Decisions `Add outcome` looks active but no-ops in production.

Shell cleanup result:
- The shell leakage above was repaired in `shell-legacy-route-cleanup-001`.
- Top-bar `Import`, command palette legacy entries, Journal Chat `Open patterns`, Your Map legacy context/memory links, Your Map and Watch For `Active Questions`, and Decisions `Add outcome` no longer present blocked public routes as active-looking affordances.
- Your Map open-questions preview rows and `View all` no longer link to blocked `/active-questions`.

Explore composer wireup result:
- Explore `Ask` now sends the composer draft into the real `explore_chat` session and renders in the Explore conversation area.
- Explore quick prompts now send into the same Explore conversation output instead of switching the Inspector to movement.
- Explore composer focus no longer routes users into Inspector movement.

Honest deferrals:
- Explore, fieldwork, and some decision actions are disabled with visible deferred styling rather than silent failure.

Today routing result:
- Today full report now routes into the live `/what-changed` report surface.
- Today primary re-entry actions now use the valid v0 re-entry target set rather than the narrower shared-shell allowlist.
- Today now rows now choose route output first and only fall back to Inspector when the public detail route is blocked or absent.

What remains clean:
- Today capture and journal-chat send are real data-creation paths.
- What Changed to Inspector movement is wired.
- Map / Your Map detail and inspector selection are wired.
- Inspector model_update Evidence / Context remains boundary-correct.
- Inspector model_update Mind Model Movement still owns the epistemic report.

Remaining findings after Today routing repair:
- No remaining Step 1 routing/output findings are open in `V0-UX-FLOW-001`.
- Language polish, visual formula work, and brand work remain outside this audit record.
