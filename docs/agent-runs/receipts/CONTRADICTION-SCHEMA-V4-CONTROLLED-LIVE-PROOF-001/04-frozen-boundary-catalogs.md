# 04 — Frozen boundary catalogs

## Limits (from CEQR-020)

- Max source: 512 UTF-16 code units
- Max catalog: 256 lexical boundary entries
- Source length checked before enumeration; entry count bounded (no silent truncate)

## Catalog hashes (SHA-256)

| Case | Side | Catalog hash |
|------|------|--------------|
| clear | A | `ba6e98ed03090c974c57515236271dda239cbc5cb0bdf94ed164d9acf3c2d811` |
| clear | B | `a0c2bee2034c18f422dc1127bb899637eb67071ae0ad0f960fc1ec1986495507` |
| compatible | A | `6028552ac198da9669280b21aba326d385f972590c48cf4778c58f2747aa4231` |
| compatible | B | `6028552ac198da9669280b21aba326d385f972590c48cf4778c58f2747aa4231` |
| ambiguous | A | `ea6340b18b82020cbca87b93dfa37e923143581c782786458150a5d5aee9fda6` |
| ambiguous | B | `036106a7ae963da73324178f323039b981e830d425c6dda7db8c2b2bb82baa81` |

Compatible A/B share the same catalog hash because both source strings produce
identical enumerated boundary structures under the locked hasher.

## Authority

Catalogs are code-owned. The provider returns boundary indices only; offsets
and quotes are derived from these frozen catalogs after validation.

## CEQR-021 offline execution counts

- CEQR-021 live provider attempts: 0
- CEQR-021 real account queries: 0
- CEQR-021 real database queries/mutations: 0
- CEQR-021 writer/persistence calls: 0
- no live execution is authorised by this patch
- production readiness: NO
