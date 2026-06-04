import { UserMapConclusionStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  resolveCandidateBridgeNoWriteTriggerEligibilityMock,
  runNoWriteUnderstandingDarkRunMock,
  evaluateNoWriteDarkRunOutputMock,
  persistInternalUserMapConclusionCandidateMock,
  persistInternalInvestigationCandidateMock,
} = vi.hoisted(() => ({
  resolveCandidateBridgeNoWriteTriggerEligibilityMock: vi.fn(),
  runNoWriteUnderstandingDarkRunMock: vi.fn(),
  evaluateNoWriteDarkRunOutputMock: vi.fn(),
  persistInternalUserMapConclusionCandidateMock: vi.fn(),
  persistInternalInvestigationCandidateMock: vi.fn(),
}));

vi.mock("../understanding-dark-engine/no-write-trigger-runtime-state", () => ({
  resolveCandidateBridgeNoWriteTriggerEligibility:
    resolveCandidateBridgeNoWriteTriggerEligibilityMock,
}));

vi.mock("../understanding-dark-engine/dark-run-orchestrator", () => ({
  runNoWriteUnderstandingDarkRun: runNoWriteUnderstandingDarkRunMock,
}));

vi.mock("../understanding-dark-engine/dark-run-evaluation-harness", () => ({
  evaluateNoWriteDarkRunOutput: evaluateNoWriteDarkRunOutputMock,
}));

vi.mock("../understanding-dark-engine/user-map-candidate-persistence", () => ({
  persistInternalUserMapConclusionCandidate: persistInternalUserMapConclusionCandidateMock,
}));

vi.mock("../understanding-dark-engine/investigation-candidate-persistence", () => ({
  persistInternalInvestigationCandidate: persistInternalInvestigationCandidateMock,
}));

import { InvestigationSeedType } from "@prisma/client";

import { buildPublicActiveInvestigationWhere } from "../investigation-public-visibility";
import {
  extractStructuredUserMapCandidateProposal,
  tryCreateInternalUserMapCandidateFromAppMessage,
  type DarkRunOutputWithOptionalProposal,
} from "../understanding-dark-engine/app-message-candidate-bridge";

const FIXED_NOW = new Date("2026-06-01T12:00:00.000Z");

