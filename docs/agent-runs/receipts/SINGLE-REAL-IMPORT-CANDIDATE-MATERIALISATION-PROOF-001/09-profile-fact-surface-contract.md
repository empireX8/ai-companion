# 09 — Profile-fact surface contract

## Hierarchy (Preferences / interests)

1. **Current understanding** — higher-level interpreted profile summary (unchanged composition/fixture summary when present)
2. **KNOWN PREFERENCES** — concrete accepted active `ReferenceItem` facts (`type=preference`)
3. **Why Orvek thinks this** — supporting interpretation copy for the section
4. **Correct the model** — existing correction controls

Raw accepted facts must **not** be silently merged into the high-level summary.

## Type → section mapping (truthful only)

| `ReferenceType` | Map profile section | Facts heading |
|-----------------|---------------------|---------------|
| `preference` | `ctx-interests` — Preferences / interests | **KNOWN PREFERENCES** |
| `constraint` | `ctx-constraints` — Constraints | **KNOWN CONSTRAINTS** |

### Gaps (unsupported — do not invent)

`goal` · `pattern` · `assumption` · `hypothesis` · `rule` · `source`

Goals remain UserMap / Decisions destinations, not this profile-fact layer.

## Visibility rules

| Status | Render in profile facts? |
|--------|---------------------------|
| `active` | **Yes** (mapped types only) |
| `candidate` | **No** |
| `dismissed` / `inactive` / `superseded` | **No** |

## Honesty rules

- Preserve stored confidence (`low` / `medium` / `high`) — do not relabel as verified
- Show imported-archive provenance when `sessionOrigin=IMPORTED_ARCHIVE`
- Show conversation/message availability when FKs exist
- **Do not** claim a ModelUpdate exists for ReferenceItem acceptance
- **Do not** claim UnderstandingEvidenceLink exists when schema cannot target `reference_item`

## Model movement rule

No ModelUpdate for mechanical ReferenceItem acceptance. Profile fact ≠ model movement.

## Fixture / live boundary

- Root / canonical live: attach DB-backed profile facts (`referenceSurface !== true`)
- Frozen reference / fixture: **no** live fact injection; deterministic fixture only
- Do not clean synthetic seed data in this campaign
