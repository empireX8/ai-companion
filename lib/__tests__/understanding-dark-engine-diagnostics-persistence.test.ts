import { UserMapConclusionStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  UNDERSTANDING_DARK_ENGINE_DIAGNOSTICS_ARTIFACT_TYPE,
} from "../derivation-layer";
import { runManualUnderstandingDarkEngineDarkRun } from "../understanding-dark-engine/diagnostics-persistence";

const FIXED_TIME = new Date("2026-05-15T12:00:00.000Z");
type DarkRunDbInput = NonNullable<
  Parameters<typeof runManualUnderstandingDarkEngineDarkRun>[0]["db"]
>;

function makeDiagnosticsDbMock() {
  let runSeq = 0;
  let artifactSeq = 0;

  const runs: Array<Record<string, unknown>> = [];
  const artifacts: Array<Record<string, unknown>> = [];

  const forbiddenWrites = {
    userMapConclusionCreate: vi.fn(),
    userMapConclusionUpdate: vi.fn(),
    investigationCreate: vi.fn(),
    investigationUpdate: vi.fn(),
    modelUpdateCreate: vi.fn(),
    modelUpdateUpdate: vi.fn(),
    fieldworkAssignmentCreate: vi.fn(),
    fieldworkAssignmentUpdate: vi.fn(),
    understandingEvidenceLinkCreate: vi.fn(),
    understandingEvidenceLinkUpdate: vi.fn(),
  };

  const patternClaims = [
    {
      id: "pc-1",
      summary: "I panic when hard conflict starts.",
      status: "active",
      sourceRunId: "run-prev-1",
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
      updatedAt: new Date("2026-05-14T00:00:00.000Z"),
    },
  ];

  const patternClaimEvidence = [
    {
      id: "pce-1",
      claimId: "pc-1",
      source: "derivation",
      sessionId: "s-1",
      messageId: "m-1",
      journalEntryId: null,
      quote: "When conflict appears, I panic and shut down.",
      createdAt: new Date("2026-05-09T00:00:00.000Z"),
    },
  ];

  const sessions = [
    {
      id: "s-1",
      origin: "APP",
      startedAt: new Date("2026-05-01T00:00:00.000Z"),
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
      label: "Session one",
    },
  ];

  const messageRows = [
    {
      id: "m-1",
      sessionId: "s-1",
      role: "user",
      content: "I panic and avoid conflict when tension rises.",
      createdAt: new Date("2026-05-12T00:00:00.000Z"),
      session: {
        origin: "APP",
      },
    },
  ];

  const messageOrigins = [
    {
      id: "m-1",
      sessionId: "s-1",
      session: {
        origin: "APP",
      },
    },
  ];

  const db = {
    patternClaim: {
      findMany: vi.fn(async () => patternClaims),
    },
    patternClaimEvidence: {
      findMany: vi.fn(async () => patternClaimEvidence),
    },
    contradictionNode: {
      findMany: vi.fn(async () => []),
    },
    contradictionEvidence: {
      findMany: vi.fn(async () => []),
    },
    profileArtifact: {
      findMany: vi.fn(async () => []),
    },
    evidenceSpan: {
      findMany: vi.fn(async () => []),
    },
    referenceItem: {
      findMany: vi.fn(async () => []),
    },
    surfacedAction: {
      findMany: vi.fn(async () => []),
    },
    quickCheckIn: {
      findMany: vi.fn(async () => []),
    },
    journalEntry: {
      findMany: vi.fn(async () => []),
    },
    session: {
      findMany: vi.fn(async () => sessions),
    },
    message: {
      findMany: vi.fn(async (args: { select: Record<string, unknown> }) => {
        if ("role" in args.select) {
          return messageRows;
        }
        return messageOrigins;
      }),
    },
    importUploadSession: {
      findMany: vi.fn(async () => []),
    },
    importUploadChunk: {
      findMany: vi.fn(async () => []),
    },
    modelUpdate: {
      findMany: vi.fn(async () => [
        {
          id: "mu-c-1",
          userFacingSummary: "User corrected prior framing",
          createdAt: new Date("2026-05-10T00:00:00.000Z"),
        },
      ]),
      create: forbiddenWrites.modelUpdateCreate,
      update: forbiddenWrites.modelUpdateUpdate,
    },
    userMapConclusion: {
      findMany: vi.fn(async () => [
        {
          id: "umc-c-1",
          lastUserCorrectionAt: new Date("2026-05-11T00:00:00.000Z"),
          lastUserCorrectionLabel: "Partly right",
        },
      ]),
      create: forbiddenWrites.userMapConclusionCreate,
      update: forbiddenWrites.userMapConclusionUpdate,
    },
    investigation: {
      create: forbiddenWrites.investigationCreate,
      update: forbiddenWrites.investigationUpdate,
    },
    fieldworkAssignment: {
      create: forbiddenWrites.fieldworkAssignmentCreate,
      update: forbiddenWrites.fieldworkAssignmentUpdate,
    },
    understandingEvidenceLink: {
      create: forbiddenWrites.understandingEvidenceLinkCreate,
      update: forbiddenWrites.understandingEvidenceLinkUpdate,
    },
    derivationRun: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        runSeq += 1;
        const row = {
          id: `run-${runSeq}`,
          userId: data.userId,
          scope: data.scope,
          processorVersion: data.processorVersion,
          inputMessageSetHash: data.inputMessageSetHash,
          status: data.status ?? "created",
          messageCount: data.messageCount ?? null,
          sessionCount: data.sessionCount ?? null,
          windowStart: data.windowStart ?? null,
          windowEnd: data.windowEnd ?? null,
          createdAt: new Date(),
        };
        runs.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) => {
        return runs.find((run) => run.id === where.id) ?? null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const index = runs.findIndex((run) => run.id === where.id);
        if (index < 0) {
          throw new Error("run not found");
        }
        runs[index] = {
          ...runs[index],
          ...data,
        };
        return runs[index];
      }),
    },
    derivationArtifact: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        artifactSeq += 1;
        const row = {
          id: `artifact-${artifactSeq}`,
          userId: data.userId,
          runId: data.runId,
          type: data.type,
          status: data.status ?? "candidate",
          payload: data.payload,
          confidenceScore: data.confidenceScore ?? null,
          temporalStart: data.temporalStart ?? null,
          temporalEnd: data.temporalEnd ?? null,
          createdAt: new Date(),
        };
        artifacts.push(row);
        return { id: row.id };
      }),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    __runs: runs,
    __artifacts: artifacts,
    __forbiddenWrites: forbiddenWrites,
  };

  return db;
}

