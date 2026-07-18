# 17 — Capability preservation: production `/` vs canonical live candidate

Campaign: `DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001`
Date: `2026-07-18`

| Capability | Production `/` (pre-cutover shell already on CanonicalWorkbench + live) | `/dev/orvek-v0-canonical-live` | Classification |
|------------|------------------------------------------------------------------------|--------------------------------|---------------|
| Authentication (Clerk) | Required | Required | **PRESERVED** |
| Ownership on APIs | Hybrid fetches | Same hybrid hook | **PRESERVED** |
| Data availability / honesty | Hybrid readiness gates | Same + live provider empty honesty | **PRESERVED_THROUGH_NEW_ADAPTER** |
| Object selection | Workbench store `select` | Same | **PRESERVED** |
| Linked navigation / Back | EvidencePanel stack | Same authority panel | **PRESERVED** |
| Corrections | Map/store correction path | Same | **PRESERVED** |
| Durable actions refresh | DurableActionsRefreshProvider | Same on live entry | **PRESERVED** |
| Explore send/stream | Page handlers + explore chat hook | Same wiring into canonical FreeExplore | **PRESERVED_THROUGH_NEW_ADAPTER** |
| Report opening | `openReport` + overlays | Same; live report ids | **PRESERVED** |
| Persistence | Existing write APIs | Same handlers | **PRESERVED** |
| Error handling | Hybrid empty/error copy | Live provider does not invent fixtures | **PRESERVED_THROUGH_NEW_ADAPTER** |
| URL state sync | Production shell: `syncRoutesFromPathname` true via live provider | Candidate forces `false` (dev path) | **OLD_BEHAVIOUR_INTENTIONALLY_REMOVED** on candidate only (prod shell retains sync) |
| Parallel `orvek-v0/pages/*` presentation | Inactive | Inactive | **OLD_BEHAVIOUR_INTENTIONALLY_REMOVED** |
| Production MU compose branch | Gated off when `canonicalRuntime` | Same | **OLD_BEHAVIOUR_INTENTIONALLY_REMOVED** |
| Deep Investigations production detail cards | Previously in parallel Explore page | Typed investigation + inspector detail enrichment (A+B); attach-evidence action cards not remounted | **A+B PRESERVED_THROUGH_NEW_ADAPTER**; **C** attach/watch-for action UI needs Kay decision if required |
| Fixture mock conversation on Explore | Off on production | Off on live candidate | **PRESERVED** (honesty) |

## Notes

- Production `/` already mounts `CanonicalWorkbench` + `buildCanonicalLiveRuntimeData` in `OrvekWorkbenchShell` from the earlier hard-swap; the live candidate duplicates that wiring on an isolated route for blue/green review.
- Root cutover is **not** claimed; `/` remains the operational production entry.
- No capability was restored by reactivating `components/orvek-v0/pages/*`.
