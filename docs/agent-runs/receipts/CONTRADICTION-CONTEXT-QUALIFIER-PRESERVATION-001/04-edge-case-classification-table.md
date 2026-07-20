# 04 — Edge-case classification table

All cases use injected fake model runners. PASS means the contract test asserts the expected preservation / classification / fail-closed behaviour.

| # | Side A | Side B | Material qualifiers | Expected class | Disqualifying reason for Class A | Test name | Result |
|---|--------|--------|---------------------|----------------|----------------------------------|-----------|--------|
| 1 | I never drink alcohol. | I drank alcohol last night. | universal never vs last-night episode | clear_contradiction | none (positive control) | `1. CLEAR CONTRADICTION — positive control remains valid` | PASS |
| 2 | I need to review after I read to retain. | I did review it after every read, but I did not do the question exercises. | partial compliance; review done; drills omitted | B or C | partial compliance / goalVersusObstacle | `2. PARTIAL COMPLIANCE — controlling stop condition never Class A` | PASS |
| 3 | I usually avoid sugar. | I ate cake once at a birthday. | usually + isolated birthday | C (not A) | frequency / exception | `3. FREQUENCY QUALIFIER — usually vs once not Class A` | PASS |
| 4 | I never eat sugar. | I ate cake yesterday. | universal never vs yesterday | may be A | none when scopes align | `4. UNIVERSAL CLAIM CONTROL — never vs yesterday may remain Class A` | PASS |
| 5 | I used to go out every weekend. | At the moment I barely socialise. | past habit vs present phase | C + changedBeliefOverTime | temporal change | `5. TEMPORAL CHANGE — used to / at the moment not Class A` | PASS |
| 6 | I'm in an exhausted phase at the moment. | I am normally highly energetic. | present phase vs baseline normally | compatible_states | phase vs baseline | `6. CURRENT PHASE QUALIFIER — exhausted phase vs normal energy` | PASS |
| 7 | I want to exercise every day. | I missed yesterday. | want vs isolated miss | B + intentionVersusOutcome | intention ≠ outcome | `7. INTENTION VERSUS OUTCOME — want vs missed once` | PASS |
| 8 | I should read every evening. | I did not read last night. | should modality vs one night | B (tension) | obligation ≠ truth-value contradiction | `8. OBLIGATION VERSUS ACTION — should vs did not` | PASS |
| 9 | I try to stay calm during disagreements. | I raised my voice once. | try + once | C (not auto A) | attempt ≠ guarantee | `9. ATTEMPT VERSUS GUARANTEE — try vs once raised voice` | PASS |
| 10 | I avoid driving when I'm tired. | I drove to the shop after sleeping well. | when tired condition | compatible_states | condition not met on B | `10. CONDITION — when tired vs after sleeping well` | PASS |
| 11 | I struggle to speak in formal meetings. | I talk easily with close friends. | formal meetings vs close friends | compatible_states | scope mismatch | `11. SCOPE DIFFERENCE — formal meetings vs close friends` | PASS |
| 12 | objectivity always optimise… | identity-trigger sensations; not reactive; exhaustive phase | not reactive; phase; somatic vs standard | compatible_states + emotionalOrPhysiological… | sensation ≠ abandoned standard | `12. SOMATIC RESPONSE VERSUS REASONING — not reactive preserved` | PASS |
| 13 | My brother says I hate networking. | I enjoy networking. | attributed speech | C (not A) | attribution ≠ speaker claim | `13. ATTRIBUTED SPEECH — brother says vs speaker enjoys` | PASS |
| 14 | I think I may prefer working alone. | I enjoy collaborating on some projects. | think/may + some projects | C (not A) | uncertainty + limited scope | `14. UNCERTAINTY — think I may prefer vs some projects` | PASS |
| 15 | I do not drink except on special occasions. | I had champagne at a wedding. | exception: special occasions | compatible_states | exception covers wedding | `15. EXPLICIT EXCEPTION — except special occasions vs wedding champagne` | PASS |
| 16 | I'm not saying I never want help. | I asked for help yesterday. | nested negation | C or D | do not flatten to never-want-help | `16. NESTED NEGATION — not saying never want help` | PASS |
| 17 | (fake) Class A + bothCanSimultaneouslyBeTrue | — | inconsistent flags | validation_failed | internal inconsistency A | `17. INTERNAL INCONSISTENCY — Class A + bothCanSimultaneouslyBeTrue` | PASS |
| 18 | (fake) Class A + goalVersusObstacle | — | inconsistent flags | validation_failed | internal inconsistency D | `18. INTERNAL INCONSISTENCY — Class A + goalVersusObstacle` | PASS |
| 19 | (fake) Class A + abstentionReason | — | abstention conflict | validation_failed | gates F/G | `19. INTERNAL INCONSISTENCY — classification + abstentionReason` | PASS |
| 20 | Someone said something about networking. | Networking is fine sometimes. | unsafe attribution | abstained (null class) | cannot preserve safely | `20. VALID ABSTENTION — cannot safely preserve actor/scope/attribution` | PASS |
| 21 | I usually avoid sugar. | I ate cake once at a birthday. | qualifier quote provenance | pass / fail closed | fabricated/invalid/wrong-side | `21. EXACT EVIDENCE PROVENANCE — quote/offset/side still fail closed` | PASS |
| 22 | runtime paths | — | structural boundary | no imports | — | `22. STRUCTURAL BOUNDARY — no new adjudicator/kernel imports on runtime paths` | PASS |

**Controlling stop condition verified:** case 2 never Class A.
