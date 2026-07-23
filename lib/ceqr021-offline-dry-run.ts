/**
 * CEQR-021 — offline fake-runner dry run of all three frozen cases.
 *
 * Demonstrates expected future control flow without a real provider adapter.
 * Classification is an OFFLINE HARNESS result, never a live proof.
 */

import {
  CEQR_021_FROZEN_SOURCE_IDS,
  createEmptyCeqr021CallAccounting,
  syncCeqr021TotalProviderAttempts,
  type Ceqr021CallAccounting,
  type Ceqr021LiveClassification,
} from "./ceqr021-constants";
import {
  CEQR_021_SYNTHETIC_CASES,
  buildAllFrozenScenarioCatalogs,
  selectionIsApproved,
  type Ceqr021FrozenCaseCatalogs,
} from "./ceqr021-approved-evidence-spans";
import {
  buildCeqr021CaseDiagnostics,
  classifyCeqr021LiveResult,
  fingerprintProviderObject,
  type Ceqr021BoundEvidence,
  type Ceqr021CaseObservation,
} from "./ceqr021-live-pass-classifier";
import type { EvidenceSpanSelection } from "./orvek-intelligence-kernel";
import { bindExactEvidenceClaimFromBoundarySelection } from "./orvek-intelligence-kernel";
import type { LiveSyntheticCaseId } from "./contradiction-live-provider-referee-proof";

export type Ceqr021FakeAdjudicatorResult = {
  caseId: LiveSyntheticCaseId;
  classification: string | null;
  abstentionReason: string | null;
  compatibilityFlags: {
    bothCanSimultaneouslyBeTrue: boolean;
    changedBeliefOverTime: boolean;
    intentionVersusOutcome: boolean;
    goalVersusObstacle: boolean;
    emotionalOrPhysiologicalVersusReasoningStandard: boolean;
  };
  selectionA: EvidenceSpanSelection;
  selectionB: EvidenceSpanSelection;
  rawObject: Record<string, unknown>;
};

function approvedSelection(
  catalogs: Ceqr021FrozenCaseCatalogs,
  side: "A" | "B",
): EvidenceSpanSelection {
  const frozen = side === "A" ? catalogs.sideA : catalogs.sideB;
  const span = frozen.approvedSpans[0];
  if (!span) {
    throw new Error(`No approved span for ${catalogs.caseId}.${side}`);
  }
  return {
    startBoundaryIndex: span.startBoundaryIndex,
    endBoundaryIndex: span.endBoundaryIndex,
  };
}

function buildIdealFakeResults(
  catalogsById: Map<LiveSyntheticCaseId, Ceqr021FrozenCaseCatalogs>,
): Ceqr021FakeAdjudicatorResult[] {
  const clear = catalogsById.get("clear_contradiction_candidate")!;
  const compatible = catalogsById.get("compatible_contextual")!;
  const ambiguous = catalogsById.get("ambiguous_insufficient")!;

  const clearRaw = {
    classification: "clear_contradiction",
    bothCanSimultaneouslyBeTrue: false,
    changedBeliefOverTime: false,
    intentionVersusOutcome: false,
    goalVersusObstacle: false,
    emotionalOrPhysiologicalVersusReasoningStandard: false,
    abstentionReason: null,
    evidenceClaimA: approvedSelection(clear, "A"),
    evidenceClaimB: approvedSelection(clear, "B"),
  };
  const compatibleRaw = {
    classification: "compatible_states",
    bothCanSimultaneouslyBeTrue: true,
    changedBeliefOverTime: false,
    intentionVersusOutcome: false,
    goalVersusObstacle: false,
    emotionalOrPhysiologicalVersusReasoningStandard: false,
    abstentionReason: null,
    evidenceClaimA: approvedSelection(compatible, "A"),
    evidenceClaimB: approvedSelection(compatible, "B"),
  };
  const ambiguousRaw = {
    classification: null,
    bothCanSimultaneouslyBeTrue: true,
    changedBeliefOverTime: false,
    intentionVersusOutcome: false,
    goalVersusObstacle: false,
    emotionalOrPhysiologicalVersusReasoningStandard: false,
    abstentionReason: "insufficient_overlapping_claims",
    evidenceClaimA: approvedSelection(ambiguous, "A"),
    evidenceClaimB: approvedSelection(ambiguous, "B"),
  };

  return [
    {
      caseId: "clear_contradiction_candidate",
      classification: "clear_contradiction",
      abstentionReason: null,
      compatibilityFlags: {
        bothCanSimultaneouslyBeTrue: false,
        changedBeliefOverTime: false,
        intentionVersusOutcome: false,
        goalVersusObstacle: false,
        emotionalOrPhysiologicalVersusReasoningStandard: false,
      },
      selectionA: clearRaw.evidenceClaimA,
      selectionB: clearRaw.evidenceClaimB,
      rawObject: clearRaw,
    },
    {
      caseId: "compatible_contextual",
      classification: "compatible_states",
      abstentionReason: null,
      compatibilityFlags: {
        bothCanSimultaneouslyBeTrue: true,
        changedBeliefOverTime: false,
        intentionVersusOutcome: false,
        goalVersusObstacle: false,
        emotionalOrPhysiologicalVersusReasoningStandard: false,
      },
      selectionA: compatibleRaw.evidenceClaimA,
      selectionB: compatibleRaw.evidenceClaimB,
      rawObject: compatibleRaw,
    },
    {
      caseId: "ambiguous_insufficient",
      classification: null,
      abstentionReason: "insufficient_overlapping_claims",
      compatibilityFlags: {
        bothCanSimultaneouslyBeTrue: true,
        changedBeliefOverTime: false,
        intentionVersusOutcome: false,
        goalVersusObstacle: false,
        emotionalOrPhysiologicalVersusReasoningStandard: false,
      },
      selectionA: ambiguousRaw.evidenceClaimA,
      selectionB: ambiguousRaw.evidenceClaimB,
      rawObject: ambiguousRaw,
    },
  ];
}

