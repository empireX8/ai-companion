/**
 * Narrow regression: Class D vs abstention vs compatible_states.
 *
 * Schema-v4 permits insufficient_or_misaligned_context as a classified
 * non-clear result. The frozen ambiguous_insufficient pair is Class D.
 * Null classification + abstentionReason is reserved for genuinely
 * indeterminate evidence that cannot safely choose any taxonomy class.
 */

import { describe, expect, it } from "vitest";

import {
  adjudicateContradiction,
  buildContradictionAdjudicationPrompt,
} from "../contradiction-adjudicator";
import {
  buildAllFrozenScenarioCatalogs,
  CEQR_021_SYNTHETIC_CASES,
} from "../ceqr021-approved-evidence-spans";
import { checkLexicalBoundaryCatalogLimits } from "../orvek-intelligence-kernel/lexical-boundary-catalog";
import { KERNEL_FIRST_PROOF_OBJECT } from "../orvek-intelligence-kernel/contracts";
import type { KernelSourceUnit } from "../orvek-intelligence-kernel/types";
import type { ContradictionModelTransportResult } from "../orvek-intelligence-kernel/structured-output";
import { transportSelectionForFullSource } from "./helpers/ceqr020-transport-selection";
import {
  CEQR_022_EXPECTED_AMBIGUOUS_CLASSIFICATION,
  classifyCeqr021LiveResult,
  classifyCeqr022LiveResult,
  type Ceqr021CaseObservation,
  type Ceqr021CatalogsByCaseId,
} from "../ceqr021-live-pass-classifier";
import { createEmptyCeqr021CallAccounting, CEQR_021_FROZEN_SOURCE_IDS } from "../ceqr021-constants";
import { runCeqr021OfflineDryRun } from "../ceqr021-offline-dry-run";

const FIXED_NOW = () => new Date("2026-07-23T22:00:00.000Z");

/** Genuinely indeterminate fixture — cannot safely choose any taxonomy class. */
const INDETERMINATE_FIXTURE = {
  sideAText: "Something about the thing, maybe.",
  sideBText: "Not sure what that refers to either.",
} as const;

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

