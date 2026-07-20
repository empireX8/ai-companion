/**
 * CEQR-001 — model-assisted contradiction adjudication contract tests.
 * Injected fake model runners only; no live provider calls.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import {
  adjudicateContradiction,
  classificationAllowsContradictionNodeSemantics,
  classificationIsNonContradictionNode,
  CONTRADICTION_ADJUDICATION_PROMPT_VERSION,
  CONTRADICTION_ADJUDICATION_SCHEMA_VERSION,
  isPersistenceEligibleInCeqr001,
  KERNEL_CONTRACT_VERSION,
  KERNEL_FIRST_PROOF_OBJECT,
  type ContradictionAdjudicationResult,
  type ContradictionModelResult,
} from "../contradiction-adjudicator";
import {
  claimForSubstring,
  OBJECTIVITY_REFEREE_OUTCOMES,
  type KernelSourceUnit,
  type ObjectivityReferee,
  type StructuredModelRunner,
} from "../orvek-intelligence-kernel";

const FIXED_NOW = () => new Date("2026-07-20T12:00:00.000Z");

function source(
  partial: Partial<KernelSourceUnit> &
    Pick<KernelSourceUnit, "sourceId" | "sourceText" | "label">,
): KernelSourceUnit {
  return {
    sessionId: partial.sessionId ?? `session-${partial.sourceId}`,
    messageId: partial.messageId ?? `message-${partial.sourceId}`,
    sourceRole: partial.sourceRole ?? "user",
    sourceType: partial.sourceType,
    existingObjectId: partial.existingObjectId ?? null,
    ...partial,
  };
}

function baseModelResult(
  sideA: KernelSourceUnit,
  sideB: KernelSourceUnit,
  overrides: Partial<ContradictionModelResult> & {
    quoteA?: string;
    quoteB?: string;
  } = {},
): ContradictionModelResult {
  const quoteA = overrides.quoteA ?? sideA.sourceText;
  const quoteB = overrides.quoteB ?? sideB.sourceText;
  const claimA =
    overrides.evidenceClaimA ??
    claimForSubstring(sideA, quoteA) ??
    {
      sourceId: sideA.sourceId,
      exactQuote: quoteA,
      startOffset: 0,
      endOffset: quoteA.length,
    };
  const claimB =
    overrides.evidenceClaimB ??
    claimForSubstring(sideB, quoteB) ??
    {
      sourceId: sideB.sourceId,
      exactQuote: quoteB,
      startOffset: 0,
      endOffset: quoteB.length,
    };

  const {
    quoteA: _qa,
    quoteB: _qb,
    evidenceClaimA: _ea,
    evidenceClaimB: _eb,
    ...rest
  } = overrides;

  return {
    propositionA: {
      normalizedProposition: "Proposition A",
      actor: "speaker",
      subject: "alcohol",
      timeframe: "general / recent",
      negation: true,
      modality: "assertive",
      qualifications: "none",
    },
    propositionB: {
      normalizedProposition: "Proposition B",
      actor: "speaker",
      subject: "alcohol",
      timeframe: "last night",
      negation: false,
      modality: "assertive",
      qualifications: "none",
    },
    contextAndScope: "same speaker, overlapping lifestyle scope",
    bothCanSimultaneouslyBeTrue: false,
    changedBeliefOverTime: false,
    intentionVersusOutcome: false,
    goalVersusObstacle: false,
    emotionalOrPhysiologicalVersusReasoningStandard: false,
    classification: "clear_contradiction",
    confidence: 0.86,
    evidenceClaimA: claimA,
    evidenceClaimB: claimB,
    rationale: "Incompatible propositions under same actor and modality.",
    alternativeInterpretation: "Temporal change if scopes differ.",
    whatWouldChangeClassification: "Explicit time-scoped belief change.",
    abstentionReason: null,
    proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
    ...rest,
  };
}

function fakeRunner(
  result:
    | ContradictionModelResult
    | unknown
    | (() => ContradictionModelResult | unknown),
): StructuredModelRunner {
  return {
    async runStructured() {
      const object = typeof result === "function" ? result() : result;
      return {
        ok: true as const,
        object: object as ContradictionModelResult,
        providerId: "test-fake",
        modelId: "test-fake-model",
        rawText: null,
      };
    },
  };
}

function failingRunner(
  errorCode: "model_execution_failed" | "model_timeout" = "model_execution_failed",
  message = "simulated failure",
): StructuredModelRunner {
  return {
    async runStructured() {
      return {
        ok: false as const,
        errorCode,
        message,
        providerId: "test-fake",
        modelId: "test-fake-model",
      };
    },
  };
}

function assertNoPersistenceDecision(result: ContradictionAdjudicationResult) {
  expect(result.persistenceDecision).toBeNull();
  expect(result.createCandidate).toBeUndefined();
  expect(isPersistenceEligibleInCeqr001(result)).toBe(false);
  expect(Object.prototype.hasOwnProperty.call(result, "createCandidate")).toBe(
    true,
  );
  // Model must not author eligibility; envelope keeps createCandidate undefined.
  expect(result).not.toHaveProperty("createCandidate", true);
}

describe("CEQR-001 contradiction adjudication contract", () => {
  it("A. CLEAR CONTRADICTION — semantic accept, referee not_run, no persistence", async () => {
    const sideA = source({
      sourceId: "src-a-alcohol",
      label: "Side A",
      sourceText: "I never drink alcohol.",
    });
    const sideB = source({
      sourceId: "src-b-alcohol",
      label: "Side B",
      sourceText: "I drank alcohol last night.",
      sessionId: sideA.sessionId,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          propositionA: {
            normalizedProposition: "Speaker never drinks alcohol",
            actor: "speaker",
            subject: "alcohol consumption",
            timeframe: "habitual/always",
            negation: true,
            modality: "never",
            qualifications: "none",
          },
          propositionB: {
            normalizedProposition: "Speaker drank alcohol last night",
            actor: "speaker",
            subject: "alcohol consumption",
            timeframe: "last night",
            negation: false,
            modality: "assertive",
            qualifications: "none",
          },
          bothCanSimultaneouslyBeTrue: false,
          classification: "clear_contradiction",
          confidence: 0.91,
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("semantic_accepted");
    expect(result.semantic?.classification).toBe("clear_contradiction");
    expect(result.validation.status).toBe("valid");
    expect(result.refereeStatus).toBe("not_run");
    expect(result.audit.refereeStatus).toBe("not_run");
    expect(result.semantic?.evidenceClaimA.exactQuote).toBe(
      "I never drink alcohol.",
    );
    expect(result.semantic?.evidenceClaimB.exactQuote).toBe(
      "I drank alcohol last night.",
    );
    assertNoPersistenceDecision(result);
    expect(classificationAllowsContradictionNodeSemantics("clear_contradiction")).toBe(
      true,
    );
  });

  it("B. COMPATIBLE STATE — objectivity / somatic identity-trigger near-miss", async () => {
    const sideA = source({
      sourceId: "src-objectivity",
      label: "Objectivity stance",
      sessionId: "eba90c59-7f62-42b5-8f8e-2572d6b5ec80",
      messageId: "a6aa2fb5-3a0f-4c86-94f5-45ced37132d2",
      sourceText:
        "I'm just having fun I don't really care that much although I always optimise for objectivity regardless of what mode I'm operating in",
      sourceType: "constraint",
    });
    const sideB = source({
      sourceId: "src-somatic",
      label: "Identity-trigger sensations",
      sessionId: "68c4f65a-3ce1-4848-b905-8f63dc3555ab",
      messageId: "f4433e90-ec86-4d6a-ac79-7e8225bfb598",
      sourceText:
        "I swear I feel like I can literally feel my brain like bubbling when I see something that starts to trigger my identity. I'm in a exhaustive faze at the moment and when I see something identity weaponed I'm not reactive but I also don't dwell on it enough to let it sit too much but I can literally feel like sensations in my brain bubbling like it's weird lol",
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          propositionA: {
            normalizedProposition:
              "Speaker attempts to optimise for objectivity across modes",
            actor: "speaker",
            subject: "objectivity standard",
            timeframe: "ongoing",
            negation: false,
            modality: "always / optimise",
            qualifications: "coexists with having fun / not caring much",
          },
          propositionB: {
            normalizedProposition:
              "Speaker experiences involuntary identity-trigger sensations while remaining non-reactive",
            actor: "speaker",
            subject: "identity-trigger somatic response",
            timeframe: "present exhaustive phase",
            negation: false,
            modality: "descriptive sensation",
            qualifications: "not reactive; does not dwell",
          },
          contextAndScope: "cross-session; reasoning standard vs somatic response",
          bothCanSimultaneouslyBeTrue: true,
          emotionalOrPhysiologicalVersusReasoningStandard: true,
          classification: "compatible_states",
          confidence: 0.88,
          rationale:
            "Objectivity stance can coexist with involuntary sensations; Side B denies reactivity.",
          alternativeInterpretation: "Forced as constraint violation via 'but I' marker — incorrect.",
          whatWouldChangeClassification:
            "Same-episode admission of abandoning objectivity due to identity reactivity.",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("semantic_accepted");
    expect(result.semantic?.classification).toBe("compatible_states");
    expect(
      classificationIsNonContradictionNode("compatible_states"),
    ).toBe(true);
    expect(result.semantic?.emotionalOrPhysiologicalVersusReasoningStandard).toBe(
      true,
    );
    assertNoPersistenceDecision(result);
    expect(result.refereeStatus).toBe("not_run");
  });

  it("C. GOAL VERSUS OBSTACLE — never clear_contradiction merely because goal is difficult", async () => {
    const sideA = source({
      sourceId: "src-goal-review",
      label: "Review goal",
      sourceText: "I need to review after i read to retain though",
      sessionId: "du-bois-session",
    });
    const sideB = source({
      sourceId: "src-du-bois-obstacle",
      label: "Du Bois dense-book struggle",
      sessionId: "du-bois-session",
      sourceText:
        "I wanna ask, like, am I just wasting my time reading this book, because it's so definition dense, I can't really remember anything, like. I'm scared to go and do this kind of thing for, um, the reconstruction of America, Du Bois book, like. Because I didn't even, like, I did review it after every read, but I didn't, like, even do this question stuff, like.",
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          propositionA: {
            normalizedProposition: "Need to review after reading to retain",
            actor: "speaker",
            subject: "reading retention",
            timeframe: "ongoing practice",
            negation: false,
            modality: "need / goal",
            qualifications: "none",
          },
          propositionB: {
            normalizedProposition:
              "Dense Du Bois reading is hard to retain; did review but skipped question drills",
            actor: "speaker",
            subject: "reading retention / Du Bois",
            timeframe: "recent study episode",
            negation: false,
            modality: "struggle / partial compliance",
            qualifications: "I did review it after every read",
          },
          bothCanSimultaneouslyBeTrue: true,
          goalVersusObstacle: true,
          classification: "plausible_unresolved_tension",
          confidence: 0.72,
          rationale:
            "Goal plus retention obstacle with partial compliance — tension, not simultaneous contradiction.",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.semantic?.classification).not.toBe("clear_contradiction");
    expect(["plausible_unresolved_tension", "compatible_states"]).toContain(
      result.semantic?.classification,
    );
    expect(result.semantic?.goalVersusObstacle).toBe(true);
    assertNoPersistenceDecision(result);
  });

  it("D. INTENTION VERSUS OUTCOME IN PROGRESS — not automatic clear contradiction", async () => {
    const sideA = source({
      sourceId: "src-intent",
      label: "Intention",
      sourceText: "I intend to finish the draft this week.",
    });
    const sideB = source({
      sourceId: "src-outcome",
      label: "In progress",
      sourceText: "I have not finished the draft yet; still working on it.",
      sessionId: sideA.sessionId,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          intentionVersusOutcome: true,
          bothCanSimultaneouslyBeTrue: true,
          classification: "plausible_unresolved_tension",
          confidence: 0.64,
          rationale: "Intention with incomplete outcome in progress.",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.semantic?.classification).not.toBe("clear_contradiction");
    expect(result.semantic?.intentionVersusOutcome).toBe(true);
    assertNoPersistenceDecision(result);
  });

  it("E. CHANGE OVER TIME — used to / now is not simultaneous contradiction", async () => {
    const sideA = source({
      sourceId: "src-past",
      label: "Past belief",
      sourceText: "I used to believe X.",
    });
    const sideB = source({
      sourceId: "src-now",
      label: "Present belief",
      sourceText: "I do not believe X now.",
      sessionId: sideA.sessionId,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          changedBeliefOverTime: true,
          bothCanSimultaneouslyBeTrue: true,
          classification: "compatible_states",
          confidence: 0.9,
          rationale: "Temporal belief change, not simultaneous conflict.",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.semantic?.classification).not.toBe("clear_contradiction");
    expect(["compatible_states", "plausible_unresolved_tension"]).toContain(
      result.semantic?.classification,
    );
    expect(result.semantic?.changedBeliefOverTime).toBe(true);
  });

  it("F. RHETORICAL MARKER — 'but I mean' without incompatible propositions", async () => {
    const sideA = source({
      sourceId: "src-rhetorical-a",
      label: "A",
      sourceText: "The plan is fine overall.",
    });
    const sideB = source({
      sourceId: "src-rhetorical-b",
      label: "B",
      sourceText: "Yeah, but I mean, the tone was unexpected.",
      sessionId: sideA.sessionId,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          classification: "compatible_states",
          confidence: 0.7,
          rationale: "Rhetorical 'but I mean' without proposition conflict.",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(["compatible_states", "insufficient_or_misaligned_context"]).toContain(
      result.semantic?.classification,
    );
    assertNoPersistenceDecision(result);
  });

  it("G. DIFFERENT SUBJECT OR SCOPE", async () => {
    const sideA = source({
      sourceId: "src-scope-a",
      label: "Work",
      sourceText: "At work I never drink caffeine.",
      sessionId: "session-work",
    });
    const sideB = source({
      sourceId: "src-scope-b",
      label: "Gym",
      sourceText: "At the gym I drank an energy drink.",
      sessionId: "session-gym",
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          classification: "insufficient_or_misaligned_context",
          confidence: 0.8,
          bothCanSimultaneouslyBeTrue: true,
          rationale: "Different scopes/subjects; do not force pairing.",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(["insufficient_or_misaligned_context", "compatible_states"]).toContain(
      result.semantic?.classification,
    );
  });

  it("H. PARTIAL COMPLIANCE / QUALIFIER PRESERVATION", async () => {
    const sideA = source({
      sourceId: "src-qual-a",
      label: "Goal",
      sourceText: "I will review after every read.",
    });
    const sideB = source({
      sourceId: "src-qual-b",
      label: "Partial",
      sourceText:
        "I did review it after every read, but I didn't even do this question stuff.",
      sessionId: sideA.sessionId,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          classification: "plausible_unresolved_tension",
          confidence: 0.68,
          propositionB: {
            normalizedProposition: "Reviewed after reads; skipped question drills",
            actor: "speaker",
            subject: "review practice",
            timeframe: "recent",
            negation: false,
            modality: "partial",
            qualifications: "did review; did not do question stuff",
          },
          rationale: "Partial compliance preserved — tension, not Class A.",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.semantic?.classification).toBe("plausible_unresolved_tension");
    expect(result.semantic?.classification).not.toBe("clear_contradiction");
    expect(result.semantic?.propositionB.qualifications).toContain("did review");
  });

  it("I. ABSTENTION — low-information inputs", async () => {
    const sideA = source({
      sourceId: "src-abs-a",
      label: "A",
      sourceText: "Hmm.",
    });
    const sideB = source({
      sourceId: "src-abs-b",
      label: "B",
      sourceText: "Yeah.",
      sessionId: sideA.sessionId,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          classification: null,
          confidence: 0.2,
          abstentionReason: "Insufficient propositional content to classify.",
          rationale: "Too little information.",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("abstained");
    expect(result.errorCode).toBe("model_abstained");
    expect(result.abstentionReason).toMatch(/Insufficient/i);
    expect(result.semantic).toBeNull();
    assertNoPersistenceDecision(result);
  });

  it("J. MALFORMED MODEL OUTPUT — schema failure, fail closed", async () => {
    const sideA = source({
      sourceId: "src-bad-a",
      label: "A",
      sourceText: "I never drink alcohol.",
    });
    const sideB = source({
      sourceId: "src-bad-b",
      label: "B",
      sourceText: "I drank alcohol last night.",
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner({
        notAValidAdjudication: true,
        classification: "clear_contradiction",
      }),
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("validation_failed");
    expect(result.errorCode).toBe("schema_parse_failed");
    expect(result.semantic).toBeNull();
    expect(result.validation.status).toBe("invalid");
    assertNoPersistenceDecision(result);
  });

  it("K. FABRICATED QUOTE — deterministic span validation failure", async () => {
    const sideA = source({
      sourceId: "src-fab-a",
      label: "A",
      sourceText: "I never drink alcohol.",
    });
    const sideB = source({
      sourceId: "src-fab-b",
      label: "B",
      sourceText: "I drank alcohol last night.",
    });

    const good = baseModelResult(sideA, sideB);
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner({
        ...good,
        evidenceClaimA: {
          sourceId: sideA.sourceId,
          // In-bounds offsets into Side A, but fabricated quote text.
          exactQuote: "I always drink alcohol",
          startOffset: 0,
          endOffset: sideA.sourceText.length - 1,
        },
      }),
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("validation_failed");
    expect(result.errorCode).toBe("validation_failed");
    expect(
      result.validation.errors.some((e) => /quote_mismatch|fabricated_quote/i.test(e)),
    ).toBe(true);
    expect(result.semantic).toBeNull();
  });

  it("L. INVALID OFFSETS — deterministic span validation failure", async () => {
    const sideA = source({
      sourceId: "src-off-a",
      label: "A",
      sourceText: "I never drink alcohol.",
    });
    const sideB = source({
      sourceId: "src-off-b",
      label: "B",
      sourceText: "I drank alcohol last night.",
    });

    const good = baseModelResult(sideA, sideB);
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner({
        ...good,
        evidenceClaimB: {
          sourceId: sideB.sourceId,
          exactQuote: "I drank alcohol last night.",
          startOffset: 5,
          endOffset: 2,
        },
      }),
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("validation_failed");
    expect(result.validation.errors.some((e) => /invalid_offsets/i.test(e))).toBe(
      true,
    );
  });

  it("M. WRONG SOURCE ID — deterministic validation failure", async () => {
    const sideA = source({
      sourceId: "src-id-a",
      label: "A",
      sourceText: "I never drink alcohol.",
    });
    const sideB = source({
      sourceId: "src-id-b",
      label: "B",
      sourceText: "I drank alcohol last night.",
    });

    const good = baseModelResult(sideA, sideB);
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner({
        ...good,
        evidenceClaimA: {
          ...good.evidenceClaimA,
          sourceId: "totally-wrong-source",
        },
      }),
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("validation_failed");
    expect(
      result.validation.errors.some((e) => /source_id_mismatch|cross_side/i.test(e)),
    ).toBe(true);
  });

  it("N. CLASS A WITHOUT BOTH VALID SPANS — rejected/abstained", async () => {
    const sideA = source({
      sourceId: "src-span-a",
      label: "A",
      sourceText: "I never drink alcohol.",
    });
    const sideB = source({
      sourceId: "src-span-b",
      label: "B",
      sourceText: "I drank alcohol last night.",
    });

    const good = baseModelResult(sideA, sideB, {
      classification: "clear_contradiction",
    });
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner({
        ...good,
        evidenceClaimB: {
          sourceId: sideB.sourceId,
          exactQuote: "",
          startOffset: 0,
          endOffset: 0,
        },
      }),
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("validation_failed");
    expect(result.semantic).toBeNull();
    assertNoPersistenceDecision(result);
  });

  it("O. MODEL FAILURE OR TIMEOUT — inspectable failure, no candidate decision", async () => {
    const sideA = source({
      sourceId: "src-fail-a",
      label: "A",
      sourceText: "I never drink alcohol.",
    });
    const sideB = source({
      sourceId: "src-fail-b",
      label: "B",
      sourceText: "I drank alcohol last night.",
    });

    const failed = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: failingRunner("model_execution_failed", "provider down"),
      now: FIXED_NOW,
    });
    expect(failed.outcome).toBe("model_failed");
    expect(failed.errorCode).toBe("model_execution_failed");
    expect(failed.errorMessage).toMatch(/provider down/);
    assertNoPersistenceDecision(failed);

    const timedOut = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: failingRunner("model_timeout", "aborted"),
      now: FIXED_NOW,
    });
    expect(timedOut.outcome).toBe("model_failed");
    expect(timedOut.errorCode).toBe("model_timeout");
    assertNoPersistenceDecision(timedOut);
  });

  it("P. PROVIDER-INDEPENDENCE — injected runner; no hard-coded provider required", async () => {
    const sideA = source({
      sourceId: "src-prov-a",
      label: "A",
      sourceText: "I never drink alcohol.",
    });
    const sideB = source({
      sourceId: "src-prov-b",
      label: "B",
      sourceText: "I drank alcohol last night.",
    });

    const customRunner: StructuredModelRunner = {
      async runStructured() {
        return {
          ok: true,
          object: baseModelResult(sideA, sideB),
          providerId: "acme-labs",
          modelId: "acme-structured-9",
        };
      },
    };

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: customRunner,
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("semantic_accepted");
    expect(result.audit.providerId).toBe("acme-labs");
    expect(result.audit.modelId).toBe("acme-structured-9");
    expect(result.audit.providerId).not.toMatch(/openai/i);
  });

  it("Q. REFEREE INTERFACE — outcomes type-check; default not_run; no automatic PASS", async () => {
    expect(OBJECTIVITY_REFEREE_OUTCOMES).toEqual([
      "PASS",
      "PASS_WITH_LOWER_CONFIDENCE",
      "ROUTE_TO_DIFFERENT_OBJECT_TYPE",
      "REQUEST_MORE_EVIDENCE",
      "ABSTAIN",
    ]);

    const sideA = source({
      sourceId: "src-ref-a",
      label: "A",
      sourceText: "I never drink alcohol.",
    });
    const sideB = source({
      sourceId: "src-ref-b",
      label: "B",
      sourceText: "I drank alcohol last night.",
    });

    const withoutReferee = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(baseModelResult(sideA, sideB)),
      now: FIXED_NOW,
    });
    expect(withoutReferee.refereeStatus).toBe("not_run");
    expect(withoutReferee.refereeStatus).not.toBe("PASS");

    const abstainingReferee: ObjectivityReferee = {
      evaluate() {
        return {
          outcome: "ABSTAIN",
          rationale: "Explicit test double abstains; no auto PASS.",
        };
      },
    };

    const withReferee = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(baseModelResult(sideA, sideB)),
      objectivityReferee: abstainingReferee,
      now: FIXED_NOW,
    });
    expect(withReferee.refereeStatus).toBe("ABSTAIN");
    expect(withReferee.refereeStatus).not.toBe("PASS");
    assertNoPersistenceDecision(withReferee);
  });

  it("R. VERSION/AUDIT METADATA — contract, prompt, schema versions present and stable", async () => {
    const sideA = source({
      sourceId: "src-ver-a",
      label: "A",
      sourceText: "I never drink alcohol.",
    });
    const sideB = source({
      sourceId: "src-ver-b",
      label: "B",
      sourceText: "I drank alcohol last night.",
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(baseModelResult(sideA, sideB)),
      now: FIXED_NOW,
    });

    expect(KERNEL_CONTRACT_VERSION).toBe("orvek-intelligence-kernel-v1");
    expect(CONTRADICTION_ADJUDICATION_SCHEMA_VERSION).toBe(
      "contradiction-adjudication-schema-v1",
    );
    expect(CONTRADICTION_ADJUDICATION_PROMPT_VERSION).toBe(
      "contradiction-adjudication-prompt-v1",
    );
    expect(result.audit.kernelContractVersion).toBe(KERNEL_CONTRACT_VERSION);
    expect(result.audit.schemaVersion).toBe(
      CONTRADICTION_ADJUDICATION_SCHEMA_VERSION,
    );
    expect(result.audit.promptVersion).toBe(
      CONTRADICTION_ADJUDICATION_PROMPT_VERSION,
    );
    expect(result.audit.processorVersion).toBe(KERNEL_CONTRACT_VERSION);
    expect(result.audit.sourceIds).toEqual([sideA.sourceId, sideB.sourceId]);
    expect(result.audit.executedAt).toBe("2026-07-20T12:00:00.000Z");
    expect(result.audit.semanticClassification).toBe("clear_contradiction");
    expect(result.audit.refereeStatus).toBe("not_run");
  });

  it("rejects unsupported proposed object type (fail closed)", async () => {
    const sideA = source({
      sourceId: "src-obj-a",
      label: "A",
      sourceText: "I never drink alcohol.",
    });
    const sideB = source({
      sourceId: "src-obj-b",
      label: "B",
      sourceText: "I drank alcohol last night.",
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          proposedObjectType: "PatternClaim",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("validation_failed");
    expect(result.validation.errors.some((e) => /Unsupported/i.test(e))).toBe(
      true,
    );
  });

  it("rejects Side A evidence pointing at Side B source", async () => {
    const sideA = source({
      sourceId: "src-cross-a",
      label: "A",
      sourceText: "I never drink alcohol.",
    });
    const sideB = source({
      sourceId: "src-cross-b",
      label: "B",
      sourceText: "I drank alcohol last night.",
    });

    const good = baseModelResult(sideA, sideB);
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner({
        ...good,
        evidenceClaimA: {
          sourceId: sideB.sourceId,
          exactQuote: sideB.sourceText,
          startOffset: 0,
          endOffset: sideB.sourceText.length,
        },
      }),
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("validation_failed");
    expect(result.validation.errors.some((e) => /cross_side_source/i.test(e))).toBe(
      true,
    );
  });
});

describe("CEQR-001 runtime non-wiring boundary", () => {
  const root = process.cwd();

  function read(rel: string): string {
    return readFileSync(join(root, rel), "utf8");
  }

  it("does not wire adjudicator into message route, import, or materialisation", () => {
    const messageRoute = read("app/api/message/route.ts");
    const importPath = read("lib/import-chatgpt.ts");
    const materialization = read("lib/contradiction-materialization.ts");
    const detection = read("lib/contradiction-detection.ts");

    for (const [name, src] of [
      ["message route", messageRoute],
      ["import-chatgpt", importPath],
      ["contradiction-materialization", materialization],
      ["contradiction-detection", detection],
    ] as const) {
      expect(src, name).not.toMatch(/contradiction-adjudicator/);
      expect(src, name).not.toMatch(/orvek-intelligence-kernel/);
      expect(src, name).not.toMatch(/adjudicateContradiction/);
    }

    expect(messageRoute).toMatch(/detectContradictions/);
    expect(messageRoute).toMatch(/materializeContradictions/);
    expect(importPath).toMatch(/detectContradictions/);
    expect(importPath).toMatch(/materializeContradictions/);
  });

  it("does not modify prisma schema or add migrations in this slice tree", () => {
    // Structural: adjudicator modules must not import prisma client for writes.
    const adjudicator = read("lib/contradiction-adjudicator.ts");
    const kernelIndex = read("lib/orvek-intelligence-kernel/index.ts");
    expect(adjudicator).not.toMatch(/@prisma\/client/);
    expect(adjudicator).not.toMatch(/prismadb/);
    expect(kernelIndex).not.toMatch(/@prisma\/client/);
  });
});
