/**
 * CONTRADICTION-PERSISTENCE-WIRING-001 — pure persistence-plan gate tests.
 * Semantic authority = SemanticallySelectedContradictionPair.
 * No Prisma. No network. No DB writes. No materialisation.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { ContradictionAdjudicationResult } from "../contradiction-adjudicator";
import {
  CONTRADICTION_DUAL_SIDE_LINEAGE_VERSION,
  type DualSideLineageResult,
  type ValidatedDualSideLineage,
} from "../contradiction-dual-side-lineage";
import {
  CONTRADICTION_CONFIDENCE_POLICY_VERSION,
  calibrateContradictionConfidence,
  type ContradictionConfidenceCalibrationResult,
} from "../contradiction-confidence-calibration";
import type { SemanticallySelectedContradictionPair } from "../contradiction-same-session-selection";
import {
  CONTRADICTION_PERSISTENCE_PLAN_VERSION,
  CONTRADICTION_PERSISTENCE_TITLE_MAX_LENGTH,
  assertAuthorisedContradictionPersistencePlan,
  buildContradictionPersistencePlan,
  buildDeterministicContradictionPersistenceTitle,
  type ContradictionPersistencePlanInput,
} from "../contradiction-persistence-plan";
import {
  OBJECTIVITY_REFEREE_INTERFACE_VERSION,
  type KernelSourceUnit,
  type ObjectivityRefereeResult,
} from "../orvek-intelligence-kernel";
import type { ExactEvidenceClaim } from "../orvek-intelligence-kernel/types";

const USER = "user-kay";
const SESSION = "session-1";
const MSG_A = "message-a";
const MSG_B = "message-b";
const QUOTE_A = "I never drink alcohol";
const QUOTE_B = "I drank last night";
const PROP_A = "Speaker never drinks alcohol";
const PROP_B = "Speaker drank alcohol last night";

function sha(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function source(
  partial: Partial<KernelSourceUnit> &
    Pick<KernelSourceUnit, "sourceId" | "sourceText" | "label">,
): KernelSourceUnit {
  return {
    sessionId: partial.sessionId ?? SESSION,
    messageId: partial.messageId ?? `message-${partial.sourceId}`,
    sourceRole: partial.sourceRole ?? "user",
    sourceType: partial.sourceType ?? "goal",
    existingObjectId: partial.existingObjectId ?? null,
    ...partial,
  };
}

function claimAt(
  sourceUnit: KernelSourceUnit,
  exactQuote: string,
  startOffset: number,
): ExactEvidenceClaim {
  return {
    sourceId: sourceUnit.sourceId,
    exactQuote,
    startOffset,
    endOffset: startOffset + exactQuote.length,
  };
}

function refereePass(
  overrides: Partial<ObjectivityRefereeResult> = {},
): ObjectivityRefereeResult {
  return {
    interfaceVersion: OBJECTIVITY_REFEREE_INTERFACE_VERSION,
    executionState: "completed",
    outcome: "PASS",
    rationale: "Objectively a clear contradiction.",
    proposedObjectType: "ContradictionNode",
    proposedConfidence: 0.86,
    adjustedConfidence: null,
    routedObjectType: null,
    validationErrors: [],
    continuationAllowed: true,
    errorMessage: null,
    ...overrides,
  };
}

function buildAdjudication(args: {
  sideA: KernelSourceUnit;
  sideB: KernelSourceUnit;
  claimA: ExactEvidenceClaim;
  claimB: ExactEvidenceClaim;
  referee?: ObjectivityRefereeResult;
  normalizedA?: string;
  normalizedB?: string;
  classification?: "clear_contradiction" | "compatible_states";
  outcome?: ContradictionAdjudicationResult["outcome"];
  validationStatus?: "valid" | "invalid";
}): ContradictionAdjudicationResult {
  const classification = args.classification ?? "clear_contradiction";
  const outcome = args.outcome ?? "semantic_accepted";
  const validationStatus = args.validationStatus ?? "valid";
  const semantic =
    outcome === "semantic_accepted"
      ? {
          propositionA: {
            normalizedProposition: args.normalizedA ?? PROP_A,
            actor: "speaker",
            subject: "alcohol",
            timeframe: "general",
            negation: true,
            modality: "assertive",
            qualifications: "none",
          },
          propositionB: {
            normalizedProposition: args.normalizedB ?? PROP_B,
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
          classification,
          confidence: 0.86,
          evidenceClaimA: args.claimA,
          evidenceClaimB: args.claimB,
          rationale: "Incompatible.",
          alternativeInterpretation: "Temporal change.",
          whatWouldChangeClassification: "Scoped belief change.",
          abstentionReason: null,
          proposedObjectType: "ContradictionNode",
        }
      : null;

  return {
    outcome,
    semantic,
    validation: {
      status: validationStatus,
      errors: validationStatus === "valid" ? [] : ["simulated"],
      warnings: [],
    },
    refereeStatus: args.referee?.outcome ?? "PASS",
    referee: args.referee ?? refereePass(),
    audit: {
      processorVersion: "test",
      kernelContractVersion: "test",
      schemaVersion: "test",
      promptVersion: "test",
      providerId: "test-fake",
      modelId: "test-fake-model",
      sourceIds: [args.sideA.sourceId, args.sideB.sourceId],
      executedAt: "2026-07-21T00:00:00.000Z",
      parseValidationOutcome: validationStatus,
      semanticClassification: classification,
      abstentionOrErrorCode: null,
      refereeStatus: args.referee?.outcome ?? "PASS",
    },
    abstentionReason: null,
    errorCode: null,
    errorMessage: null,
    persistenceDecision: null,
    createCandidate: undefined,
  };
}

function makeSelectedPair(overrides?: {
  sideASourceType?: string;
  normalizedA?: string;
  normalizedB?: string;
  claimAQuote?: string;
  claimAStart?: number;
  claimBQuote?: string;
  claimBStart?: number;
  sideASourceId?: string;
  sideBMessageId?: string;
  sideASessionId?: string;
  referee?: ObjectivityRefereeResult;
}): {
  selectedPair: SemanticallySelectedContradictionPair;
  sideA: KernelSourceUnit;
  sideB: KernelSourceUnit;
  claimA: ExactEvidenceClaim;
  claimB: ExactEvidenceClaim;
} {
  const sideA = source({
    sourceId: overrides?.sideASourceId ?? "src-a",
    sourceText: QUOTE_A,
    label: "Side A",
    messageId: MSG_A,
    sourceType: overrides?.sideASourceType ?? "goal",
    sessionId: overrides?.sideASessionId ?? SESSION,
  });
  const sideB = source({
    sourceId: "src-b",
    sourceText: `Preface. ${QUOTE_B}`,
    label: "Side B",
    messageId: overrides?.sideBMessageId ?? MSG_B,
    sourceType: "message",
  });
  const quoteA = overrides?.claimAQuote ?? QUOTE_A;
  const startA = overrides?.claimAStart ?? 0;
  const quoteB = overrides?.claimBQuote ?? QUOTE_B;
  const startB = overrides?.claimBStart ?? "Preface. ".length;
  const claimA = claimAt(sideA, quoteA, startA);
  const claimB = claimAt(sideB, quoteB, startB);
  const selectedPair: SemanticallySelectedContradictionPair = {
    sideA,
    sideB,
    referenceId: "ref-1",
    semanticallySelected: true,
    persistable: false,
    persistenceAuthorised: false,
    adjudication: buildAdjudication({
      sideA,
      sideB,
      claimA,
      claimB,
      normalizedA: overrides?.normalizedA,
      normalizedB: overrides?.normalizedB,
      referee: overrides?.referee,
    }),
  };
  return { selectedPair, sideA, sideB, claimA, claimB };
}

function makeLineageFromPair(
  selectedPair: SemanticallySelectedContradictionPair,
  overrides: Partial<ValidatedDualSideLineage> = {},
): ValidatedDualSideLineage {
  const claimA = selectedPair.adjudication.semantic!.evidenceClaimA!;
  const claimB = selectedPair.adjudication.semantic!.evidenceClaimB!;
  const hashA = sha(claimA.exactQuote);
  const hashB = sha(claimB.exactQuote);
  return {
    lineageContractVersion: CONTRADICTION_DUAL_SIDE_LINEAGE_VERSION,
    userId: USER,
    sessionId: SESSION,
    sideA: {
      role: "A",
      sourceId: selectedPair.sideA.sourceId,
      sessionId: SESSION,
      messageId: selectedPair.sideA.messageId!,
      exactQuote: claimA.exactQuote,
      startOffset: claimA.startOffset,
      endOffset: claimA.endOffset,
      contentHash: hashA,
    },
    sideB: {
      role: "B",
      sourceId: selectedPair.sideB.sourceId,
      sessionId: SESSION,
      messageId: selectedPair.sideB.messageId!,
      exactQuote: claimB.exactQuote,
      startOffset: claimB.startOffset,
      endOffset: claimB.endOffset,
      contentHash: hashB,
    },
    refereeOutcome: "PASS",
    adjustedConfidence: null,
    spanEnsureDescriptors: {
      sideA: {
        userId: USER,
        messageId: selectedPair.sideA.messageId!,
        charStart: claimA.startOffset,
        charEnd: claimA.endOffset,
        contentHash: hashA,
      },
      sideB: {
        userId: USER,
        messageId: selectedPair.sideB.messageId!,
        charStart: claimB.startOffset,
        charEnd: claimB.endOffset,
        contentHash: hashB,
      },
    },
    ...overrides,
  };
}

function lineageSuccess(
  lineage: ValidatedDualSideLineage,
): DualSideLineageResult {
  return {
    ok: true,
    lineageReadyForPersistenceGate: true,
    continuationReady: true,
    validatedDualSideLineage: lineage,
    persistable: false,
    persistenceAuthorised: false,
    createCandidate: undefined,
    persistenceDecision: null,
  };
}

function confidenceAboveFloor(
  modelReportedConfidence = 0.72,
  refereeOutcome: "PASS" | "PASS_WITH_LOWER_CONFIDENCE" = "PASS",
  refereeAdjustedConfidence: number | null = null,
): ContradictionConfidenceCalibrationResult {
  return calibrateContradictionConfidence({
    modelReportedConfidence,
    adjudicationOutcome: "semantic_accepted",
    deterministicValidationStatus: "valid",
    semanticPresent: true,
    semanticClassification: "clear_contradiction",
    refereeExecutionState: "completed",
    refereeOutcome,
    refereeAdjustedConfidence,
    refereeValidationErrors: [],
    refereeContinuationAllowed: true,
  });
}

function validInput(
  overrides: Partial<ContradictionPersistencePlanInput> = {},
): ContradictionPersistencePlanInput {
  const { selectedPair } = makeSelectedPair();
  return {
    selectedPair,
    lineageResult: lineageSuccess(makeLineageFromPair(selectedPair)),
    confidenceResult: confidenceAboveFloor(),
    ...overrides,
  };
}

describe("CONTRADICTION-PERSISTENCE-WIRING-001 persistence plan gate", () => {
  describe("module boundary", () => {
    it("does not import Prisma, materialisation, or writers", () => {
      const sourceText = readFileSync(
        join(process.cwd(), "lib/contradiction-persistence-plan.ts"),
        "utf8",
      );
      expect(sourceText).not.toMatch(/from ["']@prisma\/client["']/);
      expect(sourceText).not.toMatch(/from ["'].*prismadb["']/);
      expect(sourceText).not.toMatch(/materializeContradictions/);
      expect(sourceText).not.toMatch(/from ["'].*derivation-layer["']/);
      expect(sourceText).not.toMatch(/contradictionNode\.(create|update)/);
      expect(sourceText).not.toMatch(/from ["'].*contradiction-detection["']/);
    });
  });

  describe("semantic binding authorisation", () => {
    it("authorises from valid selected pair + matching lineage + confidence", () => {
      const result = buildContradictionPersistencePlan(validInput());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.plan.sideAProposition).toBe(PROP_A);
      expect(result.plan.sideBProposition).toBe(PROP_B);
      expect(result.plan.contradictionType).toBe("goal_behavior_gap");
      expect(result.plan.title).toBe(`${PROP_A} ↔ ${PROP_B}`);
      expect(result.plan.persistedSourceMessageId).toBeNull();
      expect(result.plan.persistedSourceSessionId).toBe(SESSION);
      expect(result.plan.sideBTriggerMessageId).toBe(MSG_B);
      expect(result.plan.sourceMetadata.titleIsDeterministicDisplayLabel).toBe(
        true,
      );
    });

    it("authorises at exact floor 0.50", () => {
      const result = buildContradictionPersistencePlan(
        validInput({ confidenceResult: confidenceAboveFloor(0.5) }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.plan.effectiveConfidence).toBe(0.5);
    });

    it("blocks a different selected pair against an otherwise valid lineage", () => {
      const { selectedPair: pairA } = makeSelectedPair();
      const { selectedPair: pairB } = makeSelectedPair({
        sideASourceId: "other-src-a",
      });
      const result = buildContradictionPersistencePlan({
        selectedPair: pairB,
        lineageResult: lineageSuccess(makeLineageFromPair(pairA)),
        confidenceResult: confidenceAboveFloor(),
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("selected_pair_lineage_mismatch_a");
    });

    it("blocks Side A source mismatch", () => {
      const { selectedPair } = makeSelectedPair();
      const lineage = makeLineageFromPair(selectedPair);
      lineage.sideA = { ...lineage.sideA, sourceId: "tampered" };
      const result = buildContradictionPersistencePlan({
        selectedPair,
        lineageResult: lineageSuccess(lineage),
        confidenceResult: confidenceAboveFloor(),
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("selected_pair_lineage_mismatch_a");
    });

    it("blocks Side B source mismatch", () => {
      const { selectedPair } = makeSelectedPair();
      const lineage = makeLineageFromPair(selectedPair);
      lineage.sideB = { ...lineage.sideB, sourceId: "tampered-b" };
      const result = buildContradictionPersistencePlan({
        selectedPair,
        lineageResult: lineageSuccess(lineage),
        confidenceResult: confidenceAboveFloor(),
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("selected_pair_lineage_mismatch_b");
    });

    it("blocks evidence-claim quote mismatch", () => {
      const { selectedPair } = makeSelectedPair({
        claimAQuote: "different quote text",
      });
      // Build lineage from original quotes so claim/lineage diverge.
      const { selectedPair: original } = makeSelectedPair();
      const result = buildContradictionPersistencePlan({
        selectedPair,
        lineageResult: lineageSuccess(makeLineageFromPair(original)),
        confidenceResult: confidenceAboveFloor(),
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("selected_pair_lineage_mismatch_a");
    });

    it("blocks offset mismatch", () => {
      const { selectedPair } = makeSelectedPair({ claimAStart: 1 });
      const { selectedPair: original } = makeSelectedPair();
      const result = buildContradictionPersistencePlan({
        selectedPair,
        lineageResult: lineageSuccess(makeLineageFromPair(original)),
        confidenceResult: confidenceAboveFloor(),
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("selected_pair_lineage_mismatch_a");
    });

    it("makes normalized-proposition caller override impossible", () => {
      const input = validInput();
      const forged = {
        ...input,
        semantic: {
          sideAProposition: "CALLER FORGED A",
          sideBProposition: "CALLER FORGED B",
          title: "forged",
          contradictionType: "belief_conflict",
          classification: "clear_contradiction",
        },
      } as ContradictionPersistencePlanInput & { semantic: unknown };
      const result = buildContradictionPersistencePlan(forged);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.plan.sideAProposition).toBe(PROP_A);
      expect(result.plan.sideBProposition).toBe(PROP_B);
      expect(result.plan.sideAProposition).not.toBe("CALLER FORGED A");
      expect(result.plan.contradictionType).not.toBe("belief_conflict");
    });

    it("blocks referee mismatch across selected pair, lineage, and confidence", () => {
      const { selectedPair } = makeSelectedPair({
        referee: refereePass({
          outcome: "PASS_WITH_LOWER_CONFIDENCE",
          adjustedConfidence: 0.6,
        }),
      });
      const lineage = makeLineageFromPair(selectedPair, {
        refereeOutcome: "PASS",
      });
      const result = buildContradictionPersistencePlan({
        selectedPair,
        lineageResult: lineageSuccess(lineage),
        confidenceResult: confidenceAboveFloor(),
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("selected_pair_referee_mismatch");
    });

    it("blocks confidence referee mismatch against selected pair", () => {
      const { selectedPair } = makeSelectedPair();
      const confidence = confidenceAboveFloor(0.72, "PASS_WITH_LOWER_CONFIDENCE", 0.6);
      const result = buildContradictionPersistencePlan({
        selectedPair,
        lineageResult: lineageSuccess(makeLineageFromPair(selectedPair)),
        confidenceResult: confidence,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("selected_pair_confidence_contract_mismatch");
    });
  });

  describe("derived fields", () => {
    it("derives propositions only from adjudication semantics", () => {
      const { selectedPair } = makeSelectedPair({
        normalizedA: "Custom proposition A",
        normalizedB: "Custom proposition B",
      });
      const result = buildContradictionPersistencePlan({
        selectedPair,
        lineageResult: lineageSuccess(makeLineageFromPair(selectedPair)),
        confidenceResult: confidenceAboveFloor(),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.plan.sideAProposition).toBe("Custom proposition A");
      expect(result.plan.sideBProposition).toBe("Custom proposition B");
    });

    it("builds a deterministic bounded title", () => {
      const short = buildDeterministicContradictionPersistenceTitle("A", "B");
      expect(short).toBe("A ↔ B");
      const longA = "a".repeat(200);
      const longB = "b".repeat(200);
      const long = buildDeterministicContradictionPersistenceTitle(longA, longB);
      expect(long.length).toBe(CONTRADICTION_PERSISTENCE_TITLE_MAX_LENGTH);
      expect(long.endsWith("…")).toBe(true);
      expect(
        buildDeterministicContradictionPersistenceTitle(longA, longB),
      ).toBe(long);
    });

    it("derives goal_behavior_gap from Side A sourceType goal", () => {
      const { selectedPair } = makeSelectedPair({ sideASourceType: "goal" });
      const result = buildContradictionPersistencePlan({
        selectedPair,
        lineageResult: lineageSuccess(makeLineageFromPair(selectedPair)),
        confidenceResult: confidenceAboveFloor(),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.plan.contradictionType).toBe("goal_behavior_gap");
    });

    it("derives constraint_conflict from Side A sourceType constraint", () => {
      const { selectedPair } = makeSelectedPair({
        sideASourceType: "constraint",
      });
      const result = buildContradictionPersistencePlan({
        selectedPair,
        lineageResult: lineageSuccess(makeLineageFromPair(selectedPair)),
        confidenceResult: confidenceAboveFloor(),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.plan.contradictionType).toBe("constraint_conflict");
    });

    it("blocks missing source type", () => {
      const { selectedPair } = makeSelectedPair();
      delete (selectedPair.sideA as { sourceType?: string }).sourceType;
      const result = buildContradictionPersistencePlan({
        selectedPair,
        lineageResult: lineageSuccess(makeLineageFromPair(selectedPair)),
        confidenceResult: confidenceAboveFloor(),
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("missing_source_type");
    });

    it("blocks unsupported source type", () => {
      const { selectedPair } = makeSelectedPair({
        sideASourceType: "preference",
      });
      const result = buildContradictionPersistencePlan({
        selectedPair,
        lineageResult: lineageSuccess(makeLineageFromPair(selectedPair)),
        confidenceResult: confidenceAboveFloor(),
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("unsupported_source_type");
    });

    it("ignores caller type override fields on the input object", () => {
      const input = {
        ...validInput(),
        contradictionType: "belief_conflict",
        type: "belief_conflict",
      } as ContradictionPersistencePlanInput;
      const result = buildContradictionPersistencePlan(input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.plan.contradictionType).toBe("goal_behavior_gap");
    });
  });

  describe("fail-closed upstream cases", () => {
    it("blocks at 0.49 below candidate floor", () => {
      const result = buildContradictionPersistencePlan(
        validInput({ confidenceResult: confidenceAboveFloor(0.49) }),
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("below_candidate_floor");
    });

    it("blocks when referee-lowered score falls below floor", () => {
      const { selectedPair } = makeSelectedPair({
        referee: refereePass({
          outcome: "PASS_WITH_LOWER_CONFIDENCE",
          adjustedConfidence: 0.4,
        }),
      });
      const lineage = makeLineageFromPair(selectedPair, {
        refereeOutcome: "PASS_WITH_LOWER_CONFIDENCE",
        adjustedConfidence: 0.4,
      });
      const result = buildContradictionPersistencePlan({
        selectedPair,
        lineageResult: lineageSuccess(lineage),
        confidenceResult: confidenceAboveFloor(
          0.72,
          "PASS_WITH_LOWER_CONFIDENCE",
          0.4,
        ),
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("below_candidate_floor");
    });

    it("blocks lineage not successful", () => {
      const result = buildContradictionPersistencePlan(
        validInput({
          lineageResult: {
            ok: false,
            lineageReadyForPersistenceGate: false,
            continuationReady: false,
            code: "cross_session",
            message: "cross session",
            persistable: false,
            persistenceAuthorised: false,
            createCandidate: undefined,
            persistenceDecision: null,
          },
        }),
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("lineage_not_successful");
    });

    it("leaves upstream non-persistence flags unchanged on success", () => {
      const input = validInput();
      const result = buildContradictionPersistencePlan(input);
      expect(result.ok).toBe(true);
      expect(input.selectedPair.persistable).toBe(false);
      expect(input.selectedPair.persistenceAuthorised).toBe(false);
      expect(input.lineageResult.persistable).toBe(false);
      expect(input.confidenceResult.persistable).toBe(false);
    });

    it("blocks identical Side A and Side B descriptors", () => {
      const { selectedPair } = makeSelectedPair({
        claimBQuote: QUOTE_A,
        claimBStart: 0,
        sideBMessageId: MSG_A,
      });
      // Force identical lineage descriptors.
      selectedPair.sideB = {
        ...selectedPair.sideB,
        messageId: MSG_A,
        sourceText: QUOTE_A,
      };
      selectedPair.adjudication.semantic!.evidenceClaimB = claimAt(
        selectedPair.sideB,
        QUOTE_A,
        0,
      );
      const lineage = makeLineageFromPair(selectedPair);
      // Make descriptors identical by copying Side A onto Side B after build.
      lineage.sideB = { ...lineage.sideA, role: "B", sourceId: lineage.sideA.sourceId };
      lineage.spanEnsureDescriptors.sideB = {
        ...lineage.spanEnsureDescriptors.sideA,
      };
      // Also align selected pair claim to the identical lineage so bind passes type-wise
      // but identical descriptor check fails.
      selectedPair.sideB = { ...selectedPair.sideA, sourceId: selectedPair.sideA.sourceId };
      selectedPair.adjudication.semantic!.evidenceClaimB = {
        ...selectedPair.adjudication.semantic!.evidenceClaimA!,
      };
      const result = buildContradictionPersistencePlan({
        selectedPair,
        lineageResult: lineageSuccess(lineage),
        confidenceResult: confidenceAboveFloor(),
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect([
        "identical_side_descriptors",
        "selected_pair_lineage_mismatch_b",
      ]).toContain(result.code);
    });
  });

  describe("plan identity (WeakSet)", () => {
    it("accepts a legitimate untouched minted plan", () => {
      const built = buildContradictionPersistencePlan(validInput());
      expect(built.ok).toBe(true);
      if (!built.ok) return;
      const check = assertAuthorisedContradictionPersistencePlan(built.plan);
      expect(check.ok).toBe(true);
    });

    it("rejects a handmade plan without WeakSet membership", () => {
      const check = assertAuthorisedContradictionPersistencePlan({
        persistenceContractVersion: CONTRADICTION_PERSISTENCE_PLAN_VERSION,
        persistenceAuthorised: true,
        writeExecuted: false,
        userId: USER,
        sharedSessionId: SESSION,
        title: "x",
        sideAProposition: "a",
        sideBProposition: "b",
        contradictionType: "goal_behavior_gap",
        persistedSourceMessageId: null,
        sideASpanEnsureDescriptor: { messageId: MSG_A },
        sideBSpanEnsureDescriptor: { messageId: MSG_B },
      });
      expect(check.ok).toBe(false);
      if (check.ok) return;
      expect(check.code).toBe("plan_not_authorised");
    });

    it("rejects a handmade plan containing the literal former token string", () => {
      const check = assertAuthorisedContradictionPersistencePlan({
        persistenceAuthorisationToken: "contradiction-persistence-authorised-v1",
        persistenceContractVersion: CONTRADICTION_PERSISTENCE_PLAN_VERSION,
        persistenceAuthorised: true,
        writeExecuted: false,
        userId: USER,
        sharedSessionId: SESSION,
        title: "x ↔ y",
        sideAProposition: "x",
        sideBProposition: "y",
        contradictionType: "goal_behavior_gap",
        persistedSourceMessageId: null,
        sideASpanEnsureDescriptor: {},
        sideBSpanEnsureDescriptor: {},
      });
      expect(check.ok).toBe(false);
      if (check.ok) return;
      expect(check.code).toBe("plan_not_authorised");
    });

    it("rejects an object-spread clone of a valid plan", () => {
      const built = buildContradictionPersistencePlan(validInput());
      expect(built.ok).toBe(true);
      if (!built.ok) return;
      const clone = { ...built.plan };
      const check = assertAuthorisedContradictionPersistencePlan(clone);
      expect(check.ok).toBe(false);
      if (check.ok) return;
      expect(check.code).toBe("plan_not_authorised");
    });

    it("rejects a JSON-serialized/deserialized valid plan", () => {
      const built = buildContradictionPersistencePlan(validInput());
      expect(built.ok).toBe(true);
      if (!built.ok) return;
      const revived = JSON.parse(JSON.stringify(built.plan));
      const check = assertAuthorisedContradictionPersistencePlan(revived);
      expect(check.ok).toBe(false);
      if (check.ok) return;
      expect(check.code).toBe("plan_not_authorised");
    });

    it("freezes the minted plan so post-build mutation is impossible", () => {
      const built = buildContradictionPersistencePlan(validInput());
      expect(built.ok).toBe(true);
      if (!built.ok) return;
      expect(Object.isFrozen(built.plan)).toBe(true);
      expect(Object.isFrozen(built.plan.sideASpanEnsureDescriptor)).toBe(true);
      expect(() => {
        (built.plan as { title: string }).title = "mutated";
      }).toThrow();
      expect(built.plan.title).not.toBe("mutated");
      const check = assertAuthorisedContradictionPersistencePlan(built.plan);
      expect(check.ok).toBe(true);
    });
  });

  describe("anti-regression", () => {
    it("pins supported contract versions", () => {
      expect(CONTRADICTION_DUAL_SIDE_LINEAGE_VERSION).toBe(
        "contradiction-dual-side-lineage-v1",
      );
      expect(CONTRADICTION_CONFIDENCE_POLICY_VERSION).toBe(
        "contradiction-confidence-policy-v1",
      );
      expect(CONTRADICTION_PERSISTENCE_PLAN_VERSION).toBe(
        "contradiction-persistence-plan-v1",
      );
    });
  });
});
