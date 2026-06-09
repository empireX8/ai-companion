import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

const { runCandidateCreationRuntimeValidationMock } = vi.hoisted(() => ({
  runCandidateCreationRuntimeValidationMock: vi.fn(),
}));

vi.mock("../candidate-creation-runtime-validation", async () => {
  const actual = await vi.importActual<typeof import("../candidate-creation-runtime-validation")>(
    "../candidate-creation-runtime-validation"
  );

  return {
    ...actual,
    runCandidateCreationRuntimeValidation: runCandidateCreationRuntimeValidationMock,
  };
});

import {
  classifyFieldworkCandidateDiscoveryRecommendation,
  classifyModelUpdateCandidateDiscoveryRecommendation,
  parseDiscoverCandidateFamilyProposalsCliArgs,
  runDiscoverCandidateFamilyProposals,
} from "../discover-candidate-family-proposals";
import { loadCandidateUserIdsForScan } from "../discover-investigation-candidate-proposal";
import type { CandidateCreationRuntimeValidationReport } from "../candidate-creation-runtime-validation";

const NOW = new Date("2026-06-09T12:00:00.000Z");

function makeValidationReport(
  overrides: Partial<CandidateCreationRuntimeValidationReport> = {}
): CandidateCreationRuntimeValidationReport {
  return {
    userId: "user-1",
    dryRun: true,
    generatedAt: NOW.toISOString(),
    inputCounts: {
      session: 2,
      message: 10,
      evidenceSpan: 5,
      patternClaim: 1,
    },
    candidateCountsBefore: {
      userMapConclusion: 0,
      investigation: 0,
      fieldworkAssignment: 0,
      modelUpdate: 0,
    },
    candidateCountsAfter: {
      userMapConclusion: 0,
      investigation: 0,
      fieldworkAssignment: 0,
      modelUpdate: 0,
    },
    latestCompletedImportSession: null,
    latestDerivationRun: null,
    latestUnderstandingDarkEngineDerivationRun: null,
    understandingDarkEngineDerivationRunCount: 0,
    sessionTriggerSummary: {
      totalSessions: 2,
      appBridgeEligibleSessions: 0,
      origins: [],
      surfaceTypes: [],
    },
    triggerEligibility: {
      importCompleted: {
        eligible: false,
        decision: "blocked_no_new_evidence",
        reason: "none",
        shouldMarkPending: false,
        cooldownRemainingMs: 0,
        eventType: "import_completed",
        noWriteOnly: true,
      },
      appUserMessage: {
        eligible: false,
        decision: "blocked_no_new_evidence",
        reason: "none",
        shouldMarkPending: false,
        cooldownRemainingMs: 0,
        eventType: "app_user_message",
        noWriteOnly: true,
      },
      manualInternal: {
        eligible: true,
        decision: "eligible",
        reason: "manual override",
        shouldMarkPending: false,
        cooldownRemainingMs: 0,
        eventType: "manual_internal",
        noWriteOnly: true,
      },
    },
    darkRun: {
      harnessPassed: true,
      harnessFailureCount: 0,
      userMapGateDecision: "abstain",
      userMapGateReasons: [],
      proposalPresence: {
        userMap: false,
        userMapArea: null,
        investigation: false,
        fieldwork: true,
        modelUpdate: false,
      },
    },
    persistence: {
      attempted: false,
      dryRun: true,
      decision: "dry_run_skipped_persistence",
      reason: "Dry-run mode; persistence was not attempted.",
      persistedConclusionId: null,
      persistedInvestigationId: null,
      persistedFieldworkAssignmentId: null,
      persistedModelUpdateId: null,
      blockedWriteReasons: [],
    },
    diagnosis: {
      importCompletionBridgeRerunnable: false,
      appMessageBridgeWouldRunForAnySession: false,
      likelyRootCause: "test",
    },
    ...overrides,
  };
}

function makeDb(overrides: Partial<Record<string, unknown>> = {}): PrismaClient {
  const defaults = {
    message: {
      groupBy: vi.fn().mockResolvedValue([
        { userId: "user-heavy", _count: { _all: 20 } },
        { userId: "user-light", _count: { _all: 3 } },
      ]),
    },
  };

  return { ...defaults, ...overrides } as unknown as PrismaClient;
}

