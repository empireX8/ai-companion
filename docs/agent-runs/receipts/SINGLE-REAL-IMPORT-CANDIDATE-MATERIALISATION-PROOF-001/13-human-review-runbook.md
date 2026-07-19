# 13 — Human review runbook

## Exact browser steps

1. Sign in as Kay on the **canonical live** Orvek desktop workbench at `http://localhost:3000/your-map` (hard-refresh).
2. Confirm the live shell is active (not frozen `/dev` reference fixture).
3. In the left rails, open **Background / Context**.
4. Confirm there is **exactly one** rail entry titled **Preferences / interests** (section count must remain 5, not 6).
5. Select that single **Preferences / interests** entry.
6. Confirm the centre panel still shows the original **Current understanding** summary:
   > Private intelligence, systems architecture, AI workflows, decision clarity, philosophy, performance.
7. Confirm **KNOWN PREFERENCES** appears beneath that summary and includes:
   > I think prefer chicken burgers to beef burgers 😳
8. Confirm fact meta shows type / confidence / provenance only — no implementation-facing placeholder copy.
9. Confirm the fact is **not** presented as a ModelUpdate.

## Pass criteria

- Exactly one Preferences / interests rail entry
- Original summary preserved
- Accepted statement visible under **KNOWN PREFERENCES** on the real `/your-map` route
- No duplicate section or duplicate fact

## Fail criteria

- Two Preferences / interests entries
- Implementation copy such as “Accepted profile facts for this area appear below…”
- Statement missing on `/your-map` (even if unit attach tests pass)
- Statement presented as ModelUpdate
