# 07 — Human acceptance runbook (Candidate A only)

## Purpose

Kay manually accepts **one** locked genuine import candidate so after-state verification can prove materialisation on a real account.

Agent / Cursor must **not** click Accept and must **not** call the review API.

---

## Exact UI identification text

Find the card that shows **all** of the following:

1. Under **Their words**:
   > “I think prefer chicken burgers to beef burgers 😳”
2. Proposed line (same preference text):
   > I think prefer chicken burgers to beef burgers 😳
3. Metadata line including:
   - `Source table: ReferenceItem`
   - `Type: preference`
   - `Provenance: import_derived_session`
   - `Status: candidate`
   - `Conversation: 7dd386eb-e6…`
   - `Message: d1060934-f1…`
   - `Import batch: cmp2ftxhj00…`
4. Confidence chip: **low confidence**

List position: about **#29** in the Import list (scroll within the first page of pending candidates). Modal subtitle should still report **54 pending** before the click.

**Do not** accept any neighbouring card (e.g. “peek body nutrition” or “finish this book”).

---

## Browser steps

1. Sign in as Kay on the canonical Orvek desktop workbench (production/live Import path — not `/dev` frozen reference fixture).
2. Open the **Import** control in the top bar so the overlay titled **Review import** appears.
3. Confirm subtitle roughly: **54 pending import candidates — not yet in your model**.
4. Scroll to the chicken-burger card using the identification text above.
5. On **that card only**, click **Accept**.
6. **Do not** click **Reject**.
7. **Do not** click **Keep as receipt only** (that control is the reject path in this UI).
8. **Do not** process any other candidate.
9. **Stop immediately** after the one acceptance (you may close the overlay with Close / Save for later — do not accept further cards).

---

## Exact post-click verification command

Run from the worktree with Kay’s DB URL loaded:

```bash
cd /Users/user/ai-companion-worktrees/desktop-single-real-import-materialisation-proof-001
set -a && source .env && set +a
node docs/agent-runs/receipts/SINGLE-REAL-IMPORT-CANDIDATE-MATERIALISATION-PROOF-001/readonly-selected-candidate-after-state.mjs \
  --candidate reference_item:3a6163dd-0f85-4bf5-8eb8-924579f1db62
```

Expected script verdict on success:

`PASS_GENUINE_REFERENCEITEM_ACCEPTANCE_MATERIALISED`

Output file:

`docs/agent-runs/receipts/SINGLE-REAL-IMPORT-CANDIDATE-MATERIALISATION-PROOF-001/readonly-selected-candidate-after-state.json`

---

## What success means (minimum)

- Same id active; pending 54→53; RI pending 29→28; CN pending 25; PatternClaims 7
- Active reference list contains this id; Map context provider can receive it
- **No** ModelUpdate / UEL claimed for this ReferenceItem accept

## What this runbook does not do

- Does not instruct bulk review
- Does not claim production readiness
- Does not treat isolated unit tests as genuine-account proof
