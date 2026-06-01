import {
  UserMapConclusionArea,
  UserMapConclusionStatus,
  type UnderstandingLinkSourceType,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import { evaluateDarkRunUserMapCandidate } from "../understanding-dark-engine/dark-run-evaluator";
import { extractStructuredUserMapCandidateProposal } from "../understanding-dark-engine/app-message-candidate-bridge";
import {
  buildStructuredUserMapCandidateProposal,
  type StructuredUserMapCandidateProposal,
} from "../understanding-dark-engine/user-map-candidate-proposal";
import type { EvidencePacket, GateEvaluationTarget } from "../understanding-dark-engine/types";

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
    snippet: `snippet-${item.sourceId}`,
    quote: `quote-${item.sourceId}`,
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
      ownershipResolvableCount: mappedItems.filter((item) => item.ownershipResolvable).length,
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

describe("structured UserMap candidate proposal builder", () => {
  it("returns null when objectivity gates abstain", () => {
    const packet = buildPacket([
      {
        sourceType: "message",
        sourceId: "m-1",
      },
    ]);
    const evaluation = evaluatePacket(packet);

    expect(evaluation.result.decision).toBe("abstain");
    expect(
      buildStructuredUserMapCandidateProposal({
        packet,
        evaluation,
        target: DEFAULT_TARGET,
      })
    ).toBeNull();
  });

  it("returns null when gates pass but evidence lacks a safe-summary anchor", () => {
    const packet = buildPacket([
      {
        sourceType: "message",
        sourceId: "m-1",
      },
      {
        sourceType: "pattern_claim_evidence",
        sourceId: "pce-1",
      },
    ]);
    const evaluation = evaluatePacket(packet);

    expect(evaluation.result.decision).not.toBe("abstain");
    expect(
      buildStructuredUserMapCandidateProposal({
        packet,
        evaluation,
        target: DEFAULT_TARGET,
      })
    ).toBeNull();
  });

  it("returns a structured proposal when gates pass and evidence is sufficient", () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: "Conflict spike pattern.",
      },
      {
        sourceType: "pattern_claim_evidence",
        sourceId: "pce-1",
      },
      {
        sourceType: "message",
        sourceId: "m-1",
      },
    ]);
    const evaluation = evaluatePacket(packet);

    const proposal = buildStructuredUserMapCandidateProposal({
      packet,
      evaluation,
      target: DEFAULT_TARGET,
    });

    expect(proposal).toEqual({
      area: UserMapConclusionArea.operating_logic,
      title: "Conflict spike pattern.",
      summary: "Conflict spike pattern.",
      target: {
        requestedStatus: evaluation.result.allowedStatus,
        identityLevelClaim: false,
        proposedSummary: "Conflict spike pattern.",
        requiresReceipt: true,
      },
      evidenceSelections: [
        { sourceType: "message", sourceId: "m-1" },
        { sourceType: "pattern_claim", sourceId: "pc-1" },
        { sourceType: "pattern_claim_evidence", sourceId: "pce-1" },
      ],
    } satisfies StructuredUserMapCandidateProposal);
  });

  it("produces output compatible with the APP message candidate bridge extractor", () => {
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
    ]);
    const evaluation = evaluatePacket(packet);
    const proposal = buildStructuredUserMapCandidateProposal({
      packet,
      evaluation,
      target: DEFAULT_TARGET,
    });

    expect(proposal).not.toBeNull();
    expect(
      extractStructuredUserMapCandidateProposal({
        mode: "no_write_dark_run",
        userId: "user-1",
        packet: {
          assembledAt: packet.assembledAt.toISOString(),
          windowStart: packet.windowStart.toISOString(),
          windowEnd: packet.windowEnd.toISOString(),
          metrics: packet.metrics,
          items: [],
        },
        userMapEvaluation: evaluation.result,
        diagnostics: evaluation.diagnostics,
        phaseHCompatibility: { required: false, reasons: [] },
        userMapCandidateProposal: proposal,
      })
    ).toEqual(proposal);
  });

  it("truncates titles at word boundaries without cutting mid-word", () => {
    const safeSummary = Array.from({ length: 30 }, (_, index) => `word${index}`).join(" ");
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: safeSummary,
      },
      {
        sourceType: "message",
        sourceId: "m-1",
      },
    ]);
    const evaluation = evaluatePacket(packet);
    const proposal = buildStructuredUserMapCandidateProposal({
      packet,
      evaluation,
      target: DEFAULT_TARGET,
    });

    const normalizedSummary = safeSummary.trim().replace(/\s+/g, " ");
    let expectedTitle = "";
    for (const word of normalizedSummary.split(" ")) {
      const candidate = expectedTitle ? `${expectedTitle} ${word}` : word;
      if (candidate.length > 120) {
        break;
      }
      expectedTitle = candidate;
    }

    expect(proposal).not.toBeNull();
    expect(proposal!.title.length).toBeLessThanOrEqual(120);
    expect(proposal!.title.endsWith(" ")).toBe(false);
    expect(proposal!.title).toBe(expectedTitle);
    expect(proposal!.summary).toBe(normalizedSummary);
  });

  it("hard-truncates very long single-token titles at the max length", () => {
    const safeSummary = "x".repeat(150);
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: safeSummary,
      },
      {
        sourceType: "message",
        sourceId: "m-1",
      },
    ]);
    const evaluation = evaluatePacket(packet);
    const proposal = buildStructuredUserMapCandidateProposal({
      packet,
      evaluation,
      target: DEFAULT_TARGET,
    });

    expect(proposal?.title).toHaveLength(120);
    expect(proposal?.title).toBe("x".repeat(120));
    expect(proposal?.summary).toHaveLength(150);
  });

  it("normalizes whitespace in title output", () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: "  Conflict   spike   pattern.  ",
      },
      {
        sourceType: "message",
        sourceId: "m-1",
      },
    ]);
    const evaluation = evaluatePacket(packet);
    const proposal = buildStructuredUserMapCandidateProposal({
      packet,
      evaluation,
      target: DEFAULT_TARGET,
    });

    expect(proposal?.title).toBe("Conflict spike pattern.");
    expect(proposal?.summary).toBe("Conflict   spike   pattern.");
  });

  it("keeps summary truncation behavior unchanged for long safe summaries", () => {
    const safeSummary = `${"word ".repeat(200).trim()} tailtoken`;
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: safeSummary,
      },
      {
        sourceType: "message",
        sourceId: "m-1",
      },
    ]);
    const evaluation = evaluatePacket(packet);
    const proposal = buildStructuredUserMapCandidateProposal({
      packet,
      evaluation,
      target: DEFAULT_TARGET,
    });

    expect(proposal).not.toBeNull();
    expect(proposal!.summary).toBe(safeSummary.trim().slice(0, 600));
    expect(proposal!.summary.length).toBe(600);
    expect(proposal!.title.length).toBeLessThanOrEqual(120);
    expect(proposal!.title).not.toBe(proposal!.summary.slice(0, 120));
  });

  it("selects the same anchor deterministically regardless of packet item order", () => {
    const items: PacketItemInput[] = [
      {
        sourceType: "message",
        sourceId: "m-1",
      },
      {
        sourceType: "pattern_claim",
        sourceId: "pc-b",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: "Secondary anchor should not win.",
      },
      {
        sourceType: "pattern_claim",
        sourceId: "pc-a",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: "Primary anchor wins by stable source id.",
      },
    ];

    const forwardPacket = buildPacket(items);
    const reversePacket = buildPacket([...items].reverse());
    const forwardEvaluation = evaluatePacket(forwardPacket);
    const reverseEvaluation = evaluatePacket(reversePacket);

    const forwardProposal = buildStructuredUserMapCandidateProposal({
      packet: forwardPacket,
      evaluation: forwardEvaluation,
      target: DEFAULT_TARGET,
    });
    const reverseProposal = buildStructuredUserMapCandidateProposal({
      packet: reversePacket,
      evaluation: reverseEvaluation,
      target: DEFAULT_TARGET,
    });

    expect(forwardProposal).not.toBeNull();
    expect(reverseProposal).toEqual(forwardProposal);
    expect(forwardProposal?.title).toBe("Primary anchor wins by stable source id.");
    expect(forwardProposal?.evidenceSelections).toEqual([
      { sourceType: "message", sourceId: "m-1" },
      { sourceType: "pattern_claim", sourceId: "pc-a" },
      { sourceType: "pattern_claim", sourceId: "pc-b" },
    ]);
    expect(forwardProposal?.summary).toBe(
      "Primary anchor wins by stable source id. Secondary anchor should not win."
    );
    expect(forwardProposal?.summary).not.toBe(forwardProposal?.title);
  });

  it("combines multiple distinct safe summaries so summary differs from title", () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: "Conflict spike pattern.",
      },
      {
        sourceType: "contradiction_node",
        sourceId: "cn-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: "Evening tension keeps resurfacing.",
      },
    ]);
    const evaluation = evaluatePacket(packet);
    const proposal = buildStructuredUserMapCandidateProposal({
      packet,
      evaluation,
      target: DEFAULT_TARGET,
    });

    expect(proposal?.title).toBe("Conflict spike pattern.");
    expect(proposal?.summary).toBe(
      "Conflict spike pattern. Evening tension keeps resurfacing."
    );
    expect(proposal?.summary).not.toBe(proposal?.title);
    expect(proposal?.summary).not.toContain("snippet-");
    expect(proposal?.summary).not.toContain("quote-");
  });

  it("excludes import_record safe summaries from proposal summary text", () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: "Conflict spike pattern.",
      },
      {
        sourceType: "import_record",
        sourceId: "imp-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: "completed conv=3 msg=120",
      },
      {
        sourceType: "message",
        sourceId: "m-1",
      },
    ]);
    const evaluation = evaluatePacket(packet);
    const proposal = buildStructuredUserMapCandidateProposal({
      packet,
      evaluation,
      target: DEFAULT_TARGET,
    });

    expect(proposal?.title).toBe("Conflict spike pattern.");
    expect(proposal?.summary).toBe("Conflict spike pattern.");
    expect(proposal?.summary).not.toContain("conv=3");
    expect(proposal?.summary).not.toContain("completed");
    expect(proposal?.evidenceSelections).toEqual([
      { sourceType: "import_record", sourceId: "imp-1" },
      { sourceType: "message", sourceId: "m-1" },
      { sourceType: "pattern_claim", sourceId: "pc-1" },
    ]);
  });

  it("deduplicates repeated safe summaries after whitespace normalization", () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: "Shared insight about pacing.",
      },
      {
        sourceType: "message",
        sourceId: "m-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: "  Shared   insight about pacing.  ",
      },
    ]);
    const evaluation = evaluatePacket(packet);
    const proposal = buildStructuredUserMapCandidateProposal({
      packet,
      evaluation,
      target: DEFAULT_TARGET,
    });

    expect(proposal?.title).toBe("Shared insight about pacing.");
    expect(proposal?.summary).toBe("Shared insight about pacing.");
    expect(proposal?.summary).toBe(proposal?.title);
  });

  it("caps combined multi-summary output at 600 characters", () => {
    const anchorSummary = "Anchor safe summary.";
    const additionalSummary = "z".repeat(590);
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: anchorSummary,
      },
      {
        sourceType: "contradiction_node",
        sourceId: "cn-1",
        publicSafetyLevel: "safe_summary",
        publicSafeSummary: additionalSummary,
      },
    ]);
    const evaluation = evaluatePacket(packet);
    const proposal = buildStructuredUserMapCandidateProposal({
      packet,
      evaluation,
      target: DEFAULT_TARGET,
    });

    expect(proposal?.summary.length).toBe(600);
    expect(proposal?.summary).toBe(
      `Anchor safe summary. ${additionalSummary}`.slice(0, 600)
    );
  });
});
