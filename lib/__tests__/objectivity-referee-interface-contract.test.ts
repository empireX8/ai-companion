/**
 * OBJECTIVITY-REFEREE-INTERFACE-DEPENDENCY-GATE-001
 * Contract tests for the shared Objectivity Referee interface.
 * Injected fakes only. No network. No DB mutation. No persistence.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  adjudicateContradiction,
  KERNEL_CONTRACT_VERSION,
  KERNEL_FIRST_PROOF_OBJECT,
  type ContradictionModelResult,
  type ContradictionModelTransportResult,
} from "../contradiction-adjudicator";
import {
  selectSameSessionContradictionPair,
} from "../contradiction-same-session-selection";
import {
  OBJECTIVITY_REFEREE_INTERFACE_VERSION,
  OBJECTIVITY_REFEREE_OUTCOMES,
  notRunObjectivityRefereeResult,
  objectivityRefereeResultToStatus,
  refereeAllowsContinuation,
  runObjectivityRefereeSafely,
  validateObjectivityRefereeEvaluation,
  type ObjectivityReferee,
  type StructuredModelRunner,
  claimForSubstring,
  type KernelSourceUnit,
} from "../orvek-intelligence-kernel";

import {
  transportSelectionForSubstring,
} from "./helpers/ceqr020-transport-selection";

const FIXED_NOW = () => new Date("2026-07-20T12:00:00.000Z");
const SESSION = "session-ref";

function source(
  partial: Partial<KernelSourceUnit> &
    Pick<KernelSourceUnit, "sourceId" | "sourceText" | "label">,
): KernelSourceUnit {
  return {
    sessionId: partial.sessionId ?? SESSION,
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
  overrides: Partial<ContradictionModelTransportResult> = {},
): ContradictionModelTransportResult {
  const quoteA = sideA.sourceText;
  const quoteB = sideB.sourceText;
  return {
    propositionA: {
      normalizedProposition: "Proposition A",
      actor: "speaker",
      subject: "alcohol",
      timeframe: "general",
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
    contextAndScope: "same speaker",
    bothCanSimultaneouslyBeTrue: false,
    changedBeliefOverTime: false,
    intentionVersusOutcome: false,
    goalVersusObstacle: false,
    emotionalOrPhysiologicalVersusReasoningStandard: false,
    classification: "clear_contradiction",
    confidence: 0.86,
    evidenceClaimA: transportSelectionForSubstring(sideA.sourceText, quoteA),
    evidenceClaimB: transportSelectionForSubstring(sideB.sourceText, quoteB),
    rationale: "Incompatible propositions.",
    alternativeInterpretation: "Temporal change.",
    whatWouldChangeClassification: "Explicit time scope.",
    abstentionReason: null,
    proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
    ...overrides,
  } as ContradictionModelTransportResult;
}

function fakeRunner(result: ContradictionModelTransportResult | ContradictionModelResult): StructuredModelRunner {
  return {
    async runStructured() {
      return {
        ok: true as const,
        object: result,
        providerId: "test-fake",
        modelId: "test-fake-model",
        rawText: null,
      };
    },
  };
}

function countingReferee(
  evaluation: ObjectivityReferee["evaluate"] extends (...args: infer _A) => infer _R
    ? Awaited<ReturnType<ObjectivityReferee["evaluate"]>> | (() => never) | "throw" | "reject"
    : never,
): { referee: ObjectivityReferee; callCount: () => number } {
  let calls = 0;
  return {
    callCount: () => calls,
    referee: {
      async evaluate(input) {
        calls += 1;
        if (evaluation === "throw") {
          throw new Error("synchronous referee boom");
        }
        if (evaluation === "reject") {
          return Promise.reject(new Error("async referee boom"));
        }
        void input;
        return typeof evaluation === "function"
          ? (evaluation as () => never)()
          : evaluation;
      },
    },
  };
}

const sideA = source({
  sourceId: "ref-a",
  label: "A",
  sourceText: "I never drink alcohol on weeknights.",
});
const sideB = source({
  sourceId: "ref-b",
  label: "B",
  sourceText: "I drank whiskey last night after dinner.",
});

describe("Objectivity Referee interface — dependency gate", () => {
  it("1. exposes exactly five outcomes", () => {
    expect(OBJECTIVITY_REFEREE_OUTCOMES).toEqual([
      "PASS",
      "PASS_WITH_LOWER_CONFIDENCE",
      "ROUTE_TO_DIFFERENT_OBJECT_TYPE",
      "REQUEST_MORE_EVIDENCE",
      "ABSTAIN",
    ]);
  });

  it("2. default not_run blocks continuation", () => {
    const result = notRunObjectivityRefereeResult();
    expect(result.executionState).toBe("not_run");
    expect(result.outcome).toBeNull();
    expect(result.continuationAllowed).toBe(false);
    expect(refereeAllowsContinuation(result)).toBe(false);
    expect(objectivityRefereeResultToStatus(result)).toBe("not_run");
    expect(OBJECTIVITY_REFEREE_INTERFACE_VERSION).toBe(
      "objectivity-referee-interface-v1",
    );
  });

  it("3. valid PASS — completed, rationale preserved, continuation allowed, persistence still blocked", async () => {
    const { referee } = countingReferee({
      outcome: "PASS",
      rationale: "Evidence is sufficient and objective.",
    });
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(baseModelResult(sideA, sideB)),
      objectivityReferee: referee,
      now: FIXED_NOW,
    });

    expect(result.referee.executionState).toBe("completed");
    expect(result.referee.outcome).toBe("PASS");
    expect(result.referee.rationale).toBe("Evidence is sufficient and objective.");
    expect(result.referee.continuationAllowed).toBe(true);
    expect(result.refereeStatus).toBe("PASS");
    expect(result.persistenceDecision).toBeNull();
    expect(result.createCandidate).toBeUndefined();
  });

  it("4. valid PASS_WITH_LOWER_CONFIDENCE", async () => {
    const { referee } = countingReferee({
      outcome: "PASS_WITH_LOWER_CONFIDENCE",
      rationale: "Lower confidence warranted.",
      adjustedConfidence: 0.4,
    });
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(baseModelResult(sideA, sideB, { confidence: 0.86 })),
      objectivityReferee: referee,
      now: FIXED_NOW,
    });

    expect(result.referee.executionState).toBe("completed");
    expect(result.referee.outcome).toBe("PASS_WITH_LOWER_CONFIDENCE");
    expect(result.referee.adjustedConfidence).toBe(0.4);
    expect(result.referee.proposedConfidence).toBe(0.86);
    expect(result.referee.continuationAllowed).toBe(true);
    expect(result.persistenceDecision).toBeNull();
    expect(result.createCandidate).toBeUndefined();
  });

  it("5. PASS_WITH_LOWER_CONFIDENCE without adjusted confidence is invalid", () => {
    const validated = validateObjectivityRefereeEvaluation({
      evaluation: {
        outcome: "PASS_WITH_LOWER_CONFIDENCE",
        rationale: "missing confidence",
      },
      proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
      proposedConfidence: 0.8,
    });
    expect(validated.ok).toBe(false);
    expect(refereeAllowsContinuation({
      executionState: "invalid_evaluation",
      outcome: null,
      validationErrors: ["x"],
    })).toBe(false);
  });

  it("6. PASS_WITH_LOWER_CONFIDENCE equal/higher confidence is invalid", () => {
    expect(
      validateObjectivityRefereeEvaluation({
        evaluation: {
          outcome: "PASS_WITH_LOWER_CONFIDENCE",
          rationale: "not lower",
          adjustedConfidence: 0.86,
        },
        proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
        proposedConfidence: 0.86,
      }).ok,
    ).toBe(false);
    expect(
      validateObjectivityRefereeEvaluation({
        evaluation: {
          outcome: "PASS_WITH_LOWER_CONFIDENCE",
          rationale: "higher",
          adjustedConfidence: 0.99,
        },
        proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
        proposedConfidence: 0.86,
      }).ok,
    ).toBe(false);
  });

  it("7. PASS_WITH_LOWER_CONFIDENCE outside 0–1 or non-finite is invalid", () => {
    expect(
      validateObjectivityRefereeEvaluation({
        evaluation: {
          outcome: "PASS_WITH_LOWER_CONFIDENCE",
          rationale: "range",
          adjustedConfidence: 1.5,
        },
        proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
        proposedConfidence: 0.86,
      }).ok,
    ).toBe(false);
    expect(
      validateObjectivityRefereeEvaluation({
        evaluation: {
          outcome: "PASS_WITH_LOWER_CONFIDENCE",
          rationale: "nan",
          adjustedConfidence: Number.NaN,
        },
        proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
        proposedConfidence: 0.86,
      }).ok,
    ).toBe(false);
  });

  it("8. valid ROUTE_TO_DIFFERENT_OBJECT_TYPE blocks CN continuation", async () => {
    const { referee } = countingReferee({
      outcome: "ROUTE_TO_DIFFERENT_OBJECT_TYPE",
      rationale: "Looks like a PatternClaim instead.",
      routedObjectType: "PatternClaim",
    });
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(baseModelResult(sideA, sideB)),
      objectivityReferee: referee,
      now: FIXED_NOW,
    });
    expect(result.referee.executionState).toBe("completed");
    expect(result.referee.outcome).toBe("ROUTE_TO_DIFFERENT_OBJECT_TYPE");
    expect(result.referee.routedObjectType).toBe("PatternClaim");
    expect(result.referee.continuationAllowed).toBe(false);
  });

  it("9. ROUTE without routed type is invalid", () => {
    expect(
      validateObjectivityRefereeEvaluation({
        evaluation: {
          outcome: "ROUTE_TO_DIFFERENT_OBJECT_TYPE",
          rationale: "missing route",
        },
        proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
        proposedConfidence: 0.8,
      }).ok,
    ).toBe(false);
  });

  it("10. ROUTE to same normalised object type is invalid", () => {
    expect(
      validateObjectivityRefereeEvaluation({
        evaluation: {
          outcome: "ROUTE_TO_DIFFERENT_OBJECT_TYPE",
          rationale: "same type",
          routedObjectType: "contradiction_node",
        },
        proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
        proposedConfidence: 0.8,
      }).ok,
    ).toBe(false);
  });

  it("11. REQUEST_MORE_EVIDENCE is distinct and blocked", async () => {
    const { referee } = countingReferee({
      outcome: "REQUEST_MORE_EVIDENCE",
      rationale: "Need another episode.",
    });
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(baseModelResult(sideA, sideB)),
      objectivityReferee: referee,
      now: FIXED_NOW,
    });
    expect(result.referee.outcome).toBe("REQUEST_MORE_EVIDENCE");
    expect(result.referee.continuationAllowed).toBe(false);
    expect(result.refereeStatus).toBe("REQUEST_MORE_EVIDENCE");
  });

  it("12. ABSTAIN is distinct and blocked", async () => {
    const { referee } = countingReferee({
      outcome: "ABSTAIN",
      rationale: "Cannot objectively support CN.",
    });
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(baseModelResult(sideA, sideB)),
      objectivityReferee: referee,
      now: FIXED_NOW,
    });
    expect(result.referee.outcome).toBe("ABSTAIN");
    expect(result.referee.continuationAllowed).toBe(false);
  });

  it("13. blank rationale is invalid for every outcome", () => {
    for (const outcome of OBJECTIVITY_REFEREE_OUTCOMES) {
      const evaluation: Record<string, unknown> = {
        outcome,
        rationale: "   ",
      };
      if (outcome === "PASS_WITH_LOWER_CONFIDENCE") {
        evaluation.adjustedConfidence = 0.1;
      }
      if (outcome === "ROUTE_TO_DIFFERENT_OBJECT_TYPE") {
        evaluation.routedObjectType = "PatternClaim";
      }
      expect(
        validateObjectivityRefereeEvaluation({
          evaluation,
          proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
          proposedConfidence: 0.9,
        }).ok,
        outcome,
      ).toBe(false);
    }
  });

  it("14. unknown outcome is invalid and blocked", async () => {
    const { referee } = countingReferee({
      outcome: "PASS_HARD" as never,
      rationale: "unknown",
    });
    const result = await runObjectivityRefereeSafely({
      referee,
      input: {
        proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
        validatedSemanticResult: {},
        evidenceSummary: "x",
        confidence: 0.5,
        alternativeInterpretation: "y",
        qualificationContext: "z",
        validationWarnings: [],
      },
    });
    expect(result.executionState).toBe("invalid_evaluation");
    expect(result.continuationAllowed).toBe(false);
    expect(objectivityRefereeResultToStatus(result)).toBe("invalid_evaluation");
  });

  it("15. referee throws synchronously — attempted failure, blocked, no crash into persistence", async () => {
    const { referee, callCount } = countingReferee("throw");
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(baseModelResult(sideA, sideB)),
      objectivityReferee: referee,
      now: FIXED_NOW,
    });
    expect(callCount()).toBe(1);
    expect(result.outcome).toBe("semantic_accepted");
    expect(result.referee.executionState).toBe("failed");
    expect(result.referee.outcome).toBeNull();
    expect(result.referee.continuationAllowed).toBe(false);
    expect(result.refereeStatus).toBe("execution_failed");
    expect(result.refereeStatus).not.toBe("not_run");
    expect(result.refereeStatus).not.toBe("PASS");
    expect(result.persistenceDecision).toBeNull();
    expect(result.createCandidate).toBeUndefined();
  });

  it("16. referee rejects asynchronously — attempted failure, blocked", async () => {
    const { referee } = countingReferee("reject");
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(baseModelResult(sideA, sideB)),
      objectivityReferee: referee,
      now: FIXED_NOW,
    });
    expect(result.referee.executionState).toBe("failed");
    expect(result.referee.continuationAllowed).toBe(false);
    expect(result.refereeStatus).toBe("execution_failed");
  });

  it("17. malformed object — invalid evaluation, blocked", async () => {
    const { referee } = countingReferee(null as never);
    const result = await runObjectivityRefereeSafely({
      referee,
      input: {
        proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
        validatedSemanticResult: {},
        evidenceSummary: "x",
        confidence: 0.5,
        alternativeInterpretation: "y",
        qualificationContext: "z",
        validationWarnings: [],
      },
    });
    expect(result.executionState).toBe("invalid_evaluation");
    expect(result.continuationAllowed).toBe(false);
  });

  it("18. no referee supplied — not_run, blocked", async () => {
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(baseModelResult(sideA, sideB)),
      now: FIXED_NOW,
    });
    expect(result.referee.executionState).toBe("not_run");
    expect(result.referee.continuationAllowed).toBe(false);
    expect(result.refereeStatus).toBe("not_run");
  });

  it("19. invalid semantic output — referee call count zero", async () => {
    const { referee, callCount } = countingReferee({
      outcome: "PASS",
      rationale: "should not run",
    });
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          classification: "clear_contradiction",
          bothCanSimultaneouslyBeTrue: true,
        }),
      ),
      objectivityReferee: referee,
      now: FIXED_NOW,
    });
    expect(result.outcome).toBe("validation_failed");
    expect(callCount()).toBe(0);
    expect(result.referee.executionState).toBe("not_run");
  });

  it("20. invalid evidence offsets — referee call count zero (CEQR-016)", async () => {
    const { referee, callCount } = countingReferee({
      outcome: "PASS",
      rationale: "should not run",
    });
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(
        baseModelResult(sideA, sideB, {
          evidenceClaimA: {
            startBoundaryIndex: 0,
            endBoundaryIndex: 999,
          },
        }),
      ),
      objectivityReferee: referee,
      now: FIXED_NOW,
    });
    expect(result.outcome).toBe("validation_failed");
    expect(callCount()).toBe(0);
  });

  it("21–23. Class B/C/D + fake PASS — no ContradictionNode semantic selection", async () => {
    const cases = [
      "plausible_unresolved_tension",
      "compatible_states",
      "insufficient_or_misaligned_context",
    ] as const;

    for (const classification of cases) {
      const { referee, callCount } = countingReferee({
        outcome: "PASS",
        rationale: "fake pass cannot upgrade",
      });
      const adjudication = await adjudicateContradiction({
        sideA,
        sideB,
        modelRunner: fakeRunner(
          baseModelResult(sideA, sideB, {
            classification,
            bothCanSimultaneouslyBeTrue: true,
            ...(classification === "plausible_unresolved_tension"
              ? { goalVersusObstacle: true }
              : {}),
            ...(classification === "compatible_states"
              ? { emotionalOrPhysiologicalVersusReasoningStandard: true }
              : {}),
          }),
        ),
        objectivityReferee: referee,
        now: FIXED_NOW,
      });

      // Referee is not invoked for non-Class-A CN proposals.
      expect(callCount(), classification).toBe(0);
      expect(adjudication.referee.executionState, classification).toBe("not_run");
      expect(adjudication.semantic?.classification, classification).toBe(
        classification,
      );

      const selection = await selectSameSessionContradictionPair({
        sideB,
        sideACandidates: [{ sideA, referenceId: `ref-${classification}` }],
        modelRunner: fakeRunner(
          baseModelResult(sideA, sideB, {
            classification,
            bothCanSimultaneouslyBeTrue: true,
            ...(classification === "plausible_unresolved_tension"
              ? { goalVersusObstacle: true }
              : {}),
            ...(classification === "compatible_states"
              ? { emotionalOrPhysiologicalVersusReasoningStandard: true }
              : {}),
          }),
        ),
        objectivityReferee: referee,
        now: FIXED_NOW,
      });
      expect(selection.selectedPair, classification).toBeNull();
      expect(selection.eligibleCount, classification).toBe(0);
      expect(selection.persistable, classification).toBe(false);
    }
  });

  it("24. Valid Class A + PASS — semantic inspectable; continuation may be true; persistence blocked", async () => {
    const { referee } = countingReferee({
      outcome: "PASS",
      rationale: "Clear contradiction is objective.",
    });
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(baseModelResult(sideA, sideB)),
      objectivityReferee: referee,
      now: FIXED_NOW,
    });
    expect(result.semantic?.classification).toBe("clear_contradiction");
    expect(result.referee.continuationAllowed).toBe(true);
    expect(result.persistenceDecision).toBeNull();
    expect(result.createCandidate).toBeUndefined();

    const selection = await selectSameSessionContradictionPair({
      sideB,
      sideACandidates: [{ sideA, referenceId: "ref-pass" }],
      modelRunner: fakeRunner(baseModelResult(sideA, sideB)),
      objectivityReferee: referee,
      now: FIXED_NOW,
    });
    expect(selection.outcome).toBe("selected");
    expect(selection.refereeContinuationAllowed).toBe(true);
    expect(selection.persistable).toBe(false);
    expect(selection.persistenceAuthorised).toBe(false);
  });

  it("25. Valid Class A + PASS_WITH_LOWER_CONFIDENCE — adjusted confidence inspectable; persistence blocked", async () => {
    const { referee } = countingReferee({
      outcome: "PASS_WITH_LOWER_CONFIDENCE",
      rationale: "Lower.",
      adjustedConfidence: 0.35,
    });
    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: fakeRunner(baseModelResult(sideA, sideB)),
      objectivityReferee: referee,
      now: FIXED_NOW,
    });
    expect(result.referee.adjustedConfidence).toBe(0.35);
    expect(result.persistenceDecision).toBeNull();
  });

  it("26. Valid Class A + ROUTE/REQUEST/ABSTAIN — inspectable; continuation blocked; persistence blocked", async () => {
    for (const evaluation of [
      {
        outcome: "ROUTE_TO_DIFFERENT_OBJECT_TYPE" as const,
        rationale: "route",
        routedObjectType: "PatternClaim",
      },
      {
        outcome: "REQUEST_MORE_EVIDENCE" as const,
        rationale: "more evidence",
      },
      {
        outcome: "ABSTAIN" as const,
        rationale: "abstain",
      },
    ]) {
      const { referee } = countingReferee(evaluation);
      const result = await adjudicateContradiction({
        sideA,
        sideB,
        modelRunner: fakeRunner(baseModelResult(sideA, sideB)),
        objectivityReferee: referee,
        now: FIXED_NOW,
      });
      expect(result.referee.outcome).toBe(evaluation.outcome);
      expect(result.referee.continuationAllowed).toBe(false);
      expect(result.persistenceDecision).toBeNull();
    }
  });

  it("27. Multiple Class A — ambiguity; no selected pair; no referee-based winner; no fan-out", async () => {
    const a1 = source({
      sourceId: "multi-1",
      label: "m1",
      sourceText: "I never drink alcohol on weeknights.",
    });
    const a2 = source({
      sourceId: "multi-2",
      label: "m2",
      sourceText: "I do not drink spirits after dinner.",
    });
    let refereeCalls = 0;
    const referee: ObjectivityReferee = {
      evaluate() {
        refereeCalls += 1;
        return {
          outcome: "PASS",
          rationale: "cannot choose a winner",
        };
      },
    };

    const selection = await selectSameSessionContradictionPair({
      sideB,
      sideACandidates: [
        { sideA: a1, referenceId: "r1" },
        { sideA: a2, referenceId: "r2" },
      ],
      modelRunner: {
        async runStructured({ prompt }) {
          const id = /Side A sourceId: ([^\n]+)/.exec(prompt)?.[1]?.trim() ?? "";
          const unit = id === "multi-1" ? a1 : a2;
          return {
            ok: true as const,
            object: baseModelResult(unit, sideB),
            providerId: "test-fake",
            modelId: "test-fake-model",
            rawText: null,
          };
        },
      },
      objectivityReferee: referee,
      now: FIXED_NOW,
    });

    expect(selection.outcome).toBe("ambiguous_multiple_matches");
    expect(selection.selectedPair).toBeNull();
    expect(selection.eligibleCount).toBe(2);
    expect(selection.persistable).toBe(false);
    // Referee may run per Class A adjudication, but cannot force a winner.
    expect(refereeCalls).toBeGreaterThan(0);
    expect(selection.refereeContinuationAllowed).toBe(false);
  });

  it("28. Cross-session source — excluded before adjudication; no model/referee for that source", async () => {
    const cross = source({
      sourceId: "cross",
      sessionId: "other-session",
      label: "cross",
      sourceText: "I never drink alcohol on weeknights.",
    });
    let modelCalls = 0;
    let refereeCalls = 0;
    const selection = await selectSameSessionContradictionPair({
      sideB,
      sideACandidates: [{ sideA: cross, referenceId: "cross-ref" }],
      modelRunner: {
        async runStructured() {
          modelCalls += 1;
          return {
            ok: true as const,
            object: baseModelResult(cross, sideB),
            providerId: "test-fake",
            modelId: "test-fake-model",
            rawText: null,
          };
        },
      },
      objectivityReferee: {
        evaluate() {
          refereeCalls += 1;
          return { outcome: "PASS", rationale: "should not run" };
        },
      },
      now: FIXED_NOW,
    });
    expect(selection.outcome).toBe("no_same_session_sources");
    expect(modelCalls).toBe(0);
    expect(refereeCalls).toBe(0);
    expect(selection.selectedPair).toBeNull();
  });

  it("29. Fake referee PASS cannot bypass missing source provenance", async () => {
    // Selection eligibility requires source-complete same-session units.
    // A PASS referee supplied to an empty pool cannot invent a pair.
    const { referee, callCount } = countingReferee({
      outcome: "PASS",
      rationale: "cannot invent provenance",
    });
    const selection = await selectSameSessionContradictionPair({
      sideB,
      sideACandidates: [],
      modelRunner: fakeRunner(baseModelResult(sideA, sideB)),
      objectivityReferee: referee,
      now: FIXED_NOW,
    });
    expect(selection.selectedPair).toBeNull();
    expect(callCount()).toBe(0);
    expect(selection.persistable).toBe(false);
  });

  it("30. Type contract — referee result is not DetectedContradiction; no createCandidate; no materialisation", () => {
    const result = notRunObjectivityRefereeResult();
    expect("title" in result).toBe(false);
    expect("sideA" in result).toBe(false);
    expect("type" in result).toBe(false);
    expect(result.continuationAllowed).toBe(false);

    const adjudicator = readFileSync(
      join(process.cwd(), "lib/contradiction-adjudicator.ts"),
      "utf8",
    );
    const refereeModule = readFileSync(
      join(process.cwd(), "lib/orvek-intelligence-kernel/objectivity-referee.ts"),
      "utf8",
    );
    expect(adjudicator).not.toMatch(/from ["'].*contradiction-materialization["']/);
    expect(refereeModule).not.toMatch(/materializeContradictions/);
    expect(refereeModule).not.toMatch(/openai|@ai-sdk|anthropic/i);
    expect(KERNEL_CONTRACT_VERSION).toBe("orvek-intelligence-kernel-v1");
  });
});
