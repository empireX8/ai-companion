# Golden Object Set

> Fixed anchors for repeatable Product Intelligence Benchmark comparison.  
> Do not change ids without Kay approval — add new golden objects instead.

---

## GOLDEN-INSPECTOR-001

| Field | Value |
|-------|-------|
| **Golden ID** | GOLDEN-INSPECTOR-001 |
| **Movement id** | `cmq6h8ewn0000qlbwlg485jx1` |
| **Affected object id** | `cmq6frqdx0000ql8h6nkavzue` |
| **Affected object type** | `usermap_conclusion` |
| **Surface** | Workbench Inspector → Evidence / Context tab + Mind Model Movement tab |
| **Route** | Today workbench → select model_update → inspector tabs |
| **Reference surface** | Local v0 direct map conclusion inspector (`UserMapEvidencePanel` section formula) |
| **Intelligence target** | Reality-Tracking / Z.ai-style epistemic report on Movement tab |
| **Baseline Product Intelligence Score** | 2 (Inspectable — after data-path fix; presentation/route issues observed) |
| **Chapter** | `CHAPTER-INSPECTOR-001` (target 2 → 3) |
| **Target score** | 3 (Coherent) |

### Known prior issues (history)

| Issue | Status |
|-------|--------|
| Data existed but was not fetched (movement-only evidence endpoint) | Fixed — affected-object merge |
| Generic evidence cards (`Related pattern` / `Linked evidence`) | Fixed Slice A — verify on golden object |
| Legacy `/patterns` route leak on evidence click | Fixed Slice B — verify on golden object |
| `Reference item · Reference item` on Movement tab | Fixed Slice A — verify on golden object |
| Weak human-readable synthesis (tab overlap, raw dump feel) | Partial — needs Kay scorecard |
| Inspector back / object history after drill-down | Open — INSPECTOR-002 |

### Passing gates (update after each accepted slice)

| Gate ID | Description | Last PASS |
|---------|-------------|-----------|
| G1 | Receipt count > 0 on Evidence tab | {date / slice} |
| G2 | Related map conclusion block visible | {date / slice} |
| G3 | Evidence cards show meaningful titles (not generic dump) | {pending Kay} |
| G4 | Evidence click stays in workbench inspector | {pending Kay} |
| G5 | Movement tab has no placeholder ref spam | {pending Kay} |
| G6 | Facts / inference / uncertainty separated on Movement tab | {pending Kay} |

### Data-path proof commands

```bash
# Requires local DB with user-visible records
# Movement detail: GET /api/what-changed/cmq6h8ewn0000qlbwlg485jx1
# Conclusion evidence: GET /api/user-map/conclusions/cmq6frqdx0000ql8h6nkavzue/evidence
```

---

## Adding a golden object

1. Assign `GOLDEN-{DOMAIN}-{NNN}` id.
2. Pin stable record ids from real backend data.
3. Document reference surface + intelligence target.
4. Seed **Known prior issues** and **Passing gates** tables.
5. Link from affected slices in `slice-queue.md`.