function transportBase(
  sideA: KernelSourceUnit,
  sideB: KernelSourceUnit,
  overrides: Record<string, unknown> = {},
): ContradictionModelTransportResult {
  const base = {
    propositionA: {
      normalizedProposition: "Proposition A",
      actor: "speaker",
      subject: "topic",
      timeframe: "general",
      negation: false,
      modality: "assertive",
      qualifications: "none",
    },
    propositionB: {
      normalizedProposition: "Proposition B",
      actor: "speaker",
      subject: "topic",
      timeframe: "general",
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
    classification: "clear_contradiction" as const,
    confidence: 0.9,
    evidenceClaimA: transportSelectionForFullSource(sideA.sourceText),
    evidenceClaimB: transportSelectionForFullSource(sideB.sourceText),
    rationale: "test",
    alternativeInterpretation: "test",
    whatWouldChangeClassification: "test",
    abstentionReason: null,
    proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
  };
  return { ...base, ...overrides } as ContradictionModelTransportResult;
}

describe("Class D vs abstention vs compatible_states contract", () => {
  it("prompt distinguishes Class D from null-classification abstention", () => {
    const clear = CEQR_021_SYNTHETIC_CASES.find(
      (c) => c.id === "clear_contradiction_candidate",
    )!;
    const sideA = source({
      sourceId: "a",
      label: "A",
      sourceText: clear.sideAText,
    });
    const sideB = source({
      sourceId: "b",
      label: "B",
      sourceText: clear.sideBText,
    });
    const limits = checkLexicalBoundaryCatalogLimits({
      sideAText: sideA.sourceText,
      sideBText: sideB.sourceText,
    });
    expect(limits.ok).toBe(true);
    if (!limits.ok) return;

    const { system } = buildContradictionAdjudicationPrompt(sideA, sideB, {
      sideACatalog: limits.sideACatalog,
      sideBCatalog: limits.sideBCatalog,
    });

    expect(system).toContain(
      "Class D versus abstention versus compatible_states (hard gate):",
    );
    expect(system).toContain(
      "insufficient_or_misaligned_context: use when the evidence is sufficient to determine that the pair is non-comparable",
    );
    expect(system).toContain(
      "null classification + non-blank abstentionReason: use ONLY when the evidence is insufficient to safely choose any taxonomy classification.",
    );
    expect(system).toContain(
      "Do not abstain merely because the pair is Class D.",
    );
    expect(system).not.toContain(
      "Prefer abstention over a weak compatible_states label",
    );
  });

  it("ambiguous_insufficient texts produce insufficient_or_misaligned_context", async () => {
    const ambiguous = CEQR_021_SYNTHETIC_CASES.find(
      (c) => c.id === "ambiguous_insufficient",
    )!;
    expect(ambiguous.sideAText).toBe(
      "I might go running later if I feel up to it.",
    );
    expect(ambiguous.sideBText).toBe("Sometimes I think about exercise.");

    const sideA = source({
      sourceId: "amb-a",
      label: "A",
      sourceText: ambiguous.sideAText,
    });
    const sideB = source({
      sourceId: "amb-b",
      label: "B",
      sourceText: ambiguous.sideBText,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: {
        async runStructured(request) {
          expect(request.system ?? "").toContain(
            "Class D versus abstention versus compatible_states (hard gate):",
          );
          // Contract-following fake: non-comparable / materially underspecified pair → Class D.
          return {
            ok: true as const,
            object: transportBase(sideA, sideB, {
              classification: "insufficient_or_misaligned_context",
              abstentionReason: null,
              bothCanSimultaneouslyBeTrue: true,
              confidence: 0.55,
              rationale:
                "Hedged conditional wish vs vague topical mention; pair is materially underspecified as a contradiction comparison.",
            }),
            providerId: "test-fake",
            modelId: "test-fake-model",
            rawText: null,
          };
        },
      },
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("semantic_accepted");
    expect(result.semantic?.classification).toBe(
      "insufficient_or_misaligned_context",
    );
    expect(result.semantic?.abstentionReason).toBeNull();
  });

  it("genuinely indeterminate fixture abstains with null classification", async () => {
    const sideA = source({
      sourceId: "ind-a",
      label: "A",
      sourceText: INDETERMINATE_FIXTURE.sideAText,
    });
    const sideB = source({
      sourceId: "ind-b",
      label: "B",
      sourceText: INDETERMINATE_FIXTURE.sideBText,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: {
        async runStructured() {
          return {
            ok: true as const,
            object: transportBase(sideA, sideB, {
              classification: null,
              abstentionReason:
                "evidence_indeterminate: cannot safely choose any taxonomy classification",
              bothCanSimultaneouslyBeTrue: true,
              confidence: 0.15,
              rationale:
                "Fragments do not support a safe Class A/B/C/D determination.",
            }),
            providerId: "test-fake",
            modelId: "test-fake-model",
            rawText: null,
          };
        },
      },
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("abstained");
    expect(result.errorCode).toBe("model_abstained");
    expect(result.semantic).toBeNull();
    expect(result.abstentionReason).toMatch(/indeterminate|cannot safely choose/i);
  });

  it("genuinely compatible evidence remains compatible_states", async () => {
    const compatible = CEQR_021_SYNTHETIC_CASES.find(
      (c) => c.id === "compatible_contextual",
    )!;
    const sideA = source({
      sourceId: "compat-a",
      label: "A",
      sourceText: compatible.sideAText,
    });
    const sideB = source({
      sourceId: "compat-b",
      label: "B",
      sourceText: compatible.sideBText,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: {
        async runStructured() {
          return {
            ok: true as const,
            object: transportBase(sideA, sideB, {
              classification: "compatible_states",
              bothCanSimultaneouslyBeTrue: true,
              propositionA: {
                normalizedProposition: "Speaker avoids coffee in the evening",
                actor: "speaker",
                subject: "coffee",
                timeframe: "evening",
                negation: true,
                modality: "assertive",
                qualifications: "evening only",
              },
              propositionB: {
                normalizedProposition: "Speaker drinks coffee in the morning",
                actor: "speaker",
                subject: "coffee",
                timeframe: "morning",
                negation: false,
                modality: "assertive",
                qualifications: "morning only",
              },
              rationale:
                "Evening avoidance and morning drinking coexist under timeframe qualifiers.",
            }),
            providerId: "test-fake",
            modelId: "test-fake-model",
            rawText: null,
          };
        },
      },
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("semantic_accepted");
    expect(result.semantic?.classification).toBe("compatible_states");
  });

  it("clear contradiction remains clear_contradiction", async () => {
    const clear = CEQR_021_SYNTHETIC_CASES.find(
      (c) => c.id === "clear_contradiction_candidate",
    )!;
    const sideA = source({
      sourceId: "clear-a",
      label: "A",
      sourceText: clear.sideAText,
    });
    const sideB = source({
      sourceId: "clear-b",
      label: "B",
      sourceText: clear.sideBText,
    });

    const result = await adjudicateContradiction({
      sideA,
      sideB,
      modelRunner: {
        async runStructured() {
          return {
            ok: true as const,
            object: transportBase(sideA, sideB, {
              classification: "clear_contradiction",
              bothCanSimultaneouslyBeTrue: false,
              changedBeliefOverTime: false,
              intentionVersusOutcome: false,
              goalVersusObstacle: false,
              emotionalOrPhysiologicalVersusReasoningStandard: false,
              propositionA: {
                normalizedProposition: "Speaker does not drink alcohol at all",
                actor: "speaker",
                subject: "alcohol",
                timeframe: "general",
                negation: true,
                modality: "assertive",
                qualifications: "none",
              },
              propositionB: {
                normalizedProposition:
                  "Speaker drank several beers last night",
                actor: "speaker",
                subject: "alcohol",
                timeframe: "last night",
                negation: false,
                modality: "assertive",
                qualifications: "none",
              },
              rationale:
                "Universal abstinence conflicts with reported drinking.",
            }),
            providerId: "test-fake",
            modelId: "test-fake-model",
            rawText: null,
          };
        },
      },
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("semantic_accepted");
    expect(result.semantic?.classification).toBe("clear_contradiction");
  });

  it("CEQR-022 Class D ambiguous PASS; historical CEQR-021 classifier unchanged", () => {
    const dry = runCeqr021OfflineDryRun();
    const catalogsByCaseId = Object.fromEntries(
      buildAllFrozenScenarioCatalogs().map((c) => [c.caseId, c]),
    ) as Record<
      "clear_contradiction_candidate" | "compatible_contextual" | "ambiguous_insufficient",
      ReturnType<typeof buildAllFrozenScenarioCatalogs>[number]
    >;
    const caseObservations = dry.caseObservations.map((o) => {
      if (o.caseId !== "ambiguous_insufficient") return { ...o };
      const catalogs = catalogsByCaseId.ambiguous_insufficient;
      const selA = catalogs.sideA.approvedSpans[0]!;
      const selB = catalogs.sideB.approvedSpans[0]!;
      return {
        ...o,
        adjudicationOutcome: "semantic_accepted" as const,
        observedClassification: CEQR_022_EXPECTED_AMBIGUOUS_CLASSIFICATION,
        abstentionReason: null,
        transportParsedAsSchemaV4: true,
        semanticConsistencyOk: true,
        validationCode: null,
        adjudicatorErrorCode: null,
        adjudicatorErrorMessage: null,
        earliestFailedGate: null,
        refereeReached: false,
        refereeCompleted: false,
        refereeFailed: false,
        refereeCallCount: 0,
        writerInvoked: false,
        persistenceInvoked: false,
        nodeCreated: false,
        transportSelectionA: {
          startBoundaryIndex: selA.startBoundaryIndex,
          endBoundaryIndex: selA.endBoundaryIndex,
        },
        transportSelectionB: {
          startBoundaryIndex: selB.startBoundaryIndex,
          endBoundaryIndex: selB.endBoundaryIndex,
        },
        evidenceA: {
          sourceId: CEQR_021_FROZEN_SOURCE_IDS.ambiguous_insufficient.A,
          exactQuote: selA.exactQuote,
          startOffset: selA.startOffset,
          endOffset: selA.endOffset,
          startBoundaryIndex: selA.startBoundaryIndex,
          endBoundaryIndex: selA.endBoundaryIndex,
          approved: true,
        },
        evidenceB: {
          sourceId: CEQR_021_FROZEN_SOURCE_IDS.ambiguous_insufficient.B,
          exactQuote: selB.exactQuote,
          startOffset: selB.startOffset,
          endOffset: selB.endOffset,
          startBoundaryIndex: selB.startBoundaryIndex,
          endBoundaryIndex: selB.endBoundaryIndex,
          approved: true,
        },
      } satisfies Ceqr021CaseObservation;
    });

    const input = {
      caseObservations,
      catalogsByCaseId: catalogsByCaseId as unknown as Ceqr021CatalogsByCaseId,
      accounting: {
        ...createEmptyCeqr021CallAccounting(),
        providerConstructionAttempted: 1,
        liveRunnerInvoked: 1,
        adjudicatorAttempts: 3,
        refereeAttempts: 1,
        totalProviderAttempts: 4,
        automaticRetries: 0,
      },
      frozenPlanHashMatched: true,
      scenarioAggregateHashMatched: true,
      schemaPromptAddendumMatched: true,
      oneShotConsumedExactlyOnce: true,
      canonicalPathOk: true,
      productionReady: false as const,
    };

    expect(classifyCeqr022LiveResult(input)).toBe(
      "PASS_LIVE_SCHEMA_V4_SEMANTIC_PROOF_OBTAINED",
    );
    // Historical CEQR-021 classifier still requires abstention for this case.
    expect(classifyCeqr021LiveResult(input)).toBe("FAIL_ABSTENTION_CONTRACT");
  });
});
