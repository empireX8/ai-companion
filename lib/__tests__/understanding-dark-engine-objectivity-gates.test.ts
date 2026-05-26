import {
  UnderstandingLinkSourceType,
  UserMapConclusionStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import { evaluateDarkRunUserMapCandidate } from "../understanding-dark-engine/dark-run-evaluator";
import { evaluateModelUpdateObjectivityGates, evaluateUserMapConclusionObjectivityGates } from "../understanding-dark-engine/objectivity-gates";
import type { EvidencePacket, EvidencePacketItem, EvidencePacketMetrics } from "../understanding-dark-engine/types";

function makeItem(
  sourceType: UnderstandingLinkSourceType,
  overrides: Partial<EvidencePacketItem> = {}
): EvidencePacketItem {
  return {
    sourceType,
    sourceId: `${sourceType}-${Math.random().toString(36).slice(2, 8)}`,
    role: "signal",
    weightClass: "moderate",
    sourceFamily: sourceType,
    timestamp: new Date("2026-05-10T10:00:00.000Z"),
    authoredAt: null,
    snippet: "snippet",
    quote: "A sufficiently long evidence quote.",
    publicSafetyLevel: "internal_only",
    publicSafeSummary: null,
    containsRawPrivateText: true,
    provenanceRefs: { messageId: "msg-1", sessionId: "sess-1" },
    qualityFlags: ["HAS_PROVENANCE", "HAS_RECEIPT"],
    linkable: true,
    ownershipResolvable: true,
    highEmotionSignal: false,
    origin: "native",
    episodeKey: "session:sess-1",
    ...overrides,
  };
}

function deriveMetrics(items: EvidencePacketItem[]): EvidencePacketMetrics {
  const sourceCounts: Partial<Record<UnderstandingLinkSourceType, number>> = {};
  for (const item of items) {
    sourceCounts[item.sourceType] = (sourceCounts[item.sourceType] ?? 0) + 1;
  }

  const timestamps = items.map((item) => item.authoredAt ?? item.timestamp).sort((a, b) => a.getTime() - b.getTime());
  const timeSpreadDays =
    timestamps.length > 0
      ? Math.floor((timestamps[timestamps.length - 1].getTime() - timestamps[0].getTime()) / (1000 * 60 * 60 * 24))
      : 0;

  return {
    evidenceCount: items.length,
    linkableEvidenceCount: items.filter((item) => item.linkable).length,
    ownershipResolvableCount: items.filter((item) => item.ownershipResolvable).length,
    sourceCounts,
    sourceDiversity: new Set(items.map((item) => item.sourceType)).size,
    timeSpreadDays,
    importedCount: items.filter((item) => item.origin === "imported").length,
    nativeCount: items.filter((item) => item.origin === "native").length,
    mixedCount: items.filter((item) => item.origin === "mixed").length,
    unknownOriginCount: items.filter((item) => item.origin === "unknown").length,
    highEmotionItemCount: items.filter((item) => item.highEmotionSignal).length,
    nonLinkableContextItems: items.filter((item) => !item.linkable).length,
    quoteQualityLowCount: items.filter((item) => item.qualityFlags.includes("LOW_QUOTE_QUALITY")).length,
    receiptCount: items.filter((item) => item.qualityFlags.includes("HAS_RECEIPT")).length,
    unresolvedContradictionCount: items.filter((item) => item.sourceType === UnderstandingLinkSourceType.contradiction_node).length,
    correctionSignalCount: items.filter((item) => item.sourceType === UnderstandingLinkSourceType.user_correction).length,
    distinctEpisodeCount: new Set(items.map((item) => item.episodeKey).filter((value): value is string => Boolean(value))).size,
  };
}

function makePacket(items: EvidencePacketItem[], overrides: Partial<EvidencePacketMetrics> = {}): EvidencePacket {
  const metrics = {
    ...deriveMetrics(items),
    ...overrides,
  };

  return {
    userId: "user-1",
    assembledAt: new Date("2026-05-15T12:00:00.000Z"),
    windowStart: new Date("2026-02-15T00:00:00.000Z"),
    windowEnd: new Date("2026-05-15T12:00:00.000Z"),
    items,
    metrics,
  };
}

describe("Phase 2 objectivity gates", () => {
  it("passes emerging only when >=2 evidence items and >=2 source types", () => {
    const passItems = [
      makeItem(UnderstandingLinkSourceType.pattern_claim),
      makeItem(UnderstandingLinkSourceType.journal_entry, {
        episodeKey: "journal:je-1",
        provenanceRefs: { journalEntryId: "je-1" },
      }),
    ];

    const passPacket = makePacket(passItems, {
      unresolvedContradictionCount: 0,
    });

    const passResult = evaluateUserMapConclusionObjectivityGates({
      packet: passPacket,
      target: {
        requestedStatus: UserMapConclusionStatus.emerging,
        identityLevelClaim: false,
        proposedSummary: "The user often avoids conflict.",
        requiresReceipt: true,
      },
    });

    expect(passResult.decision).toBe("pass");

    const failPacket = makePacket([
      makeItem(UnderstandingLinkSourceType.pattern_claim),
    ]);

    const failResult = evaluateUserMapConclusionObjectivityGates({
      packet: failPacket,
      target: {
        requestedStatus: UserMapConclusionStatus.emerging,
        identityLevelClaim: false,
        proposedSummary: "The user often avoids conflict.",
        requiresReceipt: true,
      },
    });

    expect(failResult.decision).toBe("abstain");
    expect(failResult.reasons).toContain("INSUFFICIENT_EVIDENCE_COUNT");
    expect(failResult.reasons).toContain("INSUFFICIENT_SOURCE_DIVERSITY");
  });

  it("applies correction multiplier to confidence cap and surfaces correction downgrade warning", () => {
    const baseItems = [
      makeItem(UnderstandingLinkSourceType.pattern_claim, {
        timestamp: new Date("2026-05-01T00:00:00.000Z"),
        episodeKey: "session:a",
      }),
      makeItem(UnderstandingLinkSourceType.journal_entry, {
        timestamp: new Date("2026-05-09T00:00:00.000Z"),
        episodeKey: "journal:b",
        provenanceRefs: { journalEntryId: "je-1" },
      }),
      makeItem(UnderstandingLinkSourceType.message, {
        timestamp: new Date("2026-05-10T00:00:00.000Z"),
        episodeKey: "session:c",
      }),
      makeItem(UnderstandingLinkSourceType.evidence_span, {
        timestamp: new Date("2026-05-12T00:00:00.000Z"),
        episodeKey: "session:d",
      }),
    ];

    const packetWithoutCorrection = makePacket(baseItems, {
      unresolvedContradictionCount: 0,
      correctionSignalCount: 0,
      sourceDiversity: 4,
      distinctEpisodeCount: 4,
    });

    const packetWithCorrection = makePacket(baseItems, {
      unresolvedContradictionCount: 0,
      correctionSignalCount: 1,
      sourceDiversity: 4,
      distinctEpisodeCount: 4,
    });

    const withoutCorrection = evaluateUserMapConclusionObjectivityGates({
      packet: packetWithoutCorrection,
      target: {
        requestedStatus: UserMapConclusionStatus.emerging,
        identityLevelClaim: false,
        proposedSummary: "Emerging conflict-avoidance pattern.",
        requiresReceipt: true,
      },
    });

    const withCorrection = evaluateUserMapConclusionObjectivityGates({
      packet: packetWithCorrection,
      target: {
        requestedStatus: UserMapConclusionStatus.emerging,
        identityLevelClaim: false,
        proposedSummary: "Emerging conflict-avoidance pattern.",
        requiresReceipt: true,
      },
    });

    expect(withoutCorrection.decision).toBe("pass");
    expect(withCorrection.decision).toBe("pass");
    expect(withCorrection.confidenceCap).toBeLessThan(withoutCorrection.confidenceCap);
    expect(withCorrection.confidenceCap).toBe(
      Number((withoutCorrection.confidenceCap * 0.5).toFixed(4))
    );
    expect(withCorrection.warnings).toContain("CORRECTION_DOWNGRADE_ACTIVE");
  });

  it("blocks supported without count/diversity/time-spread thresholds", () => {
    const items = [
      makeItem(UnderstandingLinkSourceType.pattern_claim, {
        timestamp: new Date("2026-05-10T00:00:00.000Z"),
      }),
      makeItem(UnderstandingLinkSourceType.journal_entry, {
        timestamp: new Date("2026-05-11T00:00:00.000Z"),
        episodeKey: "journal:je-1",
      }),
      makeItem(UnderstandingLinkSourceType.message, {
        timestamp: new Date("2026-05-11T03:00:00.000Z"),
      }),
    ];

    const packet = makePacket(items, { unresolvedContradictionCount: 0 });

    const result = evaluateUserMapConclusionObjectivityGates({
      packet,
      target: {
        requestedStatus: UserMapConclusionStatus.supported,
        identityLevelClaim: false,
        proposedSummary: "Conflict avoidance appears stable.",
        requiresReceipt: true,
      },
    });

    expect(result.decision).toBe("abstain");
    expect(result.reasons).toContain("INSUFFICIENT_EVIDENCE_COUNT");
    expect(result.reasons).toContain("INSUFFICIENT_TIME_SPREAD");
  });

  it("blocks supported for single-episode evidence", () => {
    const items = [
      makeItem(UnderstandingLinkSourceType.pattern_claim, { episodeKey: "session:one" }),
      makeItem(UnderstandingLinkSourceType.message, { episodeKey: "session:one" }),
      makeItem(UnderstandingLinkSourceType.evidence_span, { episodeKey: "session:one" }),
      makeItem(UnderstandingLinkSourceType.journal_entry, { episodeKey: "session:one" }),
    ];

    const packet = makePacket(items, {
      timeSpreadDays: 9,
      sourceDiversity: 4,
      unresolvedContradictionCount: 0,
      distinctEpisodeCount: 1,
    });

    const result = evaluateUserMapConclusionObjectivityGates({
      packet,
      target: {
        requestedStatus: UserMapConclusionStatus.supported,
        identityLevelClaim: false,
        proposedSummary: "Stable pattern over time.",
        requiresReceipt: true,
      },
    });

    expect(result.decision).toBe("abstain");
    expect(result.reasons).toContain("SINGLE_EPISODE_SUPPORTED_BLOCK");
  });

  it("caps supported when high-emotion evidence dominates and blocks identity claims", () => {
    const baseItems = [
      makeItem(UnderstandingLinkSourceType.message, {
        highEmotionSignal: true,
        quote: "I am in panic and feel hopeless right now.",
      }),
      makeItem(UnderstandingLinkSourceType.journal_entry, {
        highEmotionSignal: true,
        episodeKey: "journal:je-2",
      }),
      makeItem(UnderstandingLinkSourceType.pattern_claim, {
        highEmotionSignal: false,
      }),
      makeItem(UnderstandingLinkSourceType.evidence_span, {
        highEmotionSignal: true,
      }),
      makeItem(UnderstandingLinkSourceType.reference_item, {
        highEmotionSignal: false,
      }),
    ];

    const packet = makePacket(baseItems, {
      timeSpreadDays: 10,
      unresolvedContradictionCount: 0,
      distinctEpisodeCount: 3,
    });

    const cappedResult = evaluateUserMapConclusionObjectivityGates({
      packet,
      target: {
        requestedStatus: UserMapConclusionStatus.supported,
        identityLevelClaim: false,
        proposedSummary: "Pattern seems persistent.",
        requiresReceipt: true,
      },
    });

    expect(["pass_with_cap", "abstain"]).toContain(cappedResult.decision);

    const identityBlocked = evaluateUserMapConclusionObjectivityGates({
      packet,
      target: {
        requestedStatus: UserMapConclusionStatus.supported,
        identityLevelClaim: true,
        proposedSummary: "You are fundamentally broken in conflict.",
        requiresReceipt: true,
      },
    });

    expect(identityBlocked.decision).toBe("abstain");
    expect(identityBlocked.reasons).toContain("HIGH_EMOTION_IDENTITY_BLOCK");
  });

  it("enforces profile artifact cap and blocks profile-only supported conclusions", () => {
    const items = [
      makeItem(UnderstandingLinkSourceType.profile_artifact, {
        weightClass: "low_to_moderate",
        snippet: "FEAR: conflict rejection",
      }),
      makeItem(UnderstandingLinkSourceType.profile_artifact, {
        weightClass: "low_to_moderate",
        snippet: "IDENTITY: conflict avoidant",
      }),
      makeItem(UnderstandingLinkSourceType.profile_artifact, {
        weightClass: "low_to_moderate",
        snippet: "HABIT: withdraws under stress",
      }),
      makeItem(UnderstandingLinkSourceType.profile_artifact, {
        weightClass: "low_to_moderate",
        snippet: "TRAIT: guarded",
      }),
    ];

    const packet = makePacket(items, {
      timeSpreadDays: 14,
      unresolvedContradictionCount: 0,
      distinctEpisodeCount: 2,
    });

    const result = evaluateUserMapConclusionObjectivityGates({
      packet,
      target: {
        requestedStatus: UserMapConclusionStatus.supported,
        identityLevelClaim: false,
        proposedSummary: "Profile-only synthesis",
        requiresReceipt: true,
      },
    });

    expect(result.decision).toBe("abstain");
    expect(result.reasons).toContain("PROFILE_ARTIFACT_CAP");
  });

  it("treats timeline_aggregation and user_correction as non-linkable context and blocks context-only persistence", () => {
    const items = [
      makeItem(UnderstandingLinkSourceType.timeline_aggregation, {
        linkable: false,
        ownershipResolvable: false,
        provenanceRefs: {},
        qualityFlags: ["NON_LINKABLE_CONTEXT", "OWNERSHIP_UNRESOLVABLE"],
      }),
      makeItem(UnderstandingLinkSourceType.user_correction, {
        linkable: false,
        ownershipResolvable: false,
        provenanceRefs: {},
        qualityFlags: ["NON_LINKABLE_CONTEXT", "OWNERSHIP_UNRESOLVABLE"],
      }),
    ];

    const packet = makePacket(items, {
      linkableEvidenceCount: 0,
      ownershipResolvableCount: 0,
      sourceDiversity: 2,
      nonLinkableContextItems: 2,
      unresolvedContradictionCount: 0,
    });

    const result = evaluateUserMapConclusionObjectivityGates({
      packet,
      target: {
        requestedStatus: UserMapConclusionStatus.emerging,
        identityLevelClaim: false,
        proposedSummary: "Context-only candidate",
        requiresReceipt: true,
      },
    });

    expect(result.decision).toBe("abstain");
    expect(result.reasons).toContain("NON_LINKABLE_CONTEXT_ONLY");
    expect(result.reasons).toContain("MISSING_PROVENANCE");
  });

  it("requires linkable evidence when candidate is materially influenced by non-linkable context", () => {
    const items = [
      makeItem(UnderstandingLinkSourceType.timeline_aggregation, {
        linkable: false,
        ownershipResolvable: false,
        provenanceRefs: {},
        qualityFlags: ["NON_LINKABLE_CONTEXT", "OWNERSHIP_UNRESOLVABLE"],
      }),
      makeItem(UnderstandingLinkSourceType.pattern_claim, {
        linkable: true,
        ownershipResolvable: true,
      }),
    ];

    const packet = makePacket(items, {
      linkableEvidenceCount: 1,
      sourceDiversity: 2,
      nonLinkableContextItems: 1,
      unresolvedContradictionCount: 0,
      distinctEpisodeCount: 2,
    });

    const result = evaluateUserMapConclusionObjectivityGates({
      packet,
      target: {
        requestedStatus: UserMapConclusionStatus.emerging,
        identityLevelClaim: false,
        proposedSummary: "Candidate influenced by context but grounded in linkable proof",
        requiresReceipt: true,
      },
    });

    expect(result.reasons).not.toContain("NON_LINKABLE_CONTEXT_ONLY");
  });

  it("blocks model updates without meaningful delta and blocks synthetic insights", () => {
    const packet = makePacket([
      makeItem(UnderstandingLinkSourceType.pattern_claim),
    ]);

    const noDelta = evaluateModelUpdateObjectivityGates({
      packet,
      delta: {
        hasEvidenceLink: true,
      },
    });

    expect(noDelta.isMeaningful).toBe(false);
    expect(noDelta.reasons).toContain("NO_MEANINGFUL_DELTA");

    const synthetic = evaluateModelUpdateObjectivityGates({
      packet,
      delta: {
        hasEvidenceLink: true,
        isSyntheticInsight: true,
        isStatusTransition: true,
      },
    });

    expect(synthetic.isMeaningful).toBe(false);
    expect(synthetic.reasons).toContain("SYNTHETIC_INSIGHT_BLOCKED");
  });

  it("diagnostics report rejection reason counts for abstained candidates", () => {
    const packet = makePacket([
      makeItem(UnderstandingLinkSourceType.pattern_claim, {
        linkable: false,
        ownershipResolvable: false,
        provenanceRefs: {},
        qualityFlags: ["NON_LINKABLE_CONTEXT", "OWNERSHIP_UNRESOLVABLE"],
      }),
    ], {
      linkableEvidenceCount: 0,
      ownershipResolvableCount: 0,
      nonLinkableContextItems: 1,
      sourceDiversity: 1,
      unresolvedContradictionCount: 0,
    });

    const evaluation = evaluateDarkRunUserMapCandidate({
      packet,
      target: {
        requestedStatus: UserMapConclusionStatus.emerging,
        identityLevelClaim: false,
        proposedSummary: "context only",
        requiresReceipt: true,
      },
    });

    expect(evaluation.result.decision).toBe("abstain");
    expect(evaluation.diagnostics.abstentions).toBe(1);
    expect(
      (evaluation.diagnostics.rejectionCountsByReason.NON_LINKABLE_CONTEXT_ONLY ?? 0) > 0
    ).toBe(true);
    expect(evaluation.diagnostics.linkIntegrityWarnings.length).toBeGreaterThan(0);
  });

  it("counts high-emotion cap diagnostics on pass_with_cap outcomes", () => {
    const items = [
      makeItem(UnderstandingLinkSourceType.message, {
        highEmotionSignal: true,
        timestamp: new Date("2026-05-01T00:00:00.000Z"),
        episodeKey: "session:a",
      }),
      makeItem(UnderstandingLinkSourceType.journal_entry, {
        highEmotionSignal: true,
        timestamp: new Date("2026-05-10T00:00:00.000Z"),
        episodeKey: "journal:b",
      }),
      makeItem(UnderstandingLinkSourceType.pattern_claim, {
        highEmotionSignal: true,
        timestamp: new Date("2026-05-11T00:00:00.000Z"),
        episodeKey: "session:c",
      }),
      makeItem(UnderstandingLinkSourceType.evidence_span, {
        highEmotionSignal: false,
        timestamp: new Date("2026-05-12T00:00:00.000Z"),
        episodeKey: "session:d",
      }),
      makeItem(UnderstandingLinkSourceType.reference_item, {
        highEmotionSignal: false,
        timestamp: new Date("2026-05-14T00:00:00.000Z"),
        episodeKey: "session:e",
      }),
    ];

    const packet = makePacket(items, {
      timeSpreadDays: 13,
      unresolvedContradictionCount: 0,
      correctionSignalCount: 0,
      sourceDiversity: 5,
      distinctEpisodeCount: 5,
    });

    const evaluation = evaluateDarkRunUserMapCandidate({
      packet,
      target: {
        requestedStatus: UserMapConclusionStatus.supported,
        identityLevelClaim: false,
        proposedSummary: "Pattern appears stable.",
        requiresReceipt: true,
      },
    });

    expect(evaluation.result.decision).toBe("pass_with_cap");
    expect(evaluation.result.warnings).toContain("HIGH_EMOTION_DOMINANCE_CAP");
    expect(evaluation.diagnostics.highEmotionCaps).toBe(1);
    expect(evaluation.diagnostics.abstentions).toBe(0);
  });
});
