import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const runNoWriteUnderstandingDarkRunMock = vi.fn();
const evaluateNoWriteDarkRunOutputMock = vi.fn();

const runManualUnderstandingDarkEngineDarkRunMock = vi.fn();
const persistInternalUserMapConclusionCandidateMock = vi.fn();
const createUnderstandingEvidenceLinkForUserMock = vi.fn();

const prismadbMock = {
  userMapConclusion: {
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
  derivationRun: {
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
  derivationArtifact: {
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
  understandingEvidenceLink: {
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
};

const OLD_ENV = process.env;

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("../prismadb", () => ({
  default: prismadbMock,
}));

vi.mock("../understanding-dark-engine/dark-run-orchestrator", () => ({
  runNoWriteUnderstandingDarkRun: runNoWriteUnderstandingDarkRunMock,
}));

vi.mock("../understanding-dark-engine/dark-run-evaluation-harness", () => ({
  evaluateNoWriteDarkRunOutput: evaluateNoWriteDarkRunOutputMock,
}));

vi.mock("../understanding-dark-engine/diagnostics-persistence", () => ({
  runManualUnderstandingDarkEngineDarkRun:
    runManualUnderstandingDarkEngineDarkRunMock,
}));

vi.mock("../understanding-dark-engine/user-map-candidate-persistence", () => ({
  persistInternalUserMapConclusionCandidate:
    persistInternalUserMapConclusionCandidateMock,
}));

vi.mock("../understanding-evidence-link-writer", () => ({
  createUnderstandingEvidenceLinkForUser: createUnderstandingEvidenceLinkForUserMock,
}));

function makeNoWriteOutput() {
  return {
    mode: "no_write_dark_run" as const,
    userId: "reviewer-1",
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
        {
          sourceType: "message",
          sourceId: "msg-1",
          timestamp: "2026-05-18T12:00:00.000Z",
          authoredAt: null,
          role: "signal",
          weightClass: "moderate",
          sourceFamily: "message",
          publicSafetyLevel: "internal_only",
          containsRawPrivateText: true,
          provenanceRefs: {
            sessionId: "s-1",
            messageId: "msg-1",
          },
          qualityFlags: ["HAS_PROVENANCE"],
          linkable: true,
          ownershipResolvable: true,
          highEmotionSignal: false,
          origin: "native",
          episodeKey: "session:s-1",
        },
      ],
    },
    userMapEvaluation: {
      decision: "abstain" as const,
      allowedStatus: "emerging",
      confidenceCap: 0.3,
      reasons: ["INSUFFICIENT_EVIDENCE_COUNT"],
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
      abstentions: 1,
      rejectionCountsByReason: {
        INSUFFICIENT_EVIDENCE_COUNT: 1,
      },
      sourceCounts: {
        pattern_claim: 1,
        message: 1,
      },
      sourceDiversity: 2,
      timeSpreadDays: 3,
      importedVsNative: {
        imported: 0,
        native: 2,
        mixed: 0,
        unknown: 0,
      },
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
  };
}

function makeHarnessPass() {
  return {
    passed: true,
    failures: [],
    warnings: [],
    checkedInvariants: [
      "no_raw_evidence_leakage",
      "source_safety_compliance",
      "phase_h_compatibility",
      "evaluation_gate_quality",
      "no_write_invariant",
    ],
    summary: {
      itemCount: 2,
      failureCount: 0,
      warningCount: 0,
      rawLeakageFailureCount: 0,
      sourceSafetyFailureCount: 0,
      phaseHCompatibilityWarningCount: 0,
    },
  };
}

function makeSafeDiagnosticsSummary() {
  const diagnostics = makeNoWriteOutput().diagnostics;
  return {
    packetsAssembled: diagnostics.packetsAssembled,
    candidatesProposed: diagnostics.candidatesProposed,
    candidatesWritten: diagnostics.candidatesWritten,
    abstentions: diagnostics.abstentions,
    rejectionCountsByReason: diagnostics.rejectionCountsByReason,
    sourceCounts: diagnostics.sourceCounts,
    sourceDiversity: diagnostics.sourceDiversity,
    timeSpreadDays: diagnostics.timeSpreadDays,
    importedVsNative: diagnostics.importedVsNative,
    highEmotionCaps: diagnostics.highEmotionCaps,
    singleEpisodeBlocks: diagnostics.singleEpisodeBlocks,
    nonLinkableContextItems: diagnostics.nonLinkableContextItems,
    linkIntegrityWarnings: diagnostics.linkIntegrityWarnings,
  };
}

describe("Phase 2D internal no-write dark-run route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...OLD_ENV,
      INTERNAL_USER_MAP_REVIEWER_IDS: "reviewer-1",
    };

    authMock.mockResolvedValue({ userId: "reviewer-1" });
    runNoWriteUnderstandingDarkRunMock.mockResolvedValue(makeNoWriteOutput());
    evaluateNoWriteDarkRunOutputMock.mockReturnValue(makeHarnessPass());
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const route = await import(
      "../../app/api/internal/understanding-dark-run/no-write/route"
    );
    const response = await route.GET();

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(runNoWriteUnderstandingDarkRunMock).not.toHaveBeenCalled();
    expect(evaluateNoWriteDarkRunOutputMock).not.toHaveBeenCalled();
  });

  it("returns 403 for authenticated non-allowlisted users", async () => {
    authMock.mockResolvedValueOnce({ userId: "non-reviewer" });

    const route = await import(
      "../../app/api/internal/understanding-dark-run/no-write/route"
    );
    const response = await route.GET();

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(runNoWriteUnderstandingDarkRunMock).not.toHaveBeenCalled();
    expect(evaluateNoWriteDarkRunOutputMock).not.toHaveBeenCalled();
  });

  it("returns 403 when allowlist is empty", async () => {
    process.env = {
      ...OLD_ENV,
      INTERNAL_USER_MAP_REVIEWER_IDS: "",
    };

    const route = await import(
      "../../app/api/internal/understanding-dark-run/no-write/route"
    );
    const response = await route.GET();

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(runNoWriteUnderstandingDarkRunMock).not.toHaveBeenCalled();
    expect(evaluateNoWriteDarkRunOutputMock).not.toHaveBeenCalled();
  });

  it("runs no-write orchestrator + harness and returns safe internal JSON for allowlisted users", async () => {
    const route = await import(
      "../../app/api/internal/understanding-dark-run/no-write/route"
    );
    const response = await route.GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const payload = await response.json();
    expect(payload.mode).toBe("no_write_dark_run");
    expect(payload.packet).toEqual({
      metrics: makeNoWriteOutput().packet.metrics,
    });
    expect(payload.userMapEvaluation).toEqual(makeNoWriteOutput().userMapEvaluation);
    expect(payload.diagnostics).toEqual(makeSafeDiagnosticsSummary());
    expect(payload.phaseHCompatibility).toEqual(makeNoWriteOutput().phaseHCompatibility);
    expect(payload.harness).toEqual(makeHarnessPass());
    expect(Array.isArray(payload.sanitizedPacketItems)).toBe(true);
    expect(payload.sanitizedPacketItems.length).toBe(2);

    expect(runNoWriteUnderstandingDarkRunMock).toHaveBeenCalledWith({
      userId: "reviewer-1",
    });
    expect(evaluateNoWriteDarkRunOutputMock).toHaveBeenCalledWith(
      makeNoWriteOutput()
    );
  });

  it("excludes raw-like keys from response payload and packet items", async () => {
    const outputWithUnsafeKey = makeNoWriteOutput() as ReturnType<
      typeof makeNoWriteOutput
    > & {
      packet: {
        items: Array<Record<string, unknown>>;
      };
    };
    outputWithUnsafeKey.packet.items[0] = {
      ...outputWithUnsafeKey.packet.items[0],
      quote: "should never pass through",
    };

    runNoWriteUnderstandingDarkRunMock.mockResolvedValueOnce(outputWithUnsafeKey);

    const route = await import(
      "../../app/api/internal/understanding-dark-run/no-write/route"
    );
    const response = await route.GET();
    const payload = await response.json();

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('"quote"');
    expect(serialized).not.toContain('"snippet"');
    expect(serialized).not.toContain('"rawText"');
    expect(serialized).not.toContain('"journalText"');
    expect(serialized).not.toContain('"messageText"');
    expect(serialized).not.toContain('"observationText"');
    expect(serialized).not.toContain('"privateText"');

    for (const item of payload.sanitizedPacketItems as Array<Record<string, unknown>>) {
      expect(item).not.toHaveProperty("quote");
      expect(item).not.toHaveProperty("snippet");
      expect(item).not.toHaveProperty("note");

      if (item.publicSafetyLevel !== "safe_summary") {
        expect(item).not.toHaveProperty("publicSafeSummary");
      }
    }
  });

  it("returns harness summary without packet items when harness fails", async () => {
    evaluateNoWriteDarkRunOutputMock.mockReturnValueOnce({
      passed: false,
      failures: [
        {
          invariant: "no_raw_evidence_leakage",
          message: "Sanitized item exposes raw-like field.",
        },
      ],
      warnings: [],
      checkedInvariants: [
        "no_raw_evidence_leakage",
        "source_safety_compliance",
        "phase_h_compatibility",
        "evaluation_gate_quality",
        "no_write_invariant",
      ],
      summary: {
        itemCount: 2,
        failureCount: 1,
        warningCount: 0,
        rawLeakageFailureCount: 1,
        sourceSafetyFailureCount: 0,
        phaseHCompatibilityWarningCount: 0,
      },
    });

    const route = await import(
      "../../app/api/internal/understanding-dark-run/no-write/route"
    );
    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.harness.passed).toBe(false);
    expect(payload.packet.metrics.evidenceCount).toBe(2);
    expect(payload).not.toHaveProperty("sanitizedPacketItems");
  });

  it("does not call dark-run write-path helpers or prisma write methods", async () => {
    const route = await import(
      "../../app/api/internal/understanding-dark-run/no-write/route"
    );
    await route.GET();

    expect(runManualUnderstandingDarkEngineDarkRunMock).not.toHaveBeenCalled();
    expect(persistInternalUserMapConclusionCandidateMock).not.toHaveBeenCalled();
    expect(createUnderstandingEvidenceLinkForUserMock).not.toHaveBeenCalled();

    expect(prismadbMock.userMapConclusion.create).not.toHaveBeenCalled();
    expect(prismadbMock.userMapConclusion.update).not.toHaveBeenCalled();
    expect(prismadbMock.userMapConclusion.upsert).not.toHaveBeenCalled();
    expect(prismadbMock.userMapConclusion.delete).not.toHaveBeenCalled();
    expect(prismadbMock.derivationRun.create).not.toHaveBeenCalled();
    expect(prismadbMock.derivationRun.update).not.toHaveBeenCalled();
    expect(prismadbMock.derivationRun.upsert).not.toHaveBeenCalled();
    expect(prismadbMock.derivationRun.delete).not.toHaveBeenCalled();
    expect(prismadbMock.derivationArtifact.create).not.toHaveBeenCalled();
    expect(prismadbMock.derivationArtifact.update).not.toHaveBeenCalled();
    expect(prismadbMock.derivationArtifact.upsert).not.toHaveBeenCalled();
    expect(prismadbMock.derivationArtifact.delete).not.toHaveBeenCalled();
    expect(prismadbMock.understandingEvidenceLink.create).not.toHaveBeenCalled();
    expect(prismadbMock.understandingEvidenceLink.update).not.toHaveBeenCalled();
    expect(prismadbMock.understandingEvidenceLink.upsert).not.toHaveBeenCalled();
    expect(prismadbMock.understandingEvidenceLink.delete).not.toHaveBeenCalled();
  });
});