function bindSide(args: {
  side: Ceqr021FrozenCaseCatalogs["sideA"];
  selection: EvidenceSpanSelection;
  sourceId: string;
}):
  | { ok: true; evidence: Ceqr021BoundEvidence }
  | { ok: false; code: string; failing: true } {
  const result = bindExactEvidenceClaimFromBoundarySelection(
    {
      sourceId: args.sourceId,
      sessionId: "ceqr021-offline-dry-run",
      sourceText: args.side.sourceText,
      sourceRole: "synthetic",
      label: args.side.side,
    },
    args.selection,
    args.side.catalog,
  );
  if (!result.bind.ok) {
    return { ok: false, code: result.bind.code, failing: true };
  }
  const approved = selectionIsApproved(args.side, args.selection) != null;
  return {
    ok: true,
    evidence: {
      sourceId: result.bind.claim.sourceId,
      exactQuote: result.bind.claim.exactQuote,
      startOffset: result.bind.claim.startOffset,
      endOffset: result.bind.claim.endOffset,
      startBoundaryIndex: args.selection.startBoundaryIndex,
      endBoundaryIndex: args.selection.endBoundaryIndex,
      approved,
    },
  };
}

export type Ceqr021OfflineDryRunResult = {
  classification: Ceqr021LiveClassification;
  offlineHarnessResult: true;
  liveProofObtained: false;
  productionReady: false;
  accounting: Ceqr021CallAccounting;
  caseObservations: Ceqr021CaseObservation[];
  diagnostics: ReturnType<typeof buildCeqr021CaseDiagnostics>[];
  notes: string[];
};

/**
 * Offline fake-runner dry run. Never constructs a live OpenAI adapter.
 */
