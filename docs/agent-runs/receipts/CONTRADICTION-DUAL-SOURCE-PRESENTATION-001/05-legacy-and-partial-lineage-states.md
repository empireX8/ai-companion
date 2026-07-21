# 05 — Legacy and partial lineage states

| Stored FK shape | Presentation `lineageState` | Behaviour |
| --- | --- | --- |
| both null | `legacy_unavailable` | One calm notice: “Exact source excerpts were not recorded for this legacy candidate.” |
| exactly one present | `partial_unavailable` | Both sides unavailable with `partial_lineage` — not treated as a complete repaired pair |
| both present, integrity fail | `integrity_unavailable` | Side-specific unavailable reasons; no proposition/message fallback |
| both present, verified | `complete_verified` | Ordered Side A/B exact excerpts + provenance |

Existing Kay cohort remains 25 both-null legacy candidates. No backfill/re-extract/confirm/dismiss.