describe("Phase 2 dark-run diagnostics persistence (manual/internal)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists a manual diagnostics artifact payload with the required dry-run shape", async () => {
    const db = makeDiagnosticsDbMock();

    const result = await runManualUnderstandingDarkEngineDarkRun({
      userId: "user-1",
      db: db as unknown as DarkRunDbInput,
      now: FIXED_TIME,
      processorVersion: "understanding-dark-engine-test-v1",
      target: {
        requestedStatus: UserMapConclusionStatus.supported,
        identityLevelClaim: false,
        proposedSummary: "Pattern appears stable.",
        requiresReceipt: true,
      },
    });

    expect(result.artifactType).toBe(UNDERSTANDING_DARK_ENGINE_DIAGNOSTICS_ARTIFACT_TYPE);
    expect(result.runCreatedAt).toBe(FIXED_TIME.toISOString());
    expect(result.persistedAt).toBe(FIXED_TIME.toISOString());
    expect(result.payload.runId).toBe(result.runId);
    expect(result.payload.userId).toBe("user-1");
    expect(result.payload.processorVersion).toBe("understanding-dark-engine-test-v1");
    expect(result.payload.candidatesProposed).toBe(1);
    expect(result.payload.candidatesWritten).toBe(0);
    expect(result.payload.dryRunOnly).toBe(true);
    expect(result.payload.candidateWritesEnabled).toBe(false);
    expect(result.payload.evidenceLinkWritesEnabled).toBe(false);

    expect(result.payload.rejectionCountsByReason.SINGLE_EPISODE_SUPPORTED_BLOCK).toBe(1);
    expect(result.payload.sourceCounts.pattern_claim).toBe(1);
    expect(result.payload.sourceCounts.pattern_claim_evidence).toBe(1);
    expect(result.payload.highEmotionCaps).toBe(1);
    expect(result.payload.singleEpisodeBlocks).toBe(1);
    expect(result.payload.nonLinkableContextItems).toBeGreaterThan(0);
    expect(result.payload.linkIntegrityWarnings.length).toBeGreaterThan(0);
    expect(result.payload.warnings).toContain("HIGH_EMOTION_DOMINANCE_CAP");
    expect(result.payload.warnings).toContain("CORRECTION_DOWNGRADE_ACTIVE");

    expect(db.__runs).toHaveLength(1);
    expect(db.__runs[0]?.status).toBe("completed");
    expect(db.__artifacts).toHaveLength(1);
    expect(db.__artifacts[0]?.type).toBe(UNDERSTANDING_DARK_ENGINE_DIAGNOSTICS_ARTIFACT_TYPE);
    expect(db.__artifacts[0]?.runId).toBe(result.runId);
  });

  it("does not write any Understanding Engine candidate objects or evidence links", async () => {
    const db = makeDiagnosticsDbMock();

    await runManualUnderstandingDarkEngineDarkRun({
      userId: "user-1",
      db: db as unknown as DarkRunDbInput,
      now: FIXED_TIME,
      target: {
        requestedStatus: UserMapConclusionStatus.supported,
        identityLevelClaim: false,
        proposedSummary: "Pattern appears stable.",
        requiresReceipt: true,
      },
    });

    expect(db.__forbiddenWrites.userMapConclusionCreate).not.toHaveBeenCalled();
    expect(db.__forbiddenWrites.userMapConclusionUpdate).not.toHaveBeenCalled();
    expect(db.__forbiddenWrites.investigationCreate).not.toHaveBeenCalled();
    expect(db.__forbiddenWrites.investigationUpdate).not.toHaveBeenCalled();
    expect(db.__forbiddenWrites.modelUpdateCreate).not.toHaveBeenCalled();
    expect(db.__forbiddenWrites.modelUpdateUpdate).not.toHaveBeenCalled();
    expect(db.__forbiddenWrites.fieldworkAssignmentCreate).not.toHaveBeenCalled();
    expect(db.__forbiddenWrites.fieldworkAssignmentUpdate).not.toHaveBeenCalled();
    expect(db.__forbiddenWrites.understandingEvidenceLinkCreate).not.toHaveBeenCalled();
    expect(db.__forbiddenWrites.understandingEvidenceLinkUpdate).not.toHaveBeenCalled();
  });
});