export function runCeqr021OfflineDryRun(args?: {
  fakeResults?: Ceqr021FakeAdjudicatorResult[];
  throwOnAdjudicatorCaseId?: LiveSyntheticCaseId;
}): Ceqr021OfflineDryRunResult {
  const accounting = createEmptyCeqr021CallAccounting();
  accounting.liveRunnerInvoked = 1;
  // Simulate the expected future accounting profile (fake construction only).
  accounting.providerConstructionAttempted = 1;

  const allCatalogs = buildAllFrozenScenarioCatalogs(CEQR_021_SYNTHETIC_CASES);
  const catalogsById = new Map(allCatalogs.map((c) => [c.caseId, c]));
  const fakes = args?.fakeResults ?? buildIdealFakeResults(catalogsById);
  const observations: Ceqr021CaseObservation[] = [];

  for (const fake of fakes) {
    const catalogs = catalogsById.get(fake.caseId)!;
    const sourceIds = CEQR_021_FROZEN_SOURCE_IDS[fake.caseId];
    const expectedOutcome =
      fake.caseId === "clear_contradiction_candidate"
        ? "clear_contradiction"
        : fake.caseId === "compatible_contextual"
          ? "compatible_non_clear"
          : "ambiguous_abstention";

    accounting.adjudicatorAttempts += 1;
    syncCeqr021TotalProviderAttempts(accounting);

    if (args?.throwOnAdjudicatorCaseId === fake.caseId) {
      observations.push({
        caseId: fake.caseId,
        expectedOutcome,
        transportParsedAsSchemaV4: false,
        observedClassification: null,
        adjudicationOutcome: "provider_failed",
        compatibilityFlags: {
          bothCanSimultaneouslyBeTrue: null,
          changedBeliefOverTime: null,
          intentionVersusOutcome: null,
          goalVersusObstacle: null,
          emotionalOrPhysiologicalVersusReasoningStandard: null,
        },
        abstentionReason: null,
        evidenceA: null,
        evidenceB: null,
        transportSelectionA: null,
        transportSelectionB: null,
        rawProviderObjectSha256: null,
        immutableRawTransportFingerprint: null,
        refereeReached: false,
        refereeCompleted: false,
        refereeFailed: false,
        adjudicatorCallCount: 1,
        refereeCallCount: 0,
        writerInvoked: false,
        persistenceInvoked: false,
        nodeCreated: false,
        semanticConsistencyOk: null,
        validationCode: "provider_thrown",
        failingSide: null,
        earliestFailedGate: "provider_or_transport",
        latencyMs: 0,
      });
      continue;
    }

    const fingerprint = fingerprintProviderObject(fake.rawObject);
    const bindA = bindSide({
      side: catalogs.sideA,
      selection: fake.selectionA,
      sourceId: sourceIds.A,
    });
    const bindB = bindSide({
      side: catalogs.sideB,
      selection: fake.selectionB,
      sourceId: sourceIds.B,
    });

    let failingSide: Ceqr021CaseObservation["failingSide"] = null;
    let validationCode: string | null = null;
    if (!bindA.ok && !bindB.ok) failingSide = "both";
    else if (!bindA.ok) failingSide = "A";
    else if (!bindB.ok) failingSide = "B";
    if (!bindA.ok) validationCode = bindA.code;
    else if (!bindB.ok) validationCode = bindB.code;
    else if (!bindA.evidence.approved || !bindB.evidence.approved) {
      validationCode = "unapproved_evidence_span";
      failingSide =
        !bindA.evidence.approved && !bindB.evidence.approved
          ? "both"
          : !bindA.evidence.approved
            ? "A"
            : "B";
    }

    const isClear = fake.classification === "clear_contradiction";
    const isAbstain = fake.classification == null;
    let refereeReached = false;
    let refereeCompleted = false;
    const refereeFailed = false;
    let refereeCallCount = 0;

    if (
      isClear &&
      bindA.ok &&
      bindB.ok &&
      bindA.evidence.approved &&
      bindB.evidence.approved &&
      validationCode == null
    ) {
      accounting.refereeAttempts += 1;
      syncCeqr021TotalProviderAttempts(accounting);
      refereeReached = true;
      refereeCompleted = true;
      refereeCallCount = 1;
    }

    observations.push({
      caseId: fake.caseId,
      expectedOutcome,
      transportParsedAsSchemaV4: true,
      observedClassification: fake.classification,
      adjudicationOutcome: isAbstain
        ? "abstained"
        : validationCode != null
          ? "validation_failed"
          : "semantic_accepted",
      compatibilityFlags: fake.compatibilityFlags,
      abstentionReason: fake.abstentionReason,
      evidenceA: bindA.ok ? bindA.evidence : null,
      evidenceB: bindB.ok ? bindB.evidence : null,
      transportSelectionA: fake.selectionA,
      transportSelectionB: fake.selectionB,
      rawProviderObjectSha256: fingerprint,
      immutableRawTransportFingerprint: fingerprint,
      refereeReached,
      refereeCompleted,
      refereeFailed,
      adjudicatorCallCount: 1,
      refereeCallCount,
      writerInvoked: false,
      persistenceInvoked: false,
      nodeCreated: false,
      semanticConsistencyOk: validationCode == null,
      validationCode,
      failingSide,
      earliestFailedGate: validationCode,
      latencyMs: 1,
    });
  }

  const catalogsByCaseId = Object.fromEntries(
    allCatalogs.map((c) => [c.caseId, c]),
  ) as Record<LiveSyntheticCaseId, Ceqr021FrozenCaseCatalogs>;

  const classification = classifyCeqr021LiveResult({
    caseObservations: observations,
    catalogsByCaseId,
    accounting,
    frozenPlanHashMatched: true,
    scenarioAggregateHashMatched: true,
    schemaPromptAddendumMatched: true,
    oneShotConsumedExactlyOnce: true,
    canonicalPathOk: true,
    productionReady: false,
    offlineDryRun: true,
  });

  const diagnostics = observations.map((observation) =>
    buildCeqr021CaseDiagnostics({
      observation,
      catalogs: catalogsById.get(observation.caseId)!,
    }),
  );

  return {
    classification,
    offlineHarnessResult: true,
    liveProofObtained: false,
    productionReady: false,
    accounting,
    caseObservations: observations,
    diagnostics,
    notes: [
      "OFFLINE HARNESS dry run only — not a live schema-v4 proof.",
      "Fake provider construction profile only; no real OpenAI adapter.",
      "CEQR-021 live provider attempts: 0",
      "CEQR-021 real account queries: 0",
      "CEQR-021 real database queries/mutations: 0",
      "CEQR-021 writer/persistence calls: 0",
      "production readiness: NO",
    ],
  };
}

/**
 * Counting wrapper that increments adjudicator attempts before delegating,
 * so thrown requests remain counted (finally-safe via pre-increment).
 */
export async function invokeFakeAdjudicatorCounted(args: {
  accounting: Ceqr021CallAccounting;
  run: () => Promise<unknown> | unknown;
}): Promise<unknown> {
  args.accounting.adjudicatorAttempts += 1;
  syncCeqr021TotalProviderAttempts(args.accounting);
  try {
    return await args.run();
  } finally {
    syncCeqr021TotalProviderAttempts(args.accounting);
  }
}
