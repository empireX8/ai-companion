import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";

const {
  runNoWriteUnderstandingDarkRunMock,
  evaluateNoWriteDarkRunOutputMock,
  persistInternalCandidateFromNoWriteDarkRunOutputMock,
} = vi.hoisted(() => ({
  runNoWriteUnderstandingDarkRunMock: vi.fn(),
  evaluateNoWriteDarkRunOutputMock: vi.fn(),
  persistInternalCandidateFromNoWriteDarkRunOutputMock: vi.fn(),
}));

vi.mock("../understanding-dark-engine/dark-run-orchestrator", () => ({
  runNoWriteUnderstandingDarkRun: runNoWriteUnderstandingDarkRunMock,
}));

vi.mock("../understanding-dark-engine/dark-run-evaluation-harness", () => ({
  evaluateNoWriteDarkRunOutput: evaluateNoWriteDarkRunOutputMock,
}));

vi.mock("../understanding-dark-engine/candidate-bridge-dark-run-persistence", () => ({
  persistInternalCandidateFromNoWriteDarkRunOutput:
    persistInternalCandidateFromNoWriteDarkRunOutputMock,
}));

import {
  parseCandidateCreationRuntimeValidationCliArgs,
  runCandidateCreationRuntimeValidation,
} from "../candidate-creation-runtime-validation";

const NOW = new Date("2026-06-02T12:00:00.000Z");

function makeDarkRunOutput() {
  return {
    userMapEvaluation: {
      decision: "pass",
      reasons: [],
    },
    userMapCandidateProposal: {
      area: "operating_logic",
      title: "SECRET_TITLE_DO_NOT_LEAK",
      summary: "SECRET_SUMMARY_DO_NOT_LEAK",
      target: {
        requestedStatus: "emerging",
        identityLevelClaim: false,
        proposedSummary: "SECRET_SUMMARY_DO_NOT_LEAK",
        requiresReceipt: true,
      },
      evidenceSelections: [
        { sourceType: "pattern_claim", sourceId: "pc-1" },
        { sourceType: "message", sourceId: "msg-1" },
      ],
    },
  };
}

function makeDb(overrides: Partial<Record<string, unknown>> = {}): PrismaClient {
  const patternDerivationRun = {
    id: "deriv-pattern",
    scope: "import",
    processorVersion: "pattern-v1",
    status: "completed",
    createdAt: new Date("2026-05-12T09:41:44.710Z"),
  };

  const defaults = {
    session: {
      count: vi.fn().mockResolvedValue(2),
      groupBy: vi
        .fn()
        .mockResolvedValueOnce([{ origin: "IMPORTED_ARCHIVE", _count: { _all: 2 } }])
        .mockResolvedValueOnce([{ surfaceType: null, _count: { _all: 2 } }]),
      findMany: vi.fn().mockResolvedValue([
        { origin: "IMPORTED_ARCHIVE", surfaceType: null },
        { origin: "IMPORTED_ARCHIVE", surfaceType: null },
      ]),
    },
    message: { count: vi.fn().mockResolvedValue(10) },
    evidenceSpan: { count: vi.fn().mockResolvedValue(5) },
    patternClaim: { count: vi.fn().mockResolvedValue(1) },
    userMapConclusion: { count: vi.fn().mockResolvedValue(0) },
    investigation: { count: vi.fn().mockResolvedValue(0) },
    fieldworkAssignment: { count: vi.fn().mockResolvedValue(0) },
    modelUpdate: { count: vi.fn().mockResolvedValue(0) },
    importUploadSession: {
      findFirst: vi.fn().mockResolvedValue({
        id: "import-1",
        status: "complete",
        createdAt: new Date("2026-05-12T09:38:11.502Z"),
        finishedAt: new Date("2026-05-12T09:41:37.814Z"),
        sessionsCreated: 2,
        messagesCreated: 10,
      }),
    },
    derivationRun: {
      findFirst: vi.fn().mockImplementation(
        async (args: { where?: { status?: unknown; processorVersion?: string } }) => {
          if (args.where?.status) {
            return null;
          }
          if (args.where?.processorVersion === "understanding-dark-engine-v1") {
            return null;
          }
          return patternDerivationRun;
        }
      ),
      count: vi.fn().mockResolvedValue(0),
    },
  };

  return { ...defaults, ...overrides } as unknown as PrismaClient;
}

