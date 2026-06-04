import {
  ModelUpdateType,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
  UserMapConclusionStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import { evaluateDarkRunUserMapCandidate } from "../understanding-dark-engine/dark-run-evaluator";
import {
  buildStructuredFieldworkCandidateProposal,
} from "../understanding-dark-engine/fieldwork-candidate-proposal";
import {
  buildStructuredInvestigationCandidateProposal,
} from "../understanding-dark-engine/investigation-candidate-proposal";
import {
  buildStructuredModelUpdateCandidateProposal,
  deriveModelUpdateDeltaInput,
  extractStructuredModelUpdateCandidateProposal,
  usesModelUpdateCandidateSafeWording,
} from "../understanding-dark-engine/model-update-candidate-proposal";
import {
  buildStructuredUserMapCandidateProposal,
} from "../understanding-dark-engine/user-map-candidate-proposal";
import type { EvidencePacket } from "../understanding-dark-engine/types";

const DEFAULT_TARGET = {
  requestedStatus: UserMapConclusionStatus.emerging,
  identityLevelClaim: false,
  proposedSummary: "Manual no-write dark-run diagnostics candidate.",
  requiresReceipt: true,
};

type PacketItemInput = {
  sourceType: UnderstandingLinkSourceType;
  sourceId: string;
  linkable?: boolean;
  ownershipResolvable?: boolean;
  publicSafetyLevel?: "internal_only" | "safe_summary";
  publicSafeSummary?: string | null;
};

function buildPacket(items: PacketItemInput[]): EvidencePacket {
  const mappedItems = items.map((item, index) => ({
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    role: "signal" as const,
    weightClass: "moderate" as const,
    sourceFamily: item.sourceType,
    timestamp: new Date(`2026-05-${10 + index}T12:00:00.000Z`),
    authoredAt: null,
    snippet: `private-snippet-${item.sourceId}`,
    quote: `private-quote-${item.sourceId}`,
    publicSafetyLevel: item.publicSafetyLevel ?? "internal_only",
    publicSafeSummary: item.publicSafeSummary ?? null,
    containsRawPrivateText: item.publicSafetyLevel !== "safe_summary",
    provenanceRefs: {},
    qualityFlags: [],
    linkable: item.linkable ?? true,
    ownershipResolvable: item.ownershipResolvable ?? true,
    highEmotionSignal: false,
    origin: "native" as const,
    episodeKey: null,
  }));

  const sourceCounts: Partial<Record<UnderstandingLinkSourceType, number>> = {};
  for (const item of mappedItems) {
    sourceCounts[item.sourceType] = (sourceCounts[item.sourceType] ?? 0) + 1;
  }

  return {
    userId: "user-1",
    assembledAt: new Date("2026-05-15T12:00:00.000Z"),
    windowStart: new Date("2026-05-01T00:00:00.000Z"),
    windowEnd: new Date("2026-05-15T12:00:00.000Z"),
    items: mappedItems,
    metrics: {
      evidenceCount: mappedItems.length,
      linkableEvidenceCount: mappedItems.filter((item) => item.linkable).length,
      ownershipResolvableCount: mappedItems.filter((item) => item.ownershipResolvable)
        .length,
      sourceCounts,
      sourceDiversity: Object.keys(sourceCounts).length,
      timeSpreadDays: 5,
      importedCount: 0,
      nativeCount: mappedItems.length,
      mixedCount: 0,
      unknownOriginCount: 0,
      highEmotionItemCount: 0,
      nonLinkableContextItems: 0,
      quoteQualityLowCount: 0,
      receiptCount: 1,
      unresolvedContradictionCount: 0,
      correctionSignalCount: 0,
      distinctEpisodeCount: 2,
    },
  };
}

function evaluatePacket(packet: EvidencePacket) {
  return evaluateDarkRunUserMapCandidate({
    packet,
    target: DEFAULT_TARGET,
  });
}

describe("structured ModelUpdate candidate proposal builder", () => {
  it("emits a proposal only when meaningful-delta gates pass", () => {
    const packet = buildPacket([
      {
        sourceType: "surfaced_action",
        sourceId: "sa-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: "Action follow-through improved after pausing.",
      },
      {
        sourceType: "message",
        sourceId: "m-1",
      },
    ]);
    const evaluation = evaluatePacket(packet);

    expect(evaluation.result.decision).toBe("pass");
    const proposal = buildStructuredModelUpdateCandidateProposal({
      packet,
      evaluation,
    });

    expect(proposal).not.toBeNull();
    expect(proposal?.updateType).toBe(ModelUpdateType.link_detected);
    expect(proposal?.userFacingSummary).toMatch(/^There is early evidence that\b/i);
    expect(proposal?.affectedObjectType).toBe(UnderstandingLinkTargetType.surfaced_action);
    expect(proposal?.affectedObjectId).toBe("sa-1");
    expect(usesModelUpdateCandidateSafeWording(proposal!)).toBe(true);
    expect(proposal?.userFacingSummary).not.toContain("private-snippet");
    expect(proposal?.userFacingSummary).not.toContain("private-quote");
  });

  it("returns null when meaningful delta gates do not pass", () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: "Energy drops after meetings.",
      },
    ]);
    const evaluation = evaluatePacket(packet);

    const delta = deriveModelUpdateDeltaInput({ packet, evaluation });
    expect(delta.newLinkCount).toBe(0);

    expect(
      buildStructuredModelUpdateCandidateProposal({
        packet,
        evaluation,
      })
    ).toBeNull();
  });

  it("returns null when synthetic insight is flagged", () => {
    const packet = buildPacket([
      {
        sourceType: "surfaced_action",
        sourceId: "sa-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: "Action follow-through improved after pausing.",
      },
      {
        sourceType: "message",
        sourceId: "m-1",
      },
    ]);
    const evaluation = evaluatePacket(packet);
    const syntheticEvaluation = {
      ...evaluation,
      result: {
        ...evaluation.result,
        reasons: ["SYNTHETIC_INSIGHT_BLOCKED" as const],
        warnings: [],
      },
    };

    expect(
      buildStructuredModelUpdateCandidateProposal({
        packet,
        evaluation: syntheticEvaluation,
      })
    ).toBeNull();
  });

  it("extractStructuredModelUpdateCandidateProposal rejects malformed and unsafe proposals", () => {
    const valid = extractStructuredModelUpdateCandidateProposal({
      modelUpdateCandidateProposal: {
        updateType: ModelUpdateType.link_detected,
        userFacingSummary: "There is early evidence that action follow-through improved.",
        affectedObjectType: UnderstandingLinkTargetType.surfaced_action,
        affectedObjectId: "sa-1",
        evidenceSelections: [
          { sourceType: "surfaced_action", sourceId: "sa-1" },
          { sourceType: "message", sourceId: "m-1" },
        ],
      },
    });

    expect(valid).not.toBeNull();
    expect(usesModelUpdateCandidateSafeWording(valid!)).toBe(true);

    expect(
      extractStructuredModelUpdateCandidateProposal({
        modelUpdateCandidateProposal: {
          updateType: ModelUpdateType.link_detected,
          userFacingSummary: "The model learned that you always shut down.",
          affectedObjectType: UnderstandingLinkTargetType.surfaced_action,
          affectedObjectId: "sa-1",
          evidenceSelections: [
            { sourceType: "surfaced_action", sourceId: "sa-1" },
            { sourceType: "message", sourceId: "m-1" },
          ],
        },
      })
    ).toEqual(
      expect.objectContaining({
        userFacingSummary: "The model learned that you always shut down.",
      })
    );
    expect(
      usesModelUpdateCandidateSafeWording({
        userFacingSummary: "The model learned that you always shut down.",
      })
    ).toBe(false);

    expect(
      extractStructuredModelUpdateCandidateProposal({
        modelUpdateCandidateProposal: {
          updateType: ModelUpdateType.link_detected,
          userFacingSummary: "   ",
          affectedObjectType: UnderstandingLinkTargetType.surfaced_action,
          affectedObjectId: "sa-1",
          evidenceSelections: [
            { sourceType: "surfaced_action", sourceId: "sa-1" },
            { sourceType: "message", sourceId: "m-1" },
          ],
        },
      })
    ).toBeNull();
  });

  it("follows orchestrator precedence: ModelUpdate only when UserMap, Investigation, and Fieldwork are absent", () => {
    const packet = buildPacket([
      {
        sourceType: "surfaced_action",
        sourceId: "sa-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: "Action follow-through improved after pausing.",
      },
      {
        sourceType: "message",
        sourceId: "m-1",
      },
    ]);
    const evaluation = evaluatePacket(packet);

    const userMap = buildStructuredUserMapCandidateProposal({
      packet,
      evaluation,
      target: DEFAULT_TARGET,
    });
    const investigation = userMap
      ? null
      : buildStructuredInvestigationCandidateProposal({ packet, evaluation });
    const fieldwork =
      userMap || investigation
        ? null
        : buildStructuredFieldworkCandidateProposal({ packet, evaluation });
    const modelUpdate =
      userMap || investigation || fieldwork
        ? null
        : buildStructuredModelUpdateCandidateProposal({ packet, evaluation });

    expect(userMap).toBeNull();
    expect(investigation).toBeNull();
    expect(fieldwork).toBeNull();
    expect(modelUpdate).not.toBeNull();
  });
});
