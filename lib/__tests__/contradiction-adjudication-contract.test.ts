/**
 * CEQR-001 / CEQR-003 — model-assisted contradiction adjudication contract tests.
 * Injected fake model runners only; no live provider calls.
 * CEQR-003 adds context/qualifier preservation and consistency-gate coverage.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import {
  adjudicateContradiction,
  buildContradictionAdjudicationPrompt,
  classificationAllowsContradictionNodeSemantics,
  classificationIsNonContradictionNode,
  collectSemanticConsistencyErrors,
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

  it("K. PROVIDER-AUTHORED exactQuote is ignored — code derives quote from offsets (CEQR-016)", async () => {
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
          // Fabricated quote text is ignored; offsets select the authoritative slice.
          exactQuote: "I always drink alcohol",
          startOffset: 0,
          endOffset: sideA.sourceText.length,
        },
      }),
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("semantic_accepted");
    expect(result.semantic?.evidenceClaimA.exactQuote).toBe(sideA.sourceText);
    expect(result.semantic?.evidenceClaimA.exactQuote).not.toBe(
      "I always drink alcohol",
    );
  });

  it("K2. INVALID OFFSETS still fail closed (CEQR-016)", async () => {
    const sideA = source({
      sourceId: "src-fab-a2",
      label: "A",
      sourceText: "I never drink alcohol.",
    });
    const sideB = source({
      sourceId: "src-fab-b2",
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
          startOffset: 0,
          endOffset: sideA.sourceText.length + 5,
        },
      }),
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("validation_failed");
    expect(
      result.validation.errors.some((e) => /invalid_offsets/i.test(e)),
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

  it("M. PROVIDER-AUTHORED sourceId is ignored — code owns Side A/B identity (CEQR-016)", async () => {
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

    expect(result.outcome).toBe("semantic_accepted");
    expect(result.semantic?.evidenceClaimA.sourceId).toBe("src-id-a");
    expect(result.semantic?.evidenceClaimA.sourceId).not.toBe(
      "totally-wrong-source",
    );
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
      "contradiction-adjudication-schema-v2",
    );
    expect(CONTRADICTION_ADJUDICATION_PROMPT_VERSION).toBe(
      "contradiction-adjudication-prompt-v3",
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

  it("provider-authored Side A claim pointing at Side B is ignored; Side A identity is bound", async () => {
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
          endOffset: sideA.sourceText.length,
        },
      }),
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("semantic_accepted");
    expect(result.semantic?.evidenceClaimA.sourceId).toBe(sideA.sourceId);
    expect(result.semantic?.evidenceClaimA.sourceId).not.toBe(sideB.sourceId);
    expect(result.semantic?.evidenceClaimA.exactQuote).toBe(sideA.sourceText);
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

describe("CEQR-003 context and qualifier preservation", () => {
  it("prompt contract requires qualifier preservation instructions", () => {
    const sideA = source({
      sourceId: "src-prompt-a",
      label: "A",
      sourceText: "I usually avoid sugar.",
    });
    const sideB = source({
      sourceId: "src-prompt-b",
      label: "B",
      sourceText: "I ate cake once at a birthday.",
    });
    const { system, prompt } = buildContradictionAdjudicationPrompt(sideA, sideB);

    expect(system).toMatch(/preserve all material qualifications/i);
    expect(system).toMatch(/PARTIAL COMPLIANCE MUST NOT BE classified as clear_contradiction/);
    expect(system).toMatch(/usually.*always/i);
    expect(system).toMatch(/want\/should\/try/);
    expect(system).toMatch(/nested negation/i);
    expect(system).toMatch(/attributed speech|attribution/i);
    expect(system).toMatch(/abstention/i);
    expect(system).toMatch(/qualifiers materially affected classification/i);
    expect(system).toMatch(/what missing information would change/i);
    expect(system).toContain(CONTRADICTION_ADJUDICATION_PROMPT_VERSION);
    expect(prompt).toMatch(/Preserve material qualifiers/);
  });

  it("1. CLEAR CONTRADICTION — positive control remains valid", async () => {
    const sideA = source({
      sourceId: "ceqr3-cc-a",
      label: "Side A",
      sourceText: "I never drink alcohol.",
    });
    const sideB = source({
      sourceId: "ceqr3-cc-b",
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
            qualifications: "universal claim; no exception stated",
          },
          propositionB: {
            normalizedProposition: "Speaker drank alcohol last night",
            actor: "speaker",
            subject: "alcohol consumption",
            timeframe: "last night",
            negation: false,
            modality: "assertive past action",
            qualifications: "isolated episode under universal claim",
          },
          bothCanSimultaneouslyBeTrue: false,
          changedBeliefOverTime: false,
          intentionVersusOutcome: false,
          goalVersusObstacle: false,
          emotionalOrPhysiologicalVersusReasoningStandard: false,
          classification: "clear_contradiction",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("semantic_accepted");
    expect(result.semantic?.classification).toBe("clear_contradiction");
    expect(result.semantic?.bothCanSimultaneouslyBeTrue).toBe(false);
    expect(result.semantic?.changedBeliefOverTime).toBe(false);
    expect(result.semantic?.intentionVersusOutcome).toBe(false);
    expect(result.semantic?.goalVersusObstacle).toBe(false);
    expect(result.semantic?.emotionalOrPhysiologicalVersusReasoningStandard).toBe(
      false,
    );
    assertNoPersistenceDecision(result);
  });

  it("2. PARTIAL COMPLIANCE — controlling stop condition never Class A", async () => {
    const sideA = source({
      sourceId: "ceqr3-pc-a",
      label: "Review need",
      sourceText: "I need to review after I read to retain.",
    });
    const sideB = source({
      sourceId: "ceqr3-pc-b",
      label: "Partial review",
      sourceText:
        "I did review it after every read, but I did not do the question exercises.",
      sessionId: sideA.sessionId,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          propositionA: {
            normalizedProposition:
              "Speaker needs to review after reading to retain",
            actor: "speaker",
            subject: "reading retention / review process",
            timeframe: "ongoing practice",
            negation: false,
            modality: "need / goal",
            qualifications: "goal commitment; not an absolute completed action claim",
          },
          propositionB: {
            normalizedProposition:
              "Speaker reviewed after every read but omitted question exercises",
            actor: "speaker",
            subject: "reading retention / review process",
            timeframe: "recent study episode",
            negation: false,
            modality: "partial compliance / obstacle",
            qualifications:
              "did review it after every read; did not do the question exercises",
          },
          contextAndScope: "same speaker; review process with partial compliance",
          bothCanSimultaneouslyBeTrue: true,
          goalVersusObstacle: true,
          classification: "plausible_unresolved_tension",
          confidence: 0.74,
          rationale:
            "Partial compliance preserved: review occurred; question drills omitted. Goal vs obstacle — not 'did not review'.",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("semantic_accepted");
    expect(result.semantic?.classification).not.toBe("clear_contradiction");
    expect(["plausible_unresolved_tension", "compatible_states"]).toContain(
      result.semantic?.classification,
    );
    expect(result.semantic?.propositionB.normalizedProposition).toMatch(
      /reviewed after every read/i,
    );
    expect(result.semantic?.propositionB.qualifications).toMatch(
      /did review it after every read/i,
    );
    expect(result.semantic?.propositionB.qualifications).toMatch(
      /question exercises/i,
    );
    expect(result.semantic?.goalVersusObstacle).toBe(true);
    assertNoPersistenceDecision(result);
  });

  it("3. FREQUENCY QUALIFIER — usually vs once not Class A", async () => {
    const sideA = source({
      sourceId: "ceqr3-freq-a",
      label: "Usually",
      sourceText: "I usually avoid sugar.",
    });
    const sideB = source({
      sourceId: "ceqr3-freq-b",
      label: "Birthday cake",
      sourceText: "I ate cake once at a birthday.",
      sessionId: sideA.sessionId,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          propositionA: {
            normalizedProposition: "Speaker usually avoids sugar",
            actor: "speaker",
            subject: "sugar intake",
            timeframe: "habitual",
            negation: false,
            modality: "usually / habitual",
            qualifications: "usually — not always; allows rare exceptions",
          },
          propositionB: {
            normalizedProposition: "Speaker ate cake once at a birthday",
            actor: "speaker",
            subject: "sugar intake",
            timeframe: "one birthday occasion",
            negation: false,
            modality: "isolated past action",
            qualifications: "once; birthday exception context",
          },
          bothCanSimultaneouslyBeTrue: true,
          classification: "compatible_states",
          confidence: 0.85,
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.semantic?.classification).not.toBe("clear_contradiction");
    expect(result.semantic?.propositionA.qualifications).toMatch(/usually/i);
    expect(result.semantic?.propositionB.qualifications).toMatch(/birthday|once/i);
  });

  it("4. UNIVERSAL CLAIM CONTROL — never vs yesterday may remain Class A", async () => {
    const sideA = source({
      sourceId: "ceqr3-univ-a",
      label: "Never sugar",
      sourceText: "I never eat sugar.",
    });
    const sideB = source({
      sourceId: "ceqr3-univ-b",
      label: "Cake yesterday",
      sourceText: "I ate cake yesterday.",
      sessionId: sideA.sessionId,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          propositionA: {
            normalizedProposition: "Speaker never eats sugar",
            actor: "speaker",
            subject: "sugar intake",
            timeframe: "universal / all time",
            negation: true,
            modality: "never",
            qualifications: "universal claim; no exception stated",
          },
          propositionB: {
            normalizedProposition: "Speaker ate cake yesterday",
            actor: "speaker",
            subject: "sugar intake",
            timeframe: "yesterday",
            negation: false,
            modality: "assertive past action",
            qualifications: "single episode under universal claim",
          },
          bothCanSimultaneouslyBeTrue: false,
          classification: "clear_contradiction",
          confidence: 0.9,
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("semantic_accepted");
    expect(result.semantic?.classification).toBe("clear_contradiction");
    assertNoPersistenceDecision(result);
  });

  it("5. TEMPORAL CHANGE — used to / at the moment not Class A", async () => {
    const sideA = source({
      sourceId: "ceqr3-temp-a",
      label: "Past weekends",
      sourceText: "I used to go out every weekend.",
    });
    const sideB = source({
      sourceId: "ceqr3-temp-b",
      label: "Present socialising",
      sourceText: "At the moment I barely socialise.",
      sessionId: sideA.sessionId,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          propositionA: {
            normalizedProposition: "Speaker used to go out every weekend",
            actor: "speaker",
            subject: "socialising",
            timeframe: "past habitual",
            negation: false,
            modality: "used to / past habit",
            qualifications: "past tense; not present claim",
          },
          propositionB: {
            normalizedProposition: "Speaker barely socialises at the moment",
            actor: "speaker",
            subject: "socialising",
            timeframe: "present phase",
            negation: false,
            modality: "present phase description",
            qualifications: "at the moment — time-bounded",
          },
          changedBeliefOverTime: true,
          bothCanSimultaneouslyBeTrue: true,
          classification: "compatible_states",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.semantic?.classification).not.toBe("clear_contradiction");
    expect(result.semantic?.changedBeliefOverTime).toBe(true);
  });

  it("6. CURRENT PHASE QUALIFIER — exhausted phase vs normal energy", async () => {
    const sideA = source({
      sourceId: "ceqr3-phase-a",
      label: "Exhausted phase",
      sourceText: "I'm in an exhausted phase at the moment.",
    });
    const sideB = source({
      sourceId: "ceqr3-phase-b",
      label: "Normal energy",
      sourceText: "I am normally highly energetic.",
      sessionId: sideA.sessionId,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          propositionA: {
            normalizedProposition:
              "Speaker is in an exhausted phase at the moment",
            actor: "speaker",
            subject: "energy level",
            timeframe: "present phase",
            negation: false,
            modality: "present-phase description",
            qualifications: "at the moment; phase-bounded",
          },
          propositionB: {
            normalizedProposition: "Speaker is normally highly energetic",
            actor: "speaker",
            subject: "energy level",
            timeframe: "general baseline",
            negation: false,
            modality: "normally / baseline habit",
            qualifications: "normally — baseline, not every present moment",
          },
          bothCanSimultaneouslyBeTrue: true,
          classification: "compatible_states",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.semantic?.classification).toBe("compatible_states");
    expect(result.semantic?.propositionA.qualifications).toMatch(
      /at the moment|phase/i,
    );
    expect(result.semantic?.propositionB.qualifications).toMatch(/normally/i);
  });

  it("7. INTENTION VERSUS OUTCOME — want vs missed once", async () => {
    const sideA = source({
      sourceId: "ceqr3-intent-a",
      label: "Want exercise",
      sourceText: "I want to exercise every day.",
    });
    const sideB = source({
      sourceId: "ceqr3-intent-b",
      label: "Missed yesterday",
      sourceText: "I missed yesterday.",
      sessionId: sideA.sessionId,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          propositionA: {
            normalizedProposition: "Speaker wants to exercise every day",
            actor: "speaker",
            subject: "exercise",
            timeframe: "ongoing desire",
            negation: false,
            modality: "want / intention",
            qualifications: "desire; not guaranteed completed behaviour",
          },
          propositionB: {
            normalizedProposition: "Speaker missed exercise yesterday",
            actor: "speaker",
            subject: "exercise",
            timeframe: "yesterday",
            negation: false,
            modality: "isolated missed outcome",
            qualifications: "single missed day",
          },
          intentionVersusOutcome: true,
          bothCanSimultaneouslyBeTrue: true,
          classification: "plausible_unresolved_tension",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.semantic?.classification).not.toBe("clear_contradiction");
    expect(result.semantic?.intentionVersusOutcome).toBe(true);
  });

  it("8. OBLIGATION VERSUS ACTION — should vs did not", async () => {
    const sideA = source({
      sourceId: "ceqr3-obl-a",
      label: "Should read",
      sourceText: "I should read every evening.",
    });
    const sideB = source({
      sourceId: "ceqr3-obl-b",
      label: "Did not read",
      sourceText: "I did not read last night.",
      sessionId: sideA.sessionId,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          propositionA: {
            normalizedProposition: "Speaker should read every evening",
            actor: "speaker",
            subject: "evening reading",
            timeframe: "habitual obligation",
            negation: false,
            modality: "should / obligation",
            qualifications: "obligation modality; not asserted completed habit",
          },
          propositionB: {
            normalizedProposition: "Speaker did not read last night",
            actor: "speaker",
            subject: "evening reading",
            timeframe: "last night",
            negation: true,
            modality: "past non-action",
            qualifications: "single night non-compliance with obligation",
          },
          intentionVersusOutcome: true,
          bothCanSimultaneouslyBeTrue: true,
          classification: "plausible_unresolved_tension",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.semantic?.classification).not.toBe("clear_contradiction");
    expect(result.semantic?.propositionA.modality).toMatch(/should|obligation/i);
  });

  it("9. ATTEMPT VERSUS GUARANTEE — try vs once raised voice", async () => {
    const sideA = source({
      sourceId: "ceqr3-try-a",
      label: "Try calm",
      sourceText: "I try to stay calm during disagreements.",
    });
    const sideB = source({
      sourceId: "ceqr3-try-b",
      label: "Raised voice",
      sourceText: "I raised my voice once.",
      sessionId: sideA.sessionId,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          propositionA: {
            normalizedProposition:
              "Speaker tries to stay calm during disagreements",
            actor: "speaker",
            subject: "calm during disagreements",
            timeframe: "habitual attempt",
            negation: false,
            modality: "try / attempt",
            qualifications: "try — not guaranteed success",
          },
          propositionB: {
            normalizedProposition: "Speaker raised voice once",
            actor: "speaker",
            subject: "calm during disagreements",
            timeframe: "one occasion",
            negation: false,
            modality: "isolated lapse",
            qualifications: "once — isolated episode",
          },
          bothCanSimultaneouslyBeTrue: true,
          classification: "compatible_states",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.semantic?.classification).not.toBe("clear_contradiction");
    expect(result.semantic?.propositionA.qualifications).toMatch(/try/i);
    expect(result.semantic?.propositionB.qualifications).toMatch(/once/i);
  });

  it("10. CONDITION — when tired vs after sleeping well", async () => {
    const sideA = source({
      sourceId: "ceqr3-cond-a",
      label: "Tired driving",
      sourceText: "I avoid driving when I'm tired.",
    });
    const sideB = source({
      sourceId: "ceqr3-cond-b",
      label: "Slept well drive",
      sourceText: "I drove to the shop after sleeping well.",
      sessionId: sideA.sessionId,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          propositionA: {
            normalizedProposition: "Speaker avoids driving when tired",
            actor: "speaker",
            subject: "driving",
            timeframe: "conditional habit",
            negation: false,
            modality: "conditional avoidance",
            qualifications: "condition: when tired",
          },
          propositionB: {
            normalizedProposition:
              "Speaker drove to the shop after sleeping well",
            actor: "speaker",
            subject: "driving",
            timeframe: "after sleeping well",
            negation: false,
            modality: "past action under rested condition",
            qualifications: "condition satisfied: after sleeping well",
          },
          bothCanSimultaneouslyBeTrue: true,
          classification: "compatible_states",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.semantic?.classification).toBe("compatible_states");
    expect(result.semantic?.propositionA.qualifications).toMatch(/when tired/i);
  });

  it("11. SCOPE DIFFERENCE — formal meetings vs close friends", async () => {
    const sideA = source({
      sourceId: "ceqr3-scope-a",
      label: "Meetings",
      sourceText: "I struggle to speak in formal meetings.",
    });
    const sideB = source({
      sourceId: "ceqr3-scope-b",
      label: "Friends",
      sourceText: "I talk easily with close friends.",
      sessionId: sideA.sessionId,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          propositionA: {
            normalizedProposition:
              "Speaker struggles to speak in formal meetings",
            actor: "speaker",
            subject: "speaking ease",
            timeframe: "ongoing",
            negation: false,
            modality: "scope-limited struggle",
            qualifications: "scope: formal meetings",
          },
          propositionB: {
            normalizedProposition: "Speaker talks easily with close friends",
            actor: "speaker",
            subject: "speaking ease",
            timeframe: "ongoing",
            negation: false,
            modality: "scope-limited ease",
            qualifications: "scope: close friends",
          },
          contextAndScope: "formal-meeting vs close-friend scopes",
          bothCanSimultaneouslyBeTrue: true,
          classification: "compatible_states",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.semantic?.classification).toBe("compatible_states");
    expect(result.semantic?.propositionA.qualifications).toMatch(
      /formal meetings/i,
    );
    expect(result.semantic?.propositionB.qualifications).toMatch(
      /close friends/i,
    );
  });

  it("12. SOMATIC RESPONSE VERSUS REASONING — not reactive preserved", async () => {
    const sideA = source({
      sourceId: "ceqr3-soma-a",
      label: "Objectivity",
      sourceText:
        "I'm just having fun I don't really care that much although I always optimise for objectivity regardless of what mode I'm operating in",
    });
    const sideB = source({
      sourceId: "ceqr3-soma-b",
      label: "Identity trigger",
      sourceText:
        "I swear I feel like I can literally feel my brain like bubbling when I see something that starts to trigger my identity. I'm in a exhaustive faze at the moment and when I see something identity weaponed I'm not reactive but I also don't dwell on it enough to let it sit too much but I can literally feel like sensations in my brain bubbling like it's weird lol",
      sessionId: sideA.sessionId,
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
            qualifications: "reasoning standard; coexists with having fun",
          },
          propositionB: {
            normalizedProposition:
              "Speaker experiences identity-trigger sensations while remaining non-reactive in an exhaustive phase",
            actor: "speaker",
            subject: "identity-trigger somatic response",
            timeframe: "present exhaustive phase",
            negation: false,
            modality: "descriptive sensation",
            qualifications:
              "not reactive; exhaustive phase; does not dwell; involuntary sensations",
          },
          bothCanSimultaneouslyBeTrue: true,
          emotionalOrPhysiologicalVersusReasoningStandard: true,
          classification: "compatible_states",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.semantic?.classification).toBe("compatible_states");
    expect(result.semantic?.propositionB.qualifications).toMatch(/not reactive/i);
    expect(result.semantic?.propositionB.qualifications).toMatch(
      /exhaustive phase/i,
    );
    expect(result.semantic?.emotionalOrPhysiologicalVersusReasoningStandard).toBe(
      true,
    );
  });

  it("13. ATTRIBUTED SPEECH — brother says vs speaker enjoys", async () => {
    const sideA = source({
      sourceId: "ceqr3-attr-a",
      label: "Brother says",
      sourceText: "My brother says I hate networking.",
    });
    const sideB = source({
      sourceId: "ceqr3-attr-b",
      label: "Speaker enjoys",
      sourceText: "I enjoy networking.",
      sessionId: sideA.sessionId,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          propositionA: {
            normalizedProposition:
              "Speaker reports that brother claims speaker hates networking",
            actor: "brother (attributed); speaker reporting",
            subject: "networking preference",
            timeframe: "reported attribution",
            negation: false,
            modality: "attributed speech / report",
            qualifications:
              "brother's attribution; not endorsed as speaker's own claim",
          },
          propositionB: {
            normalizedProposition: "Speaker enjoys networking",
            actor: "speaker",
            subject: "networking preference",
            timeframe: "present",
            negation: false,
            modality: "assertive preference",
            qualifications: "speaker's own claim",
          },
          bothCanSimultaneouslyBeTrue: true,
          classification: "compatible_states",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.semantic?.classification).not.toBe("clear_contradiction");
    expect(result.semantic?.propositionA.qualifications).toMatch(
      /attribution|brother/i,
    );
  });

  it("14. UNCERTAINTY — think I may prefer vs some projects", async () => {
    const sideA = source({
      sourceId: "ceqr3-unc-a",
      label: "May prefer alone",
      sourceText: "I think I may prefer working alone.",
    });
    const sideB = source({
      sourceId: "ceqr3-unc-b",
      label: "Some projects",
      sourceText: "I enjoy collaborating on some projects.",
      sessionId: sideA.sessionId,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          propositionA: {
            normalizedProposition:
              "Speaker thinks they may prefer working alone",
            actor: "speaker",
            subject: "work preference",
            timeframe: "uncertain present",
            negation: false,
            modality: "think / may — uncertainty",
            qualifications: "uncertainty hedges: think, may",
          },
          propositionB: {
            normalizedProposition:
              "Speaker enjoys collaborating on some projects",
            actor: "speaker",
            subject: "work preference",
            timeframe: "some projects",
            negation: false,
            modality: "limited-scope enjoyment",
            qualifications: "some projects — limited scope",
          },
          bothCanSimultaneouslyBeTrue: true,
          classification: "compatible_states",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.semantic?.classification).not.toBe("clear_contradiction");
    expect(result.semantic?.propositionA.qualifications).toMatch(
      /uncertainty|think|may/i,
    );
    expect(result.semantic?.propositionB.qualifications).toMatch(/some projects/i);
  });

  it("15. EXPLICIT EXCEPTION — except special occasions vs wedding champagne", async () => {
    const sideA = source({
      sourceId: "ceqr3-exc-a",
      label: "Except occasions",
      sourceText: "I do not drink except on special occasions.",
    });
    const sideB = source({
      sourceId: "ceqr3-exc-b",
      label: "Wedding champagne",
      sourceText: "I had champagne at a wedding.",
      sessionId: sideA.sessionId,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          propositionA: {
            normalizedProposition:
              "Speaker does not drink except on special occasions",
            actor: "speaker",
            subject: "alcohol",
            timeframe: "habitual with exception",
            negation: true,
            modality: "rule with exception",
            qualifications: "exception: special occasions",
          },
          propositionB: {
            normalizedProposition: "Speaker had champagne at a wedding",
            actor: "speaker",
            subject: "alcohol",
            timeframe: "wedding occasion",
            negation: false,
            modality: "past action within exception",
            qualifications: "wedding — special occasion fits exception",
          },
          bothCanSimultaneouslyBeTrue: true,
          classification: "compatible_states",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.semantic?.classification).toBe("compatible_states");
    expect(result.semantic?.propositionA.qualifications).toMatch(
      /special occasions/i,
    );
  });

  it("16. NESTED NEGATION — not saying never want help", async () => {
    const sideA = source({
      sourceId: "ceqr3-neg-a",
      label: "Nested negation",
      sourceText: "I'm not saying I never want help.",
    });
    const sideB = source({
      sourceId: "ceqr3-neg-b",
      label: "Asked for help",
      sourceText: "I asked for help yesterday.",
      sessionId: sideA.sessionId,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          propositionA: {
            normalizedProposition:
              "Speaker is not claiming they never want help",
            actor: "speaker",
            subject: "wanting help",
            timeframe: "meta-statement",
            negation: true,
            modality: "nested negation / clarification",
            qualifications:
              "nested negation preserved; not flattened to 'never want help'",
          },
          propositionB: {
            normalizedProposition: "Speaker asked for help yesterday",
            actor: "speaker",
            subject: "wanting help / asking",
            timeframe: "yesterday",
            negation: false,
            modality: "past action",
            qualifications: "compatible with not denying wanting help",
          },
          bothCanSimultaneouslyBeTrue: true,
          classification: "compatible_states",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(["compatible_states", "insufficient_or_misaligned_context"]).toContain(
      result.semantic?.classification,
    );
    expect(result.semantic?.propositionA.normalizedProposition).not.toMatch(
      /^Speaker never wants help$/i,
    );
    expect(result.semantic?.propositionA.qualifications).toMatch(
      /nested negation/i,
    );
  });

  it("17. INTERNAL INCONSISTENCY — Class A + bothCanSimultaneouslyBeTrue", async () => {
    const sideA = source({
      sourceId: "ceqr3-inc-a",
      label: "A",
      sourceText: "I never drink alcohol.",
    });
    const sideB = source({
      sourceId: "ceqr3-inc-b",
      label: "B",
      sourceText: "I drank alcohol last night.",
      sessionId: sideA.sessionId,
    });

    const fake = baseModelResult(sideA, sideB, {
      classification: "clear_contradiction",
      bothCanSimultaneouslyBeTrue: true,
    });
    expect(collectSemanticConsistencyErrors(fake).length).toBeGreaterThan(0);

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(fake),
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("validation_failed");
    expect(result.semantic).toBeNull();
    expect(
      result.validation.errors.some((e) =>
        /bothCanSimultaneouslyBeTrue/i.test(e),
      ),
    ).toBe(true);
    // No silent reclassification
    expect(result.audit.semanticClassification).toBe("clear_contradiction");
    assertNoPersistenceDecision(result);
  });

  it("18. INTERNAL INCONSISTENCY — Class A + goalVersusObstacle", async () => {
    const sideA = source({
      sourceId: "ceqr3-gvo-a",
      label: "A",
      sourceText: "I need to review after I read to retain.",
    });
    const sideB = source({
      sourceId: "ceqr3-gvo-b",
      label: "B",
      sourceText:
        "I did review it after every read, but I did not do the question exercises.",
      sessionId: sideA.sessionId,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          classification: "clear_contradiction",
          goalVersusObstacle: true,
          bothCanSimultaneouslyBeTrue: false,
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("validation_failed");
    expect(result.semantic).toBeNull();
    expect(
      result.validation.errors.some((e) => /goalVersusObstacle/i.test(e)),
    ).toBe(true);
    assertNoPersistenceDecision(result);
  });

  it("19. INTERNAL INCONSISTENCY — classification + abstentionReason", async () => {
    const sideA = source({
      sourceId: "ceqr3-abs-inc-a",
      label: "A",
      sourceText: "I never drink alcohol.",
    });
    const sideB = source({
      sourceId: "ceqr3-abs-inc-b",
      label: "B",
      sourceText: "I drank alcohol last night.",
      sessionId: sideA.sessionId,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          classification: "clear_contradiction",
          abstentionReason: "Also unsure about actor scope.",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("validation_failed");
    expect(result.semantic).toBeNull();
    expect(
      result.validation.errors.some((e) =>
        /abstentionReason|classification cannot coexist/i.test(e),
      ),
    ).toBe(true);
  });

  it("20. VALID ABSTENTION — cannot safely preserve actor/scope/attribution", async () => {
    const sideA = source({
      sourceId: "ceqr3-abs-ok-a",
      label: "A",
      sourceText: "Someone said something about networking.",
    });
    const sideB = source({
      sourceId: "ceqr3-abs-ok-b",
      label: "B",
      sourceText: "Networking is fine sometimes.",
      sessionId: sideA.sessionId,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          classification: null,
          confidence: 0.15,
          abstentionReason:
            "Cannot safely preserve actor, scope, or attribution; Side A attribution is ambiguous.",
          rationale: "Unsafe to classify without clearer attribution.",
        }),
      ),
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("abstained");
    expect(result.semantic).toBeNull();
    expect(result.abstentionReason).toMatch(/attribution|actor|scope/i);
    expect(result.validation.status).toBe("valid");
    assertNoPersistenceDecision(result);
  });

  it("21. EXACT EVIDENCE PROVENANCE — invalid offsets fail closed; provider quote/sourceId ignored", async () => {
    const sideA = source({
      sourceId: "ceqr3-prov-a",
      label: "A",
      sourceText: "I usually avoid sugar.",
    });
    const sideB = source({
      sourceId: "ceqr3-prov-b",
      label: "B",
      sourceText: "I ate cake once at a birthday.",
      sessionId: sideA.sessionId,
    });

    const good = baseModelResult(sideA, sideB, {
      classification: "compatible_states",
      bothCanSimultaneouslyBeTrue: true,
      quoteA: "usually",
      quoteB: "once at a birthday",
    });

    const pass = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(good),
      now: FIXED_NOW,
    });
    expect(pass.outcome).toBe("semantic_accepted");
    expect(pass.semantic?.evidenceClaimA.exactQuote).toBe("usually");
    expect(pass.semantic?.evidenceClaimB.exactQuote).toBe("once at a birthday");

    const providerFabricatedQuoteIgnored = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner({
        ...good,
        evidenceClaimA: {
          sourceId: sideA.sourceId,
          exactQuote: "always avoid sugar",
          startOffset: 0,
          endOffset: 7,
        },
      }),
      now: FIXED_NOW,
    });
    expect(providerFabricatedQuoteIgnored.outcome).toBe("semantic_accepted");
    expect(providerFabricatedQuoteIgnored.semantic?.evidenceClaimA.exactQuote).toBe(
      sideA.sourceText.slice(0, 7),
    );
    expect(
      providerFabricatedQuoteIgnored.semantic?.evidenceClaimA.exactQuote,
    ).not.toBe("always avoid sugar");

    const badOffsets = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner({
        ...good,
        evidenceClaimB: {
          startOffset: 20,
          endOffset: 5,
        },
      }),
      now: FIXED_NOW,
    });
    expect(badOffsets.outcome).toBe("validation_failed");
    expect(
      badOffsets.validation.errors.some((e) => /invalid_offsets/i.test(e)),
    ).toBe(true);

    const wrongSideIgnored = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner({
        ...good,
        evidenceClaimA: {
          sourceId: sideB.sourceId,
          exactQuote: sideB.sourceText,
          startOffset: 0,
          endOffset: "usually".length,
        },
      }),
      now: FIXED_NOW,
    });
    expect(wrongSideIgnored.outcome).toBe("semantic_accepted");
    expect(wrongSideIgnored.semantic?.evidenceClaimA.sourceId).toBe(
      sideA.sourceId,
    );
  });

  it("22. STRUCTURAL BOUNDARY — no new adjudicator/kernel imports on runtime paths", () => {
    const root = process.cwd();
    const read = (rel: string) => readFileSync(join(root, rel), "utf8");
    for (const rel of [
      "app/api/message/route.ts",
      "lib/contradiction-detection.ts",
      "lib/import-chatgpt.ts",
      "lib/contradiction-materialization.ts",
    ]) {
      const src = read(rel);
      expect(src).not.toMatch(/contradiction-adjudicator/);
      expect(src).not.toMatch(/orvek-intelligence-kernel/);
      expect(src).not.toMatch(/adjudicateContradiction/);
      expect(src).not.toMatch(/collectSemanticConsistencyErrors/);
    }
  });

  it("rejects blank qualifications and blank contextAndScope", async () => {
    const sideA = source({
      sourceId: "ceqr3-blank-a",
      label: "A",
      sourceText: "I never drink alcohol.",
    });
    const sideB = source({
      sourceId: "ceqr3-blank-b",
      label: "B",
      sourceText: "I drank alcohol last night.",
      sessionId: sideA.sessionId,
    });

    const blankQual = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          propositionA: {
            normalizedProposition: "Speaker never drinks",
            actor: "speaker",
            subject: "alcohol",
            timeframe: "always",
            negation: true,
            modality: "never",
            qualifications: "   ",
          },
        }),
      ),
      now: FIXED_NOW,
    });
    expect(blankQual.outcome).toBe("validation_failed");
    expect(
      blankQual.validation.errors.some((e) => /qualifications is empty/i.test(e)),
    ).toBe(true);

    const blankScope = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          contextAndScope: "",
        }),
      ),
      now: FIXED_NOW,
    });
    expect(blankScope.outcome).toBe("validation_failed");
    expect(
      blankScope.validation.errors.some((e) => /contextAndScope is empty/i.test(e)),
    ).toBe(true);
  });

  it("rejects Class A with each forbidden compatibility flag (A–E)", async () => {
    const sideA = source({
      sourceId: "ceqr3-flags-a",
      label: "A",
      sourceText: "I never drink alcohol.",
    });
    const sideB = source({
      sourceId: "ceqr3-flags-b",
      label: "B",
      sourceText: "I drank alcohol last night.",
      sessionId: sideA.sessionId,
    });

    const flags = [
      "bothCanSimultaneouslyBeTrue",
      "changedBeliefOverTime",
      "intentionVersusOutcome",
      "goalVersusObstacle",
      "emotionalOrPhysiologicalVersusReasoningStandard",
    ] as const;

    for (const flag of flags) {
      const result = await adjudicateContradiction({
        sideA,
        sideB,
        modelRunner: fakeRunner(
          baseModelResult(sideA, sideB, {
            classification: "clear_contradiction",
            bothCanSimultaneouslyBeTrue: false,
            changedBeliefOverTime: false,
            intentionVersusOutcome: false,
            goalVersusObstacle: false,
            emotionalOrPhysiologicalVersusReasoningStandard: false,
            [flag]: true,
          }),
        ),
        now: FIXED_NOW,
      });
      expect(result.outcome, flag).toBe("validation_failed");
      expect(
        result.validation.errors.some((e) => e.includes(flag)),
        flag,
      ).toBe(true);
      expect(result.semantic, flag).toBeNull();
    }
  });
});
