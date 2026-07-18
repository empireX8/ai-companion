# 22 — Root cutover capability preservation

| Capability | Path | Preserved on `/`? |
|------------|------|-------------------|
| Auth / ownership | Clerk + API | Yes |
| Live Today | hybrid → live provider → canonical Today | Yes |
| Map / Decisions / Explore / Timeline | canonical pages + live data | Yes |
| Active Questions / Investigations | typed objects + enrichment | Yes |
| Explore send/stream | OrvekPageHandlersProvider in shared runtime | Yes |
| Linked nav / Back / scroll | canonical Inspector | Yes |
| Correction + durable actions | hybrid + durable refresh | Yes |
| Live movement reports / overlay | openReport(live id) | Yes |
| Honest loading/error/empty | live provider empty states | Yes |
| Parallel orvek-v0/pages | Inactive; rollback route only | Intentionally inactive |
| attach-evidence / watch-for cards | Deferred product decision | Not restored |
