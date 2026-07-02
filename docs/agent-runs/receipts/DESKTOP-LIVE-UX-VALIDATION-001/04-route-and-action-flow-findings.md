# Route And Action Flow Findings

## Navigation shell

- Left-nav items were reported as routing to the intended top-level pages.
- The primary route failures are page-level actions, cards, and back paths rather than the shell nav itself.

## Today action routing

| Entry point | Observed behavior | Result |
|---|---|---|
| `Add what happened` | Opens the same generic capture page used by other capture actions | FAIL |
| `Capture new signal` | Routes to the same singular capture input as `Add what happened` | FAIL |
| `Review outcome` | Opens Decisions, but does not support a real outcome review flow | FAIL |
| `Add outcome` | Marks an outcome as recorded without first collecting the outcome | FAIL |
| Decision cards | Can open the wrong decision object | FAIL |
| Fieldwork action | Routes into an unclear Watch For / Fieldwork page | FAIL |

## Decisions flow

| Action | Observed behavior | Result |
|---|---|---|
| `Talk it through` | Dead or non-responsive | FAIL |
| `Compare options` | Dead or non-responsive | FAIL |
| `Add outcome` | Dead or fake-completes without input | FAIL |
| `Review due decision` | Dead or non-responsive | FAIL |

## Watch For / Fieldwork routing

- Watch For exists as a route, but is not clearly discoverable from navigation.
- Fieldwork actions can land on Watch For pages that feel outside the intended shell contract.
- Back behavior is confusing and can lead to another Watch For page rather than the previous context.
- Observation language does not cleanly distinguish instruction, what to notice, and what is being tested.

## Explore and timeline route continuity

- Explore loads, but some model-review affordances did not open or resolve correctly.
- Timeline loads, but object-level continuity back into evidence/model surfaces still needs repair.

