# Wiring Matrix — {SLICE_ID}

**Date:** {YYYY-MM-DD}

| Section / behavior | Route / API | Key fields | Component | Data status | Risk |
|--------------------|-------------|------------|-----------|-------------|------|
| {e.g. Supporting evidence} | `{GET .../evidence}` | `objectTitle`, `sourceId` | `EvidenceLinksSection` | {exists / fetched / not joined} | {label generic} |

---

## Data-path proof plan

| Check | Command / query | Expected |
|-------|-----------------|----------|
| {acceptance record loads} | {prisma or curl} | {count > 0} |

---

## Reuse map

| Existing component | Reuse for |
|--------------------|-----------|
| {UserMapEvidencePanel section} | {model update evidence tab} |

---

## Out of matrix (explicitly not wired this slice)

- {item}

**Implementation may start:** {yes | blocked — missing spec approval}