describe("candidate creation runtime validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runNoWriteUnderstandingDarkRunMock.mockResolvedValue(makeDarkRunOutput());
    evaluateNoWriteDarkRunOutputMock.mockReturnValue({
      passed: true,
      summary: { failureCount: 0 },
    });
    persistInternalCandidateFromNoWriteDarkRunOutputMock.mockResolvedValue({
      decision: "created",
      reason: "Internal UserMap candidate persisted.",
      persistedConclusionId: "conclusion-1",
    });
  });

  describe("CLI argument parsing", () => {
    it("requires --user-id and defaults to dry-run", () => {
      expect(parseCandidateCreationRuntimeValidationCliArgs([])).toEqual({
        ok: false,
        message: "Missing required --user-id argument.",
      });

      expect(
        parseCandidateCreationRuntimeValidationCliArgs(["--user-id", "user-1"])
      ).toEqual({
        ok: true,
        args: { userId: "user-1", dryRun: true },
      });

      expect(
        parseCandidateCreationRuntimeValidationCliArgs([
          "--user-id",
          "user-1",
          "--execute",
        ])
      ).toEqual({
        ok: true,
        args: { userId: "user-1", dryRun: false },
      });
    });
  });

  describe("runCandidateCreationRuntimeValidation", () => {
    it("dry-run does not persist candidates", async () => {
      const db = makeDb();

      const report = await runCandidateCreationRuntimeValidation({
        userId: "user-1",
        dryRun: true,
        now: NOW,
        db,
      });

      expect(report.dryRun).toBe(true);
      expect(report.persistence.attempted).toBe(false);
      expect(report.persistence.decision).toBe("dry_run_skipped_persistence");
      expect(persistInternalCandidateFromNoWriteDarkRunOutputMock).not.toHaveBeenCalled();
      expect(report.candidateCountsBefore).toEqual(report.candidateCountsAfter);
    });

    it("non-dry-run persists through the existing bridge helper", async () => {
      const db = makeDb({
        userMapConclusion: {
          count: vi
            .fn()
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(1),
        },
      });

      const report = await runCandidateCreationRuntimeValidation({
        userId: "user-1",
        dryRun: false,
        now: NOW,
        db,
      });

      expect(report.persistence.attempted).toBe(true);
      expect(report.persistence.decision).toBe("created");
      expect(report.persistence.persistedConclusionId).toBe("conclusion-1");
      expect(persistInternalCandidateFromNoWriteDarkRunOutputMock).toHaveBeenCalledOnce();
    });

    it("does not expose raw proposal text in report output", async () => {
      const report = await runCandidateCreationRuntimeValidation({
        userId: "user-1",
        dryRun: true,
        now: NOW,
        db: makeDb(),
      });

      const serialized = JSON.stringify(report);
      expect(serialized).not.toContain("SECRET_TITLE_DO_NOT_LEAK");
      expect(serialized).not.toContain("SECRET_SUMMARY_DO_NOT_LEAK");
      expect(report.darkRun?.proposalPresence).toEqual({
        userMap: true,
        userMapArea: "operating_logic",
        investigation: false,
        fieldwork: false,
        modelUpdate: false,
      });
    });

    it("returns clean zero-state diagnostics when no candidates exist", async () => {
      const report = await runCandidateCreationRuntimeValidation({
        userId: "user-1",
        dryRun: true,
        now: NOW,
        db: makeDb(),
      });

      expect(report.candidateCountsBefore).toEqual({
        userMapConclusion: 0,
        investigation: 0,
        fieldworkAssignment: 0,
        modelUpdate: 0,
      });
      expect(report.understandingDarkEngineDerivationRunCount).toBe(0);
      expect(report.sessionTriggerSummary.appBridgeEligibleSessions).toBe(0);
      expect(report.diagnosis.appMessageBridgeWouldRunForAnySession).toBe(false);
    });
  });
});