function proposalPresenceForUser(userId: string) {
  if (userId === "user-fieldwork") {
    return {
      userMap: false,
      userMapArea: null,
      investigation: false,
      fieldwork: true,
      modelUpdate: false,
    };
  }

  if (userId === "user-model-update") {
    return {
      userMap: false,
      userMapArea: null,
      investigation: false,
      fieldwork: false,
      modelUpdate: true,
    };
  }

  if (userId === "user-usermap") {
    return {
      userMap: true,
      userMapArea: "operating_logic",
      investigation: false,
      fieldwork: false,
      modelUpdate: false,
    };
  }

  if (userId === "user-investigation") {
    return {
      userMap: false,
      userMapArea: null,
      investigation: true,
      fieldwork: false,
      modelUpdate: false,
    };
  }

  return {
    userMap: false,
    userMapArea: null,
    investigation: false,
    fieldwork: false,
    modelUpdate: false,
  };
}

describe("discover candidate family proposals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runCandidateCreationRuntimeValidationMock.mockImplementation(
      async (args: { userId: string }) =>
        makeValidationReport({
          userId: args.userId,
          darkRun: {
            harnessPassed: true,
            harnessFailureCount: 0,
            userMapGateDecision: "abstain",
            userMapGateReasons: [],
            proposalPresence: proposalPresenceForUser(args.userId),
          },
        })
    );
  });

  it("parses CLI args with limit and repeated user ids", () => {
    expect(parseDiscoverCandidateFamilyProposalsCliArgs([])).toEqual({
      ok: true,
      args: { limit: 10, userIds: [] },
    });

    expect(
      parseDiscoverCandidateFamilyProposalsCliArgs([
        "--limit",
        "5",
        "--user-id",
        "user-a,user-b",
        "--user-id",
        "user-c",
      ])
    ).toEqual({
      ok: true,
      args: { limit: 5, userIds: ["user-a", "user-b", "user-c"] },
    });
  });

  it("does not call persistence and always uses dry-run validation", async () => {
    const report = await runDiscoverCandidateFamilyProposals({
      userIds: ["user-fieldwork"],
      db: makeDb(),
      now: NOW,
    });

    expect(runCandidateCreationRuntimeValidationMock).toHaveBeenCalledWith({
      userId: "user-fieldwork",
      dryRun: true,
      now: NOW,
      db: expect.anything(),
    });
    expect(report.dryRun).toBe(true);
    expect(report.perUser[0]?.fieldworkRecommendation).toBe("safe_for_fieldwork_execute");
  });

  it("identifies Fieldwork-safe user with fieldwork true and higher-priority families false", async () => {
    const report = await runDiscoverCandidateFamilyProposals({
      userIds: ["user-fieldwork"],
      db: makeDb(),
      now: NOW,
    });

    expect(report.safeForFieldworkExecute).toEqual([
      expect.objectContaining({
        rank: 1,
        userId: "user-fieldwork",
        proposalPresence: expect.objectContaining({
          fieldwork: true,
          userMap: false,
          investigation: false,
        }),
      }),
    ]);
    expect(report.fieldworkDiscoverySucceeded).toBe(true);
  });

  it("rejects Fieldwork when userMap or investigation is true", async () => {
    const usermapReport = await runDiscoverCandidateFamilyProposals({
      userIds: ["user-usermap"],
      db: makeDb(),
      now: NOW,
    });
    expect(usermapReport.perUser[0]).toEqual(
      expect.objectContaining({
        userId: "user-usermap",
        fieldworkRecommendation: "not_fieldwork_candidate",
      })
    );

    const investigationReport = await runDiscoverCandidateFamilyProposals({
      userIds: ["user-investigation"],
      db: makeDb(),
      now: NOW,
    });
    expect(investigationReport.perUser[0]).toEqual(
      expect.objectContaining({
        userId: "user-investigation",
        fieldworkRecommendation: "not_fieldwork_candidate",
      })
    );
    expect(investigationReport.safeForFieldworkExecute).toEqual([]);
  });

  it("identifies ModelUpdate-safe user with modelUpdate true and all higher-priority families false", async () => {
    const report = await runDiscoverCandidateFamilyProposals({
      userIds: ["user-model-update"],
      db: makeDb(),
      now: NOW,
    });

    expect(report.safeForModelUpdateExecute).toEqual([
      expect.objectContaining({
        rank: 1,
        userId: "user-model-update",
        proposalPresence: expect.objectContaining({
          modelUpdate: true,
          userMap: false,
          investigation: false,
          fieldwork: false,
        }),
      }),
    ]);
    expect(report.modelUpdateDiscoverySucceeded).toBe(true);
  });

  it("rejects ModelUpdate when any higher-priority family is true", async () => {
    const usermapReport = await runDiscoverCandidateFamilyProposals({
      userIds: ["user-usermap"],
      db: makeDb(),
      now: NOW,
    });
    expect(usermapReport.perUser[0]?.modelUpdateRecommendation).toBe(
      "not_model_update_candidate"
    );

    const investigationReport = await runDiscoverCandidateFamilyProposals({
      userIds: ["user-investigation"],
      db: makeDb(),
      now: NOW,
    });
    expect(investigationReport.perUser[0]?.modelUpdateRecommendation).toBe(
      "not_model_update_candidate"
    );

    const fieldworkReport = await runDiscoverCandidateFamilyProposals({
      userIds: ["user-fieldwork"],
      db: makeDb(),
      now: NOW,
    });
    expect(fieldworkReport.perUser[0]?.modelUpdateRecommendation).toBe(
      "not_model_update_candidate"
    );
    expect(fieldworkReport.safeForModelUpdateExecute).toEqual([]);
  });

  it("handles no users found without treating it as a scan failure", async () => {
    const db = makeDb({
      message: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
    });

    const report = await runDiscoverCandidateFamilyProposals({
      db,
      now: NOW,
    });

    expect(report.scannedUserCount).toBe(0);
    expect(report.perUser).toEqual([]);
    expect(report.fieldworkDiscoverySucceeded).toBe(false);
    expect(report.modelUpdateDiscoverySucceeded).toBe(false);
    expect(report.fieldworkDiagnosticMessage).toContain("no users were available to scan");
    expect(report.modelUpdateDiagnosticMessage).toContain("no users were available to scan");
  });

  it("handles per-user errors without aborting full scan", async () => {
    runCandidateCreationRuntimeValidationMock.mockImplementation(async (args: { userId: string }) => {
      if (args.userId === "user-broken") {
        throw new Error("dark-run failed");
      }

      return makeValidationReport({
        userId: args.userId,
        darkRun: {
          harnessPassed: true,
          harnessFailureCount: 0,
          userMapGateDecision: "abstain",
          userMapGateReasons: [],
          proposalPresence: proposalPresenceForUser(args.userId),
        },
      });
    });

    const report = await runDiscoverCandidateFamilyProposals({
      userIds: ["user-broken", "user-fieldwork"],
      db: makeDb(),
      now: NOW,
    });

    expect(report.perUser).toHaveLength(2);
    expect(report.perUser[0]).toEqual(
      expect.objectContaining({
        userId: "user-broken",
        fieldworkRecommendation: "error",
        modelUpdateRecommendation: "error",
        errorMessage: "dark-run failed",
      })
    );
    expect(report.perUser[1]?.fieldworkRecommendation).toBe("safe_for_fieldwork_execute");
  });

  it("respects limit and explicit user filters", async () => {
    const db = makeDb();

    const explicitIds = await loadCandidateUserIdsForScan({
      db,
      explicitUserIds: ["user-a", "user-b", "user-c"],
      limit: 2,
    });
    expect(explicitIds).toEqual(["user-a", "user-b"]);

    await runDiscoverCandidateFamilyProposals({
      limit: 1,
      db,
      now: NOW,
    });

    expect(db.message.groupBy).toHaveBeenCalledOnce();
    const loadedIds = await loadCandidateUserIdsForScan({
      db,
      explicitUserIds: [],
      limit: 1,
    });
    expect(loadedIds).toEqual(["user-heavy"]);
  });

  it("classifies skipped users when dark run is unavailable", () => {
    const skippedReport = makeValidationReport({
      darkRun: null,
      persistence: {
        attempted: false,
        dryRun: true,
        decision: "skipped_ineligible_trigger",
        reason: "manual_internal trigger not eligible",
        persistedConclusionId: null,
        persistedInvestigationId: null,
        persistedFieldworkAssignmentId: null,
        persistedModelUpdateId: null,
        blockedWriteReasons: [],
      },
    });

    expect(classifyFieldworkCandidateDiscoveryRecommendation(skippedReport)).toEqual({
      fieldworkRecommendation: "skipped",
      fieldworkSkippedReason: "manual_internal trigger not eligible",
    });

    expect(classifyModelUpdateCandidateDiscoveryRecommendation(skippedReport)).toEqual({
      modelUpdateRecommendation: "skipped",
      modelUpdateSkippedReason: "manual_internal trigger not eligible",
    });
  });
});
