import { InvestigationSeedType } from "@prisma/client";
import { UserMapConclusionStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { evaluateDarkRunUserMapCandidate } from "../understanding-dark-engine/dark-run-evaluator";
import {
  buildStructuredInvestigationCandidateProposal,
  extractStructuredInvestigationCandidateProposal,
  hasInvestigationFramingAbstainSignal,
  usesInvestigationCandidateSafeWording,
} from "../understanding-dark-engine/investigation-candidate-proposal";
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

describe("structured Investigation candidate proposal builder", () => {
  it("returns null when UserMap gates pass", () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: "Conflict spike pattern.",
      },
      {
        sourceType: "message",
        sourceId: "m-1",
      },
      {
        sourceType: "message",
        sourceId: "m-2",
      },
    ]);
    const evaluation = evaluatePacket(packet);

    expect(evaluation.result.decision).not.toBe("abstain");
    expect(
      buildStructuredInvestigationCandidateProposal({ packet, evaluation })
    ).toBeNull();
  });

  it("returns null when abstain has no linkable evidence selections", () => {
    const packet = buildPacket([]);
    const evaluation = evaluatePacket(packet);

    expect(evaluation.result.decision).toBe("abstain");
    expect(
      buildStructuredInvestigationCandidateProposal({ packet, evaluation })
    ).toBeNull();
  });

  it("returns null when abstain reasons are not investigation-framed", () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: "Conflict spike pattern.",
      },
    ]);
    const evaluation = evaluatePacket(packet);
    const nonInvestigationAbstain = {
      ...evaluation,
      result: {
        ...evaluation.result,
        decision: "abstain" as const,
        reasons: ["LANGUAGE_OVERCLAIMING_BLOCKED" as RejectionReasonCode],
        warnings: [],
      },
    };

    expect(hasInvestigationFramingAbstainSignal(nonInvestigationAbstain)).toBe(false);
    expect(
      buildStructuredInvestigationCandidateProposal({
        packet,
        evaluation: nonInvestigationAbstain,
      })
    ).toBeNull();
  });

  it("builds safe public proposal when abstain is investigation-framed", () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: "Conflict spike pattern.",
      },
    ]);
    const evaluation = evaluatePacket(packet);

    expect(evaluation.result.decision).toBe("abstain");
    expect(evaluation.result.reasons).toEqual(
      expect.arrayContaining([
        "INSUFFICIENT_EVIDENCE_COUNT",
        "INSUFFICIENT_SOURCE_DIVERSITY",
      ])
    );

    const proposal = buildStructuredInvestigationCandidateProposal({
      packet,
      evaluation,
    });

    expect(proposal).not.toBeNull();
    expect(proposal?.seedType).toBe(InvestigationSeedType.pattern);
    expect(proposal?.title).toMatch(/^Worth exploring:/);
    expect(proposal?.summary).toMatch(/^This looks worth watching/);
    expect(proposal?.organizingQuestion.endsWith("?")).toBe(true);
    expect(usesInvestigationCandidateSafeWording(proposal!)).toBe(true);
    expect(proposal?.summary).not.toContain("private-snippet");
    expect(proposal?.summary).not.toContain("private-quote");
    expect(proposal?.evidenceSelections).toEqual([
      { sourceType: "pattern_claim", sourceId: "pc-1" },
    ]);
  });

  it("does not compete with UserMap proposal when gates pass", () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: "Conflict spike pattern.",
      },
      {
        sourceType: "message",
        sourceId: "m-1",
      },
      {
        sourceType: "message",
        sourceId: "m-2",
      },
    ]);
    const evaluation = evaluatePacket(packet);

    expect(
      buildStructuredUserMapCandidateProposal({
        packet,
        evaluation,
        target: DEFAULT_TARGET,
      })
    ).not.toBeNull();
    expect(
      buildStructuredInvestigationCandidateProposal({ packet, evaluation })
    ).toBeNull();
  });

  it("extractStructuredInvestigationCandidateProposal rejects unsafe wording", () => {
    const valid = extractStructuredInvestigationCandidateProposal({
      investigationCandidateProposal: {
        seedType: InvestigationSeedType.pattern,
        title: "Worth exploring: Conflict spike pattern.",
        organizingQuestion: "What would clarify whether conflict spike pattern?",
        summary:
          "This looks worth watching as an open question. Conflict spike pattern.",
        abstainReasons: ["INSUFFICIENT_EVIDENCE_COUNT"],
        evidenceSelections: [{ sourceType: "pattern_claim", sourceId: "pc-1" }],
      },
    });
    expect(valid).not.toBeNull();

    const invalid = extractStructuredInvestigationCandidateProposal({
      investigationCandidateProposal: {
        seedType: InvestigationSeedType.pattern,
        title: "Raw leak title",
        organizingQuestion: "What happened?",
        summary: "private-snippet leaked",
        abstainReasons: ["INSUFFICIENT_EVIDENCE_COUNT"],
        evidenceSelections: [{ sourceType: "pattern_claim", sourceId: "pc-1" }],
      },
    });
    expect(invalid).toBeNull();
  });
});