function makeDarkRunOutput(
  overrides: Partial<DarkRunOutputWithOptionalProposal> = {}
): DarkRunOutputWithOptionalProposal {
  return {
    mode: "no_write_dark_run",
    userId: "user-1",
    packet: {
      assembledAt: "2026-05-20T12:00:00.000Z",
      windowStart: "2026-02-20T00:00:00.000Z",
      windowEnd: "2026-05-20T12:00:00.000Z",
      metrics: {
        evidenceCount: 2,
        linkableEvidenceCount: 2,
        ownershipResolvableCount: 2,
        sourceCounts: {
          pattern_claim: 1,
          message: 1,
        },
        sourceDiversity: 2,
        timeSpreadDays: 3,
        importedCount: 0,
        nativeCount: 2,
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
      items: [
        {
          sourceType: "pattern_claim",
          sourceId: "pc-1",
          timestamp: "2026-05-17T12:00:00.000Z",
          authoredAt: null,
          role: "signal",
          weightClass: "critical",
          sourceFamily: "pattern_claim",
          publicSafetyLevel: "safe_summary",
          publicSafeSummary: "Possible recurring conflict trigger.",
          containsRawPrivateText: false,
          provenanceRefs: {},
          qualityFlags: ["HAS_PROVENANCE"],
          linkable: true,
          ownershipResolvable: true,
          highEmotionSignal: false,
          origin: "native",
          episodeKey: null,
        },
      ],
    },
    userMapEvaluation: {
      decision: "pass",
      allowedStatus: UserMapConclusionStatus.emerging,
      confidenceCap: 0.5,
      reasons: [],
      warnings: [],
      metrics: {
        evidenceCount: 2,
        sourceDiversity: 2,
        timeSpreadDays: 3,
        highEmotionDominanceRatio: 0,
        distinctEpisodeCount: 2,
      },
    },
    diagnostics: {
      packetsAssembled: 1,
      candidatesProposed: 1,
      candidatesWritten: 0,
      abstentions: 0,
      rejectionCountsByReason: {},
      sourceCounts: {},
      sourceDiversity: 2,
      timeSpreadDays: 3,
      importedVsNative: { imported: 0, native: 2, mixed: 0, unknown: 0 },
      highEmotionCaps: 0,
      singleEpisodeBlocks: 0,
      nonLinkableContextItems: 0,
      linkIntegrityWarnings: [],
      notes: [],
    },
    phaseHCompatibility: {
      required: false,
      reasons: [],
    },
    ...overrides,
  };
}

function makeInvestigationProposal() {
  return {
    seedType: InvestigationSeedType.pattern,
    title: "Worth exploring: Conflict shutdown pattern",
    organizingQuestion: "What would clarify whether conflict shutdown pattern?",
    summary:
      "This looks worth watching as an open question. Conflict shutdown pattern.",
    abstainReasons: ["INSUFFICIENT_EVIDENCE_COUNT" as const],
    evidenceSelections: [
      { sourceType: "pattern_claim" as const, sourceId: "pc-1" },
      { sourceType: "message" as const, sourceId: "msg-1" },
    ],
  };
}

function makeStructuredProposal() {
  return {
    area: "operating_logic" as const,
    title: "Conflict shutdown pattern",
    summary: "Candidate pattern across multiple owned sources.",
    target: {
      requestedStatus: UserMapConclusionStatus.emerging,
      identityLevelClaim: false,
      proposedSummary: "Candidate pattern across multiple owned sources.",
      requiresReceipt: true,
    },
    evidenceSelections: [
      { sourceType: "pattern_claim" as const, sourceId: "pc-1" },
      { sourceType: "message" as const, sourceId: "msg-1" },
    ],
  };
}

describe("APP message internal candidate bridge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    vi.clearAllMocks();
    resolveCandidateBridgeNoWriteTriggerEligibilityMock.mockResolvedValue({
      eligible: true,
      decision: "eligible",
      reason: "No-write trigger is eligible.",
      shouldMarkPending: false,
      cooldownRemainingMs: 0,
      eventType: "app_user_message",
      noWriteOnly: true,
    });
    runNoWriteUnderstandingDarkRunMock.mockResolvedValue(makeDarkRunOutput());
    evaluateNoWriteDarkRunOutputMock.mockReturnValue({
      passed: true,
      failures: [],
      warnings: [],
      checkedInvariants: [],
      summary: {
        itemCount: 1,
        failureCount: 0,
        warningCount: 0,
        rawLeakageFailureCount: 0,
        sourceSafetyFailureCount: 0,
        phaseHCompatibilityWarningCount: 0,
      },
    });
    persistInternalUserMapConclusionCandidateMock.mockResolvedValue({
      persistedConclusionId: "conclusion-1",
      payload: {
        blockedWriteReasons: [],
        candidatesWritten: 1,
      },
    });
    persistInternalInvestigationCandidateMock.mockResolvedValue({
      persistedInvestigationId: "inv-1",
      payload: {
        blockedWriteReasons: [],
        candidatesWritten: 1,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("passes triggerEvidenceAt into runtime eligibility resolution", async () => {
    await tryCreateInternalUserMapCandidateFromAppMessage({
      userId: "user-1",
      messageId: "msg-1",
      sessionOrigin: "APP",
      sessionSurfaceType: "journal_chat",
      now: FIXED_NOW,
    });

    expect(resolveCandidateBridgeNoWriteTriggerEligibilityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        eventType: "app_user_message",
        now: FIXED_NOW,
        triggerEvidenceAt: FIXED_NOW,
        logTag: "[APP_MESSAGE_CANDIDATE_BRIDGE]",
        context: { messageId: "msg-1" },
      })
    );
  });

  it("writes nothing when trigger eligibility is not eligible", async () => {
    resolveCandidateBridgeNoWriteTriggerEligibilityMock.mockResolvedValueOnce({
      eligible: false,
      decision: "suppressed_cooldown",
      reason: "Suppressed by no-write trigger cooldown.",
      shouldMarkPending: true,
      cooldownRemainingMs: 25_000,
      eventType: "app_user_message",
      noWriteOnly: true,
    });

    const result = await tryCreateInternalUserMapCandidateFromAppMessage({
      userId: "user-1",
      messageId: "msg-1",
      sessionOrigin: "APP",
      sessionSurfaceType: "journal_chat",
    });

    expect(result.decision).toBe("skipped_ineligible_trigger");
    expect(result.eligibilityDecision).toBe("suppressed_cooldown");
    expect(runNoWriteUnderstandingDarkRunMock).not.toHaveBeenCalled();
    expect(persistInternalUserMapConclusionCandidateMock).not.toHaveBeenCalled();
  });

  it("writes nothing when a prior run is still in flight", async () => {
    resolveCandidateBridgeNoWriteTriggerEligibilityMock.mockResolvedValueOnce({
      eligible: false,
      decision: "mark_trailing_pending",
      reason: "A no-write run is already in flight; mark a trailing pending run.",
      shouldMarkPending: true,
      cooldownRemainingMs: 20_000,
      eventType: "app_user_message",
      noWriteOnly: true,
    });

    const result = await tryCreateInternalUserMapCandidateFromAppMessage({
      userId: "user-1",
      messageId: "msg-1",
      sessionOrigin: "APP",
      sessionSurfaceType: "journal_chat",
      now: FIXED_NOW,
    });

    expect(result.decision).toBe("skipped_ineligible_trigger");
    expect(result.eligibilityDecision).toBe("mark_trailing_pending");
    expect(runNoWriteUnderstandingDarkRunMock).not.toHaveBeenCalled();
  });

  it("writes nothing when dark-run output lacks structured proposal data", async () => {
    const result = await tryCreateInternalUserMapCandidateFromAppMessage({
      userId: "user-1",
      messageId: "msg-1",
      sessionOrigin: "APP",
      sessionSurfaceType: "explore_chat",
    });

    expect(result.decision).toBe("skipped_insufficient_proposal");
    expect(runNoWriteUnderstandingDarkRunMock).toHaveBeenCalledTimes(1);
    expect(persistInternalUserMapConclusionCandidateMock).not.toHaveBeenCalled();
  });

  it("writes nothing when objectivity gates abstain without investigation proposal", async () => {
    runNoWriteUnderstandingDarkRunMock.mockResolvedValueOnce(
      makeDarkRunOutput({
        userMapEvaluation: {
          decision: "abstain",
          allowedStatus: UserMapConclusionStatus.emerging,
          confidenceCap: 0.3,
          reasons: ["INSUFFICIENT_EVIDENCE_COUNT"],
          warnings: [],
          metrics: {
            evidenceCount: 1,
            sourceDiversity: 1,
            timeSpreadDays: 0,
            highEmotionDominanceRatio: 0,
            distinctEpisodeCount: 1,
          },
        },
        userMapCandidateProposal: null,
        investigationCandidateProposal: null,
      })
    );

    const result = await tryCreateInternalUserMapCandidateFromAppMessage({
      userId: "user-1",
      messageId: "msg-1",
      sessionOrigin: "APP",
      sessionSurfaceType: "journal_chat",
    });

    expect(result.decision).toBe("skipped_gate_abstain");
    expect(persistInternalUserMapConclusionCandidateMock).not.toHaveBeenCalled();
    expect(persistInternalInvestigationCandidateMock).not.toHaveBeenCalled();
  });

  it("prefers UserMap persistence when userMapCandidateProposal is present", async () => {
    const userMapProposal = makeStructuredProposal();
    const investigationProposal = makeInvestigationProposal();
    runNoWriteUnderstandingDarkRunMock.mockResolvedValueOnce(
      makeDarkRunOutput({
        userMapCandidateProposal: userMapProposal,
        investigationCandidateProposal: investigationProposal,
      })
    );

    const result = await tryCreateInternalUserMapCandidateFromAppMessage({
      userId: "user-1",
      messageId: "msg-1",
      sessionOrigin: "APP",
      sessionSurfaceType: "journal_chat",
    });

    expect(result.decision).toBe("created");
    expect(persistInternalUserMapConclusionCandidateMock).toHaveBeenCalledTimes(1);
    expect(persistInternalInvestigationCandidateMock).not.toHaveBeenCalled();
  });

  it("persists Investigation candidate on abstain when only investigationCandidateProposal is present", async () => {
    const investigationProposal = makeInvestigationProposal();
    runNoWriteUnderstandingDarkRunMock.mockResolvedValueOnce(
      makeDarkRunOutput({
        userMapEvaluation: {
          decision: "abstain",
          allowedStatus: UserMapConclusionStatus.emerging,
          confidenceCap: 0.3,
          reasons: ["INSUFFICIENT_EVIDENCE_COUNT"],
          warnings: [],
          metrics: {
            evidenceCount: 1,
            sourceDiversity: 1,
            timeSpreadDays: 0,
            highEmotionDominanceRatio: 0,
            distinctEpisodeCount: 1,
          },
        },
        userMapCandidateProposal: null,
        investigationCandidateProposal: investigationProposal,
      })
    );

    const result = await tryCreateInternalUserMapCandidateFromAppMessage({
      userId: "user-1",
      messageId: "msg-1",
      sessionOrigin: "APP",
      sessionSurfaceType: "journal_chat",
    });

    expect(result.decision).toBe("created_investigation_candidate");
    expect(result.persistedInvestigationId).toBe("inv-1");
    expect(persistInternalInvestigationCandidateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        proposal: investigationProposal,
      })
    );
    expect(persistInternalUserMapConclusionCandidateMock).not.toHaveBeenCalled();
  });

  it("returns skipped_investigation_persistence_blocked when Investigation persistence blocks", async () => {
    runNoWriteUnderstandingDarkRunMock.mockResolvedValueOnce(
      makeDarkRunOutput({
        userMapEvaluation: {
          decision: "abstain",
          allowedStatus: UserMapConclusionStatus.emerging,
          confidenceCap: 0.3,
          reasons: ["INSUFFICIENT_EVIDENCE_COUNT"],
          warnings: [],
          metrics: {
            evidenceCount: 1,
            sourceDiversity: 1,
            timeSpreadDays: 0,
            highEmotionDominanceRatio: 0,
            distinctEpisodeCount: 1,
          },
        },
        investigationCandidateProposal: makeInvestigationProposal(),
      })
    );
    persistInternalInvestigationCandidateMock.mockResolvedValueOnce({
      persistedInvestigationId: null,
      payload: {
        blockedWriteReasons: ["INSUFFICIENT_LINKABLE_EVIDENCE_COUNT"],
        candidatesWritten: 0,
      },
    });

    const result = await tryCreateInternalUserMapCandidateFromAppMessage({
      userId: "user-1",
      messageId: "msg-1",
      sessionOrigin: "APP",
      sessionSurfaceType: "journal_chat",
    });

    expect(result.decision).toBe("skipped_investigation_persistence_blocked");
    expect(result.blockedWriteReasons).toEqual(["INSUFFICIENT_LINKABLE_EVIDENCE_COUNT"]);
    expect(persistInternalUserMapConclusionCandidateMock).not.toHaveBeenCalled();
  });

  it("writes nothing when harness fails", async () => {
    evaluateNoWriteDarkRunOutputMock.mockReturnValueOnce({
      passed: false,
      failures: [{ invariant: "no_write_invariant", message: "Harness failed." }],
      warnings: [],
      checkedInvariants: [],
      summary: {
        itemCount: 1,
        failureCount: 1,
        warningCount: 0,
        rawLeakageFailureCount: 0,
        sourceSafetyFailureCount: 0,
        phaseHCompatibilityWarningCount: 0,
      },
    });

    const result = await tryCreateInternalUserMapCandidateFromAppMessage({
      userId: "user-1",
      messageId: "msg-1",
      sessionOrigin: "APP",
      sessionSurfaceType: "journal_chat",
    });

    expect(result.decision).toBe("skipped_harness_failed");
    expect(persistInternalUserMapConclusionCandidateMock).not.toHaveBeenCalled();
    expect(persistInternalInvestigationCandidateMock).not.toHaveBeenCalled();
  });

  it("calls persistence when eligibility, harness, gates, and structured proposal are valid", async () => {
    const proposal = makeStructuredProposal();
    runNoWriteUnderstandingDarkRunMock.mockResolvedValueOnce(
      makeDarkRunOutput({ userMapCandidateProposal: proposal })
    );

    const result = await tryCreateInternalUserMapCandidateFromAppMessage({
      userId: "user-1",
      messageId: "msg-1",
      sessionOrigin: "APP",
      sessionSurfaceType: "journal_chat",
    });

    expect(result.decision).toBe("created");
    expect(result.persistedConclusionId).toBe("conclusion-1");
    expect(persistInternalUserMapConclusionCandidateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        area: proposal.area,
        title: proposal.title,
        summary: proposal.summary,
        target: proposal.target,
        evidenceSelections: proposal.evidenceSelections,
      })
    );
  });

  it("extractStructuredUserMapCandidateProposal returns null for orchestrator output without proposal field", () => {
    expect(extractStructuredUserMapCandidateProposal(makeDarkRunOutput())).toBeNull();
  });

  it("extractStructuredUserMapCandidateProposal validates required structured fields", () => {
    expect(
      extractStructuredUserMapCandidateProposal(
        makeDarkRunOutput({
          userMapCandidateProposal: {
            area: "operating_logic",
            title: "  ",
            summary: "Valid summary.",
            target: {
              requestedStatus: UserMapConclusionStatus.emerging,
              identityLevelClaim: false,
              proposedSummary: "Valid summary.",
              requiresReceipt: true,
            },
          },
        })
      )
    ).toBeNull();
  });

  it("does not surface Investigation candidates on Active Questions public guard", async () => {
    runNoWriteUnderstandingDarkRunMock.mockResolvedValueOnce(
      makeDarkRunOutput({
        userMapEvaluation: {
          decision: "abstain",
          allowedStatus: UserMapConclusionStatus.emerging,
          confidenceCap: 0.3,
          reasons: ["INSUFFICIENT_EVIDENCE_COUNT"],
          warnings: [],
          metrics: {
            evidenceCount: 1,
            sourceDiversity: 1,
            timeSpreadDays: 0,
            highEmotionDominanceRatio: 0,
            distinctEpisodeCount: 1,
          },
        },
        investigationCandidateProposal: makeInvestigationProposal(),
      })
    );

    await tryCreateInternalUserMapCandidateFromAppMessage({
      userId: "user-1",
      messageId: "msg-1",
      sessionOrigin: "APP",
      sessionSurfaceType: "journal_chat",
    });

    const publicWhere = buildPublicActiveInvestigationWhere({ userId: "user-1" });
    expect(publicWhere.visibility).toBe("user_visible");
    expect(publicWhere.OR).toEqual([
      { candidateLifecycleStatus: null },
      { candidateLifecycleStatus: "promoted" },
    ]);
    expect(persistInternalInvestigationCandidateMock).toHaveBeenCalled();
    expect(persistInternalUserMapConclusionCandidateMock).not.toHaveBeenCalled();
  });

  it("does not create user_visible conclusions or ModelUpdates through the bridge path", async () => {
    runNoWriteUnderstandingDarkRunMock.mockResolvedValueOnce(
      makeDarkRunOutput({ userMapCandidateProposal: makeStructuredProposal() })
    );

    await tryCreateInternalUserMapCandidateFromAppMessage({
      userId: "user-1",
      messageId: "msg-1",
      sessionOrigin: "APP",
      sessionSurfaceType: "journal_chat",
    });

    expect(persistInternalUserMapConclusionCandidateMock).toHaveBeenCalledTimes(1);
    const persistArgs = persistInternalUserMapConclusionCandidateMock.mock.calls[0]?.[0];
    expect(persistArgs).not.toHaveProperty("visibility", "user_visible");
  });
});
