# 37 — Full-reference round-trip: Kay human PASS

Campaign: `DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001`
Date: `2026-07-18`

## Human verdict

**FULL REFERENCE ROUND-TRIP — HUMAN PASS WITH MINOR DEVIATIONS**

Kay completed human review of `/dev/orvek-v0-canonical-live` against `/dev/orvek-v0-reference` under the full-reference round-trip seed.

## Confirmed by Kay

- Full populated reference model renders through production persistence.
- Canonical live presentation is approximately **90%+** equivalent to the frozen reference.
- Remaining observed differences are **minor and non-blocking**.
- Import review opens and works.
- Global Map summary matches:
  - `243 receipts`
  - `7 open questions`
- Model movement status card matches:
  - `Model moved · 4 places`
  - `7 questions · 3 reviews open`
- Map destination from the status card works.
- No remaining material blocker identified by Kay.

## What this proves

This campaign proves that **production can represent and display the complete canonical reference model** end-to-end:

```
full-reference seed → production persistence
  → production query/API
  → live/hybrid provider
  → canonical presentation
```

## What this does not prove

- It does **not** prove automatic generation of that model from ChatGPT imports.
- Automatic import materialisation is the **next separate campaign**.
- Known dead controls inherited from the frozen reference (e.g. Import Accept/Reject local-only visual state; Escape not wired on OverlayShell) remain **outside** this campaign — see `34-import-review-interaction.md`.
- Minor visual/UX deviations remain; they are **not blocking** this foundation acceptance.

## Supporting automated receipts (pre-human)

| Receipt | Topic |
|---|---|
| `33-full-reference-inventory.md` / `33-full-reference-browser-verify.json` | Full workbench rails + densograph seed |
| `34-import-review-interaction.md` / `34-import-review-verify.json` | Import overlay enablement |
| `35-map-header-verify.json` | Map global summary 243 / 7 |
| `36-model-status-verify.json` | TopBar model-status card |

## Seed note

Full-reference seed for Kay’s review users was **not** cleaned as part of this closeout. Leave in place until a separate cleanup step is requested.

## Next exact step

1. Commit this campaign branch (human PASS recorded).
2. Separate campaign: automatic import materialisation from ChatGPT imports.
