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
  classifyInvestigationCandidateDiscoveryRecommendation,
  loadCandidateUserIdsForScan,
  parseDiscoverInvestigationCandidateProposalCliArgs,
  runDiscoverInvestigationCandidateProposal,
} from "../discover-investigation-candidate-proposal";
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
        investigation: true,
        fieldwork: false,
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

describe("discover investigation candidate proposal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runCandidateCreationRuntimeValidationMock.mockImplementation(
      async (args: { userId: string }) =>
        makeValidationReport({
          userId: args.userId,
          darkRun:
            args.userId === "user-investigation"
              ? {
                  harnessPassed: true,
                  harnessFailureCount: 0,
                  userMapGateDecision: "abstain",
                  userMapGateReasons: [],
                  proposalPresence: {
                    userMap: false,
                    userMapArea: null,
                    investigation: true,
                    fieldwork: false,
                    modelUpdate: false,
                  },
                }
              : {
                  harnessPassed: true,
                  harnessFailureCount: 0,
                  userMapGateDecision: "pass",
                  userMapGateReasons: [],
                  proposalPresence: {
                    userMap: true,
                    userMapArea: "operating_logic",
                    investigation: false,
                    fieldwork: false,
                    modelUpdate: false,
                  },
                },
        })
    );
  });

  it("parses CLI args with limit and repeated user ids", () => {
    expect(parseDiscoverInvestigationCandidateProposalCliArgs([])).toEqual({
      ok: true,
      args: { limit: 10, userIds: [] },
    });

    expect(
      parseDiscoverInvestigationCandidateProposalCliArgs([
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
    const report = await runDiscoverInvestigationCandidateProposal({
      userIds: ["user-investigation"],
      db: makeDb(),
      now: NOW,
    });

    expect(runCandidateCreationRuntimeValidationMock).toHaveBeenCalledWith({
      userId: "user-investigation",
      dryRun: true,
      now: NOW,
      db: expect.anything(),
    });
    expect(report.dryRun).toBe(true);
    expect(report.perUser[0]?.recommendation).toBe("safe_for_investigation_execute");
  });

  it("identifies user with investigation true and userMap false", async () => {
    const report = await runDiscoverInvestigationCandidateProposal({
      userIds: ["user-investigation"],
      db: makeDb(),
      now: NOW,
    });

    expect(report.safeForInvestigationExecute).toEqual([
      expect.objectContaining({
        rank: 1,
        userId: "user-investigation",
        proposalPresence: expect.objectContaining({
          investigation: true,
          userMap: false,
        }),
      }),
    ]);
    expect(report.discoverySucceeded).toBe(true);
  });

  it("rejects userMap true / investigation false for Investigation validation", async () => {
    const report = await runDiscoverInvestigationCandidateProposal({
      userIds: ["user-usermap"],
      db: makeDb(),
      now: NOW,
    });

    expect(report.perUser[0]).toEqual(
      expect.objectContaining({
        userId: "user-usermap",
        recommendation: "not_investigation_candidate",
        proposalPresence: expect.objectContaining({
          userMap: true,
          investigation: false,
        }),
      })
    );
    expect(report.safeForInvestigationExecute).toEqual([]);
    expect(report.discoverySucceeded).toBe(false);
  });

  it("handles no users found without treating it as a scan failure", async () => {
    const db = makeDb({
      message: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
    });

    const report = await runDiscoverInvestigationCandidateProposal({
      db,
      now: NOW,
    });

    expect(report.scannedUserCount).toBe(0);
    expect(report.perUser).toEqual([]);
    expect(report.discoverySucceeded).toBe(false);
    expect(report.diagnosticMessage).toContain("no users were available to scan");
  });

  it("handles per-user errors without aborting full scan", async () => {
    runCandidateCreationRuntimeValidationMock.mockImplementation(async (args: { userId: string }) => {
      if (args.userId === "user-broken") {
        throw new Error("dark-run failed");
      }

      return makeValidationReport({ userId: args.userId });
    });

    const report = await runDiscoverInvestigationCandidateProposal({
      userIds: ["user-broken", "user-investigation"],
      db: makeDb(),
      now: NOW,
    });

    expect(report.perUser).toHaveLength(2);
    expect(report.perUser[0]).toEqual(
      expect.objectContaining({
        userId: "user-broken",
        recommendation: "error",
        errorMessage: "dark-run failed",
      })
    );
    expect(report.perUser[1]?.recommendation).toBe("safe_for_investigation_execute");
  });

  it("respects limit and explicit user filters", async () => {
    const db = makeDb();

    const explicitIds = await loadCandidateUserIdsForScan({
      db,
      explicitUserIds: ["user-a", "user-b", "user-c"],
      limit: 2,
    });
    expect(explicitIds).toEqual(["user-a", "user-b"]);

    await runDiscoverInvestigationCandidateProposal({
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
    const classification = classifyInvestigationCandidateDiscoveryRecommendation(
      makeValidationReport({
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
      })
    );

    expect(classification).toEqual({
      recommendation: "skipped",
      skippedReason: "manual_internal trigger not eligible",
    });
  });
});
