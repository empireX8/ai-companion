# Desktop Prisma Surfaced Evidence Pointer Migration Fix 001

**Branch:** `desktop-prisma-surfaced-evidence-pointer-migration-fix-001`  
**UI changed:** NO  
**Product logic changed:** NO  
**Schema/migration changed:** YES (index/constraint naming only)

---

## Problem (P3006)

`npx prisma migrate dev` failed on shadow database when applying `20260708194800_add_surfaced_evidence_pointer`:

```
ERROR: relation "SurfacedEvidencePointer_userId_sourceObjectType_sourceObjectId_" already exists
```

---

## Root cause

PostgreSQL truncates identifiers to **63 characters**. Two Prisma-generated names for `SurfacedEvidencePointer` both exceeded that limit and truncated to the **same** relation name:

| Intended name | Length | Truncated to (63 chars) |
|---------------|--------|-------------------------|
| `SurfacedEvidencePointer_userId_sourceObjectType_sourceObjectId_key` (UNIQUE) | 65 | `SurfacedEvidencePointer_userId_sourceObjectType_sourceObjectId_` |
| `SurfacedEvidencePointer_userId_sourceObjectType_sourceObjectId_idx` (INDEX) | 65 | `SurfacedEvidencePointer_userId_sourceObjectType_sourceObjectId_` |

The unique constraint and non-unique index on the same column tuple collided after truncation.

The follow-on migration `20260709140000_add_evidence_pointer_surfacing_rationale` had the same pattern (76-char names) and would have failed next on a clean shadow apply.

---

## Fix

Added explicit short `map:` names in `schema.prisma` and updated the existing migration SQL (no new migration).

### SurfacedEvidencePointer

| Semantic | Old name | New name |
|----------|----------|----------|
| `@@unique([userId, sourceObjectType, sourceObjectId])` | `..._key` (truncated) | `sep_user_src_uniq` |
| `@@index([userId, sourceObjectType, sourceObjectId])` | `..._idx` (truncated) | `sep_user_src_idx` |
| `@@index([userId, status, surfacedAt])` | `SurfacedEvidencePointer_userId_status_surfacedAt_idx` | `sep_user_status_surfaced_idx` |
| `@@index([userId, publicEligible, status])` | `SurfacedEvidencePointer_userId_publicEligible_status_idx` | `sep_user_pub_elig_status_idx` |

Uniqueness preserved: one `SurfacedEvidencePointer` per `(userId, sourceObjectType, sourceObjectId)`.

### EvidencePointerSurfacingRationale (proactive)

| Semantic | New name |
|----------|----------|
| `@@unique([userId, sourceObjectType, sourceObjectId])` | `epsr_user_src_uniq` |
| `@@index([userId, sourceObjectType, sourceObjectId])` | `epsr_user_src_idx` |

---

## Migration history result

**YES** — `npx prisma migrate dev` applied cleanly:

- Shadow database validation passed (no P3006)
- Local DB applied both pending migrations:
  - `20260708194800_add_surfaced_evidence_pointer`
  - `20260709140000_add_evidence_pointer_surfacing_rationale`
- `pg_indexes` confirms distinct names: `sep_user_src_uniq`, `sep_user_src_idx`, etc.

No `prisma migrate reset` run. No user data dropped.

---

## Changed files

- `prisma/schema.prisma`
- `prisma/migrations/20260708194800_add_surfaced_evidence_pointer/migration.sql`
- `prisma/migrations/20260709140000_add_evidence_pointer_surfacing_rationale/migration.sql`

---

## Checks run

```bash
npx prisma validate          # PASS
npx prisma migrate dev       # PASS (shadow + local apply)
npx tsc --noEmit             # PASS
npm run build                # PASS
git diff --check             # PASS
```

---

## Classification

| Item | Value |
|------|-------|
| **PASS/FAIL** | **PASS** |
| Collision found | UNIQUE + INDEX on `(userId, sourceObjectType, sourceObjectId)` truncated to same 63-char name |
| Index/constraint names changed | `sep_user_src_uniq`, `sep_user_src_idx`, `sep_user_status_surfaced_idx`, `sep_user_pub_elig_status_idx`, `epsr_user_src_uniq`, `epsr_user_src_idx` |
| Migration history applies cleanly | **YES** |
| Commit recommendation | Ready for review; **do not commit** until Kay approves slice |
