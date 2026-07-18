# 00 — Intake and boundaries

Campaign: `CHATGPT-IMPORT-MATERIALISATION-AUDIT-001`  
Date: `2026-07-18`  
Baseline: `staging @ 7eb7792`  
Worktree: `desktop-chatgpt-import-materialisation-audit-001`  
Mode: **read-only audit** — no commits, pushes, PRs, merges, product behaviour changes, or data mutation.

## Product frame

MindLab / Orvek is an evidence-backed personal understanding engine (`capture → reveal → understand`).  
This audit asks whether Kay’s previously imported ChatGPT archive was automatically extrapolated into the current canonical model and surfaces — not whether a new upload UI exists.

## Capability separation (enforced)

| Code | Capability | In scope? |
|------|------------|-----------|
| A | Archive ingestion (upload → parse → persist conversations/messages) | Inventory only |
| B | Archive intelligence / materialisation | **Primary** |
| C | Candidate review | Inventory + boundary vs shell Import |
| D | Future canonical ChatGPT-export upload UX | Out of scope (do not build) |

## Explicit non-goals

- Do not run a fresh ChatGPT export upload.
- Do not reconnect or rebuild the historical uploader UI.
- Do not treat missing current-shell upload UX as the materialisation root cause.
- Do not delete, clean, or mutate Kay’s data.
- Do not count full-reference seed objects as successful archive extrapolation.
- Do not claim Orvek “understands” Kay merely because raw conversations exist.

## Account under audit

- Clerk userId: `user_34TUYA53pI1QRLK73O22Kve1a1G` (Kay’s campaign account across prior production-path receipts)
- Persistence queried via `DATABASE_URL` from `/Users/user/ai-companion/.env` → host `localhost:5432`
- Classification: this is the same persisted account store used for prior production-path browser campaigns (full-reference seed, import-review proofs). It is **not** a synthetic empty fixture DB.

## Data-boundary warning

Kay’s account currently contains **both**:

1. Historical ChatGPT archive (May 2026 import)
2. Full-reference round-trip seed (`source=full_reference_round_trip_seed`, prefix `dev-exact-rt-`)

Native APP captures: **3 sessions / 44 messages** (fewer than five ordinary native captures with content: one explore session has messages; two empty).

## Handoff fields

- **PHASE:** Existing ChatGPT archive materialisation audit  
- **SLICE:** Receipts under `docs/agent-runs/receipts/CHATGPT-IMPORT-MATERIALISATION-AUDIT-001/` + read-only audit scripts  
- **ALLOWED:** Read code/schema; read-only DB queries; write audit receipts/scripts  
- **FORBIDDEN:** Product code changes; schema/route changes; data mutation; upload UI work; commits  
- **VERIFICATION:** Receipt completeness; counts reproducible via `audit-readonly-counts.mjs`  
- **CONTEXT:** Prior campaign proved persistence→presentation round-trip for seeded canonical model; did **not** prove automatic extrapolation from imported ChatGPT archive
