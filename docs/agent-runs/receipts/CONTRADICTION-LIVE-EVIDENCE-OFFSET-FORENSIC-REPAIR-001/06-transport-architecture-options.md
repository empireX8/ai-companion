# 06 — Transport architecture options

| Option | Source authority | Lexical safety | Model counting burden | Strict schema | Dynamic schema | Unicode | Diagnostics | Migration | Prod impact |
|---|---|---|---|---|---|---|---|---|---|
| A. Raw offsets + stronger prompt | code-owned quote | soft (prompt only) | high | easy | none | model must count | weak unless added | low | low |
| B. Code-owned boundary indices | code-owned | strong (mid-word absent) | low (pick index) | easy (int nonnegative) | catalog in prompt (bounded) | code maps UTF-16 | strong | medium (schema-v4) | medium |
| C. Code-owned span candidates | code-owned | strongest | lowest | harder (enums) | high per request | code-owned | strong | high | higher |

## Preference

Smallest structural repair that makes mid-word cuts impossible for in-range
selections: **B**.

## Catalog prompt bound (Architecture A)

Fail-closed before provider invocation:

1. Check UTF-16 source length **before** any catalog enumeration.
   Over-length → `catalogComputation: skipped_source_over_limit`,
   `catalogLength: null`, no catalog array constructed.
2. Bounded-enumerate in-bound sources; stop at MAX_ENTRIES+1 sentinel.
   Over-entry → `catalogComputation: stopped_entry_over_limit`; sentinel
   catalog is never sent to a provider.
3. Limits: `LEXICAL_BOUNDARY_CATALOG_MAX_SOURCE_UTF16` = 512,
   `LEXICAL_BOUNDARY_CATALOG_MAX_ENTRIES` = 256.

Prompt formatter and adjudicator prompt builder require prevalidated catalogs
(no default/hidden enumeration). Binding uses the same immutable catalog
instance as the prompt.
