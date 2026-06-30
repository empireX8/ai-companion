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
- Today primary re-entry actions are explicitly disabled when the allowlist rejects their target route.
- Today full report output is intentionally deferred instead of linking to a report page that is not yet integrated into the workbench shell.
- Explore, fieldwork, and some decision actions are disabled with visible deferred styling rather than silent failure.

What remains clean:
- Today capture and journal-chat send are real data-creation paths.
- What Changed to Inspector movement is wired.
- Map / Your Map detail and inspector selection are wired.
- Inspector model_update Evidence / Context remains boundary-correct.
- Inspector model_update Mind Model Movement still owns the epistemic report.

Remaining findings after Explore composer repair:
- Today full report output remains a dead end instead of a navigable report surface.
- Today primary re-entry actions still need allowlist reconciliation for valid workbench targets.
- Today now rows still need route-versus-inspector target reconciliation.
