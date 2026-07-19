# 02 — Read-only candidate shortlist

Exactly **three** safe `ReferenceItem` candidates. Kay chooses one later. **No selection performed by the agent. No mutation.**

Before-state counts at shortlist time: pending **54** (RI **29** + CN **25**); PatternClaims **7**; active ReferenceItems **0**.

Import batch (sole completed): `cmp2ftxhj0000qlsyxi55jo20`

---

## Candidate A — Chicken vs beef burgers (lowest risk)

| Field | Value |
|-------|-------|
| Candidate title | I think prefer chicken burgers to beef burgers |
| Plain-English claim | Kay prefers chicken burgers over beef burgers. |
| Supporting source excerpt | `I think prefer chicken burgers to beef burgers 😳` |
| Conversation ID (MindLab session) | `7dd386eb-e6ba-493a-856d-fc8815895248` |
| Conversation label | Revealing life-changing news |
| ChatGPT external conversation ID | `6941704f-1ef8-8326-957f-2aeab6ae089a` |
| Source message ID | `d1060934-f19d-4693-b255-d23570af50e1` |
| Import batch ID | `cmp2ftxhj0000qlsyxi55jo20` |
| ReferenceItem database ID | `3a6163dd-0f85-4bf5-8eb8-924579f1db62` |
| Encoded review key | `reference_item:3a6163dd-0f85-4bf5-8eb8-924579f1db62` |
| Current status | `candidate` |
| Type | `preference` |
| Confidence | `low` |
| Why clearly accurate | Statement is a near-verbatim copy of the sole user source message. |
| Duplicate-check result | **PASS** — no overlapping active ReferenceItem, PatternClaim, UserMap conclusion, ContradictionNode, or ModelUpdate |
| Expected DB change after accept | Same row → `status=active`; no new RI row; no UEL; no ModelUpdate |
| Exact provider | `fetchMindContextSnapshot` → `/api/reference/list?status=active` → `buildMindContextDisplayItems(..., 3)` |
| Exact visible surface | **Map → Background / Context** rail; Inspector when selected |
| What should not change | Other 53 pending statuses; PatternClaims (7); UserMap; existing ModelUpdate; no Today/Timeline appearance |

---

## Candidate B — Tuxedo preference

| Field | Value |
|-------|-------|
| Candidate title | I like tuxedos without the bow tie and top 2 buttons unpopped |
| Plain-English claim | Kay prefers tuxedos worn without a bow tie, with the top two buttons undone. |
| Supporting source excerpt | `I’m trying to work out something, I like tuxedos when it’s without the bow tie and the top 2 buttons are unpopped` |
| Conversation ID (MindLab session) | `88e30e1e-0859-41ad-be6c-dc42992e4be5` |
| Conversation label | Fashion identity breakdown |
| ChatGPT external conversation ID | `6936331b-0778-8329-b34f-6cb9f024b41f` |
| Source message ID | `35352c48-48ed-4073-bf00-aed96e9251e8` |
| Import batch ID | `cmp2ftxhj0000qlsyxi55jo20` |
| ReferenceItem database ID | `9195acb3-3976-493b-a009-8b498fcb156b` |
| Encoded review key | `reference_item:9195acb3-3976-493b-a009-8b498fcb156b` |
| Current status | `candidate` |
| Type | `preference` |
| Confidence | `low` |
| Why clearly accurate | Source message states the preference explicitly; candidate statement matches. |
| Duplicate-check result | **PASS** — no durable duplicate found |
| Expected DB change after accept | Same row → `status=active`; no new RI; no UEL; no ModelUpdate |
| Exact provider | mind-context / reference list (same path as A) |
| Exact visible surface | **Map → Background / Context** rail; Inspector when selected |
| What should not change | Same as Candidate A |

---

## Candidate C — Afro Diaspora Network / ADN naming preference

| Field | Value |
|-------|-------|
| Candidate title | Likes the name Afro Diaspora Network mainly for the acronym ADN |
| Plain-English claim | Kay likes the movement name “Afro Diaspora Network” chiefly because the acronym ADN sounds good; the full phrase feels less catchy but modern. |
| Supporting source excerpt | `I really like the name for a movement, Afro Diaspora Network, but I really like it because I like the acronym ADN it's got a ring but Afro Diaspora Network doesn't have a ring but it's modern and new` |
| Conversation ID (MindLab session) | `bed328fc-5648-496c-a34e-f0e1ef8039c2` |
| Conversation label | Afro Diaspora Name Ideas |
| ChatGPT external conversation ID | `693053b9-f99c-8329-a726-d07ed68494de` |
| Source message ID | `277f5f0c-d13e-432a-9d94-bccf4bd38b20` |
| Import batch ID | `cmp2ftxhj0000qlsyxi55jo20` |
| ReferenceItem database ID | `8f47cb85-26cc-4363-9154-61ba39c2200c` |
| Encoded review key | `reference_item:8f47cb85-26cc-4363-9154-61ba39c2200c` |
| Current status | `candidate` |
| Type | `preference` |
| Confidence | `low` |
| Why clearly accurate | Candidate text is essentially the full user message. |
| Duplicate-check result | **PASS** — no durable duplicate found |
| Expected DB change after accept | Same row → `status=active`; no new RI; no UEL; no ModelUpdate |
| Exact provider | mind-context / reference list (same path as A) |
| Exact visible surface | **Map → Background / Context** rail; Inspector when selected |
| What should not change | Same as Candidate A |

---

## Shortlist rationale

- All three are `preference` ReferenceItems (not ContradictionNodes).
- All pass the mind-context quality gate.
- All are low-sensitivity / non-intimate.
- Source support ratio = 1.0 (statement words grounded in source message).
- Active ReferenceItem count is currently **0**, so after accept the new `updatedAt` should place the item in Map’s combined top-3 context rail (alongside PatternClaims).
- None selected on Kay’s behalf.
