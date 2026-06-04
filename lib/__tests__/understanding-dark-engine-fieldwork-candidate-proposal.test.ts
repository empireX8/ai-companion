import { UnderstandingLinkTargetType, UserMapConclusionStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { evaluateDarkRunUserMapCandidate } from "../understanding-dark-engine/dark-run-evaluator";
import {
  buildStructuredFieldworkCandidateProposal,
  extractStructuredFieldworkCandidateProposal,
  hasFieldworkFramingAbstainSignal,
  usesFieldworkCandidateSafeWording,
} from "../understanding-dark-engine/fieldwork-candidate-proposal";
import { buildStructuredInvestigationCandidateProposal } from "../understanding-dark-engine/investigation-candidate-proposal";
import {
  buildStructuredUserMapCandidateProposal,
} from "../understanding-dark-engine/user-map-candidate-proposal";
import type { RejectionReasonCode } from "../understanding-dark-engine/constants";
import type { EvidencePacket, GateEvaluationTarget } from "../understanding-dark-engine/types";
import type { UnderstandingLinkSourceType } from "@prisma/client";

const DEFAULT_TARGET: GateEvaluationTarget = {
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

function fieldworkFramedAbstainEvaluation(packet: EvidencePacket) {
  const evaluation = evaluatePacket(packet);
  return {
    ...evaluation,
    result: {
      ...evaluation.result,
      decision: "abstain" as const,
      reasons: ["PROFILE_ARTIFACT_CAP" as RejectionReasonCode],
      warnings: [],
    },
  };
}

describe("structured FieldworkAssignment candidate proposal builder", () => {
  it("returns null when UserMap gates pass", () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: "Energy drops after meetings.",
      },
      { sourceType: "message", sourceId: "m-1" },
      { sourceType: "message", sourceId: "m-2" },
    ]);
    const evaluation = evaluatePacket(packet);

    expect(evaluation.result.decision).not.toBe("abstain");
    expect(
      buildStructuredFieldworkCandidateProposal({ packet, evaluation })
    ).toBeNull();
  });

  it("returns null when abstain has no fieldwork-framing signal", () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: "Energy drops after meetings.",
      },
    ]);
    const evaluation = evaluatePacket(packet);
    const nonFieldworkAbstain = {
      ...evaluation,
      result: {
        ...evaluation.result,
        decision: "abstain" as const,
        reasons: ["LANGUAGE_OVERCLAIMING_BLOCKED" as RejectionReasonCode],
        warnings: [],
      },
    };

    expect(hasFieldworkFramingAbstainSignal(nonFieldworkAbstain)).toBe(false);
    expect(
      buildStructuredFieldworkCandidateProposal({
        packet,
        evaluation: nonFieldworkAbstain,
      })
    ).toBeNull();
  });

  it("builds safe public proposal when abstain is fieldwork-framed", () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: "Energy drops after meetings.",
      },
    ]);
    const evaluation = fieldworkFramedAbstainEvaluation(packet);

    const proposal = buildStructuredFieldworkCandidateProposal({
      packet,
      evaluation,
    });

    expect(proposal).not.toBeNull();
    expect(proposal?.prompt).toMatch(/^Notice whether\b/);
    expect(proposal?.reason).toMatch(/^This may be worth watching in practice\./);
    expect(usesFieldworkCandidateSafeWording(proposal!)).toBe(true);
    expect(proposal?.linkedObjectType).toBe(UnderstandingLinkTargetType.pattern_claim);
    expect(proposal?.linkedObjectId).toBe("pc-1");
    expect(proposal?.reason).not.toContain("private-snippet");
    expect(proposal?.evidenceSelections).toEqual([
      { sourceType: "pattern_claim", sourceId: "pc-1" },
    ]);
  });

  it("does not compete with Investigation proposal when investigation framing applies", () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: "Energy drops after meetings.",
      },
    ]);
    const evaluation = evaluatePacket(packet);

    expect(evaluation.result.decision).toBe("abstain");
    expect(
      buildStructuredInvestigationCandidateProposal({ packet, evaluation })
    ).not.toBeNull();
    expect(
      buildStructuredFieldworkCandidateProposal({ packet, evaluation })
    ).toBeNull();
  });

  it("follows orchestrator precedence: fieldwork only when UserMap and Investigation are absent", () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: "Energy drops after meetings.",
      },
    ]);
    const evaluation = fieldworkFramedAbstainEvaluation(packet);

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

    expect(userMap).toBeNull();
    expect(investigation).toBeNull();
    expect(fieldwork).not.toBeNull();
  });

  it("extractStructuredFieldworkCandidateProposal returns structurally valid proposals including unsafe wording", () => {
    const valid = extractStructuredFieldworkCandidateProposal({
      fieldworkCandidateProposal: {
        prompt: "Notice whether energy drops after meetings.",
        reason:
          "This may be worth watching in practice. Energy drops after meetings.",
        linkedObjectType: UnderstandingLinkTargetType.pattern_claim,
        linkedObjectId: "pc-1",
        abstainReasons: ["PROFILE_ARTIFACT_CAP"],
        evidenceSelections: [{ sourceType: "pattern_claim", sourceId: "pc-1" }],
      },
    });
    expect(valid).toEqual(
      expect.objectContaining({
        prompt: "Notice whether energy drops after meetings.",
        reason:
          "This may be worth watching in practice. Energy drops after meetings.",
      })
    );
    expect(usesFieldworkCandidateSafeWording(valid!)).toBe(true);

    const unsafe = extractStructuredFieldworkCandidateProposal({
      fieldworkCandidateProposal: {
        prompt: "Raw leak prompt",
        reason: "private-snippet leaked",
        linkedObjectType: UnderstandingLinkTargetType.pattern_claim,
        linkedObjectId: "pc-1",
        abstainReasons: ["PROFILE_ARTIFACT_CAP"],
        evidenceSelections: [{ sourceType: "pattern_claim", sourceId: "pc-1" }],
      },
    });
    expect(unsafe).toEqual(
      expect.objectContaining({
        prompt: "Raw leak prompt",
        reason: "private-snippet leaked",
      })
    );
    expect(usesFieldworkCandidateSafeWording(unsafe!)).toBe(false);
  });

  it("extractStructuredFieldworkCandidateProposal returns null when required strings are missing", () => {
    expect(
      extractStructuredFieldworkCandidateProposal({
        fieldworkCandidateProposal: {
          prompt: "   ",
          reason: "This may be worth watching in practice. Energy drops.",
          linkedObjectType: UnderstandingLinkTargetType.pattern_claim,
          linkedObjectId: "pc-1",
          abstainReasons: ["PROFILE_ARTIFACT_CAP"],
          evidenceSelections: [{ sourceType: "pattern_claim", sourceId: "pc-1" }],
        },
      })
    ).toBeNull();
  });

  it("requires both safe prompt and safe reason wording", () => {
    expect(
      usesFieldworkCandidateSafeWording({
        prompt: "Raw leak prompt",
        reason: "This may be worth watching in practice. Energy drops.",
      })
    ).toBe(false);

    expect(
      usesFieldworkCandidateSafeWording({
        prompt: "Notice whether energy drops after meetings.",
        reason: "private-snippet leaked",
      })
    ).toBe(false);

    expect(
      usesFieldworkCandidateSafeWording({
        prompt: "Notice whether energy drops after meetings.",
        reason: "This may be worth watching in practice. Energy drops.",
      })
    ).toBe(true);
  });

  it("extractStructuredFieldworkCandidateProposal returns null for malformed linked objects and evidence", () => {
    const base = {
      prompt: "Notice whether energy drops after meetings.",
      reason: "This may be worth watching in practice. Energy drops.",
      abstainReasons: ["PROFILE_ARTIFACT_CAP" as RejectionReasonCode],
      evidenceSelections: [
        { sourceType: "pattern_claim" as const, sourceId: "pc-1" },
      ],
    };

    expect(
      extractStructuredFieldworkCandidateProposal({
        fieldworkCandidateProposal: {
          ...base,
          linkedObjectType: undefined as unknown as UnderstandingLinkTargetType,
          linkedObjectId: "pc-1",
        },
      })
    ).toBeNull();

    expect(
      extractStructuredFieldworkCandidateProposal({
        fieldworkCandidateProposal: {
          ...base,
          linkedObjectType: "not_a_real_target" as UnderstandingLinkTargetType,
          linkedObjectId: "pc-1",
        },
      })
    ).toBeNull();

    expect(
      extractStructuredFieldworkCandidateProposal({
        fieldworkCandidateProposal: {
          ...base,
          linkedObjectType: UnderstandingLinkTargetType.pattern_claim,
          linkedObjectId: "   ",
        },
      })
    ).toBeNull();

    expect(
      extractStructuredFieldworkCandidateProposal({
        fieldworkCandidateProposal: {
          ...base,
          linkedObjectType: UnderstandingLinkTargetType.pattern_claim,
          linkedObjectId: "pc-1",
          evidenceSelections: "not-an-array" as unknown as typeof base.evidenceSelections,
        },
      })
    ).toBeNull();

    expect(
      extractStructuredFieldworkCandidateProposal({
        fieldworkCandidateProposal: {
          ...base,
          linkedObjectType: UnderstandingLinkTargetType.pattern_claim,
          linkedObjectId: "pc-1",
          evidenceSelections: [{ sourceType: "pattern_claim", sourceId: "  " }],
        },
      })
    ).toBeNull();

    expect(
      extractStructuredFieldworkCandidateProposal({
        fieldworkCandidateProposal: {
          ...base,
          linkedObjectType: UnderstandingLinkTargetType.pattern_claim,
          linkedObjectId: "pc-1",
          evidenceSelections: [
            { sourceType: "not_a_source" as UnderstandingLinkSourceType, sourceId: "pc-1" },
          ],
        },
      })
    ).toBeNull();
  });

  it("extractStructuredFieldworkCandidateProposal returns cleaned valid payloads", () => {
    expect(
      extractStructuredFieldworkCandidateProposal({
        fieldworkCandidateProposal: {
          prompt: "  Notice whether energy drops. ",
          reason: "  This may be worth watching in practice. Energy drops. ",
          linkedObjectType: UnderstandingLinkTargetType.pattern_claim,
          linkedObjectId: "  pc-1  ",
          abstainReasons: [" PROFILE_ARTIFACT_CAP " as RejectionReasonCode],
          evidenceSelections: [{ sourceType: "pattern_claim", sourceId: " pc-1 " }],
        },
      })
    ).toEqual({
      prompt: "Notice whether energy drops.",
      reason: "This may be worth watching in practice. Energy drops.",
      linkedObjectType: UnderstandingLinkTargetType.pattern_claim,
      linkedObjectId: "pc-1",
      abstainReasons: ["PROFILE_ARTIFACT_CAP"],
      evidenceSelections: [{ sourceType: "pattern_claim", sourceId: "pc-1" }],
    });
  });
});
