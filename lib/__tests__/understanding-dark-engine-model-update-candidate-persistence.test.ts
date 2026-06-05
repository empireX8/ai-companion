import {
  ModelUpdateType,
  ModelUpdateVisibility,
  Prisma,
  UnderstandingLinkTargetType,
  type UnderstandingLinkSourceType,
} from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  UnderstandingEvidenceLinkDuplicateError,
  UnderstandingEvidenceLinkValidationError,
} from "../understanding-evidence-link-writer";
import type { StructuredModelUpdateCandidateProposal } from "../understanding-dark-engine/model-update-candidate-proposal";
import {
  persistInternalModelUpdateCandidate,
  type PersistInternalModelUpdateCandidateInput,
} from "../understanding-dark-engine/model-update-candidate-persistence";
import { USERMAP_CANDIDATE_PERSISTED_EVIDENCE_LINK_CAP } from "../understanding-dark-engine/user-map-candidate-persistence";

const FIXED_NOW = new Date("2026-05-16T10:00:00.000Z");

type ModelUpdateDb = NonNullable<PersistInternalModelUpdateCandidateInput["db"]>;

type PacketItemInput = {
  sourceType: UnderstandingLinkSourceType;
  sourceId: string;
  role: "signal" | "receipt" | "context" | "calibration" | "outcome" | "container";
  linkable: boolean;
  ownershipResolvable: boolean;
  origin: "native" | "imported" | "mixed" | "unknown";
  messageId?: string;
  sessionId?: string;
};

type InMemoryModelUpdate = {
  id: string;
  userId: string;
  updateType: string;
  visibility: string;
  affectedObjectType: string;
  affectedObjectId: string;
  userFacingSummary: string;
  isMeaningful: boolean;
  sourceRunId: string | null;
  internalNotes: string | null;
};

type InMemoryLink = {
  id: string;
  userId: string;
  targetType: string;
  targetId: string;
  sourceType: string;
  sourceId: string;
  role: string;
  snippet?: string | null;
  quote?: string | null;
};

function buildPacket(items: PacketItemInput[]) {
  const sourceCounts: Record<string, number> = {};
  for (const item of items) {
    sourceCounts[item.sourceType] = (sourceCounts[item.sourceType] ?? 0) + 1;
  }

  const linkableEvidenceCount = items.filter((item) => item.linkable).length;
  const ownershipResolvableCount = items.filter(
    (item) => item.ownershipResolvable
  ).length;
  const importedCount = items.filter((item) => item.origin === "imported").length;
  const nativeCount = items.filter((item) => item.origin === "native").length;
  const mixedCount = items.filter((item) => item.origin === "mixed").length;
  const unknownOriginCount = items.filter((item) => item.origin === "unknown").length;

  return {
    userId: "user-1",
    assembledAt: FIXED_NOW,
    windowStart: new Date("2026-05-01T00:00:00.000Z"),
    windowEnd: FIXED_NOW,
    items: items.map((item, index) => ({
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      role: item.role,
      weightClass: "moderate" as const,
      sourceFamily: item.sourceType,
      timestamp: new Date(FIXED_NOW.getTime() - index * 1000),
      authoredAt: null,
      snippet: `snippet-${item.sourceId}`,
      quote: `quote-${item.sourceId}`,
      publicSafetyLevel: "internal_only" as const,
      publicSafeSummary: null,
      containsRawPrivateText: true,
      provenanceRefs: {
        messageId: item.messageId,
        sessionId: item.sessionId,
      },
      qualityFlags: [],
      linkable: item.linkable,
      ownershipResolvable: item.ownershipResolvable,
      highEmotionSignal: false,
      origin: item.origin,
      episodeKey: null,
    })),
    metrics: {
      evidenceCount: items.length,
      linkableEvidenceCount,
      ownershipResolvableCount,
      sourceCounts,
      sourceDiversity: new Set(items.map((item) => item.sourceType)).size,
      timeSpreadDays: 7,
      importedCount,
      nativeCount,
      mixedCount,
      unknownOriginCount,
      highEmotionItemCount: 0,
      nonLinkableContextItems: items.filter((item) => !item.linkable).length,
      quoteQualityLowCount: 0,
      receiptCount: items.filter((item) => item.role === "receipt").length,
      unresolvedContradictionCount: 0,
      correctionSignalCount: 0,
      distinctEpisodeCount: 1,
    },
  };
}

function buildProposal(
  overrides?: Partial<StructuredModelUpdateCandidateProposal>
): StructuredModelUpdateCandidateProposal {
  return {
    updateType: ModelUpdateType.link_detected,
    userFacingSummary:
      "There is early evidence that energy drops after meetings.",
    affectedObjectType: UnderstandingLinkTargetType.pattern_claim,
    affectedObjectId: "claim-1",
    evidenceSelections: [
      { sourceType: "pattern_claim", sourceId: "claim-1" },
      { sourceType: "pattern_claim", sourceId: "claim-2" },
      { sourceType: "message", sourceId: "msg-1" },
    ],
    ...overrides,
  };
}

function expectTransactionFailureDiagnostics(
  payload: Awaited<ReturnType<typeof persistInternalModelUpdateCandidate>>["payload"],
  expected: {
    blockedReason: string;
    beforeAnyLinkAttempt: boolean;
    evidenceLinksAttempted: number;
    errorName?: string;
    prismaCode?: string | null;
  }
) {
  expect(payload.blockedWriteReasons).toContain(expected.blockedReason);
  expect(payload.transactionFailureErrorName).toBe(
    expected.errorName ?? "Error"
  );
  expect(payload.transactionFailureErrorMessage).toEqual(expect.any(String));
  expect(payload.transactionFailurePrismaCode).toBe(expected.prismaCode ?? null);
  expect(payload.transactionFailureBeforeAnyLinkAttempt).toBe(
    expected.beforeAnyLinkAttempt
  );
  expect(payload.transactionFailureEvidenceLinksAttempted).toBe(
    expected.evidenceLinksAttempted
  );
  expect(payload.candidatesWritten).toBe(0);
  expect(payload.evidenceLinksWritten).toBe(0);
}

function buildWhatChangedPublicWhere(userId: string) {
  return {
    userId,
    visibility: ModelUpdateVisibility.user_visible,
    isMeaningful: true,
  };
}

function buildTodayPublicWhere(userId: string) {
  return {
    userId,
    visibility: ModelUpdateVisibility.user_visible,
    isMeaningful: true,
  };
}

function buildTimelinePublicWhere(userId: string) {
  return {
    userId,
    visibility: ModelUpdateVisibility.user_visible,
    isMeaningful: true,
  };
}

/** GET /api/model-updates default filter excludes internal_only rows. */
function buildModelUpdatesApiDefaultWhere(userId: string) {
  return {
    userId,
    visibility: { not: ModelUpdateVisibility.internal_only },
  };
}

function matchesModelUpdateWhere(
  row: InMemoryModelUpdate,
  where: Record<string, unknown>
): boolean {
  if (where.userId && row.userId !== where.userId) {
    return false;
  }

  const visibilityFilter = where.visibility;
  if (visibilityFilter) {
    if (
      typeof visibilityFilter === "object" &&
      visibilityFilter !== null &&
      "not" in visibilityFilter
    ) {
      if (row.visibility === (visibilityFilter as { not: string }).not) {
        return false;
      }
    } else if (row.visibility !== visibilityFilter) {
      return false;
    }
  }

  if (where.isMeaningful === true && row.isMeaningful !== true) {
    return false;
  }

  return true;
}

function createModelUpdateDbMock(args?: {
  seedModelUpdates?: InMemoryModelUpdate[];
  failModelUpdateCreate?: boolean;
  failLinkWriteAtCall?: number;
  failLinkWriteError?: Error;
  affectedObjectOwned?: boolean;
}) {
  const runs: Array<Record<string, unknown>> = [];
  const artifacts: Array<Record<string, unknown>> = [];
  const modelUpdates: InMemoryModelUpdate[] = [...(args?.seedModelUpdates ?? [])];
  const links: InMemoryLink[] = [];

  let runSeq = 0;
  let artifactSeq = 0;
  let linkSeq = 0;
  let linkWriteCalls = 0;

  const affectedObjectOwned = args?.affectedObjectOwned ?? true;

  const forbiddenWrites = {
    userMapConclusionCreate: vi.fn(),
    fieldworkAssignmentCreate: vi.fn(),
    investigationCreate: vi.fn(),
  };

  const db: ModelUpdateDb = {
    modelUpdate: {
      findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
        return modelUpdates.filter((row) => {
          if (where?.userId && row.userId !== where.userId) return false;
          if (where?.visibility && row.visibility !== where.visibility) return false;
          return true;
        });
      }),
      findFirst: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
        if (!where) {
          return modelUpdates[0] ?? null;
        }

        return (
          modelUpdates.find((row) => {
            if (where.id && row.id !== where.id) return false;
            if (where.userId && row.userId !== where.userId) return false;
            return true;
          }) ?? null
        );
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (args?.failModelUpdateCreate) {
          throw new Prisma.PrismaClientKnownRequestError(
            "Foreign key constraint failed on ModelUpdate.create",
            {
              code: "P2003",
              clientVersion: "test",
            }
          );
        }

        const created: InMemoryModelUpdate = {
          id: `mu-${modelUpdates.length + 1}`,
          userId: data.userId as string,
          updateType: data.updateType as string,
          visibility: data.visibility as string,
          affectedObjectType: data.affectedObjectType as string,
          affectedObjectId: data.affectedObjectId as string,
          userFacingSummary: data.userFacingSummary as string,
          isMeaningful: data.isMeaningful as boolean,
          sourceRunId: (data.sourceRunId as string | null | undefined) ?? null,
          internalNotes: (data.internalNotes as string | null | undefined) ?? null,
        };
        modelUpdates.push(created);
        return { id: created.id };
      }),
      update: vi.fn(),
    },
    fieldworkAssignment: {
      findMany: vi.fn(),
      findFirst: vi.fn(async () => null),
      create: forbiddenWrites.fieldworkAssignmentCreate,
      update: vi.fn(),
    },
    userMapConclusion: {
      findMany: vi.fn(),
      findFirst: vi.fn(async () => null),
      create: forbiddenWrites.userMapConclusionCreate,
      update: vi.fn(),
    },
    investigation: {
      findMany: vi.fn(),
      findFirst: vi.fn(async () => null),
      create: forbiddenWrites.investigationCreate,
      update: vi.fn(),
    },
    understandingEvidenceLink: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        linkWriteCalls += 1;

        if (args?.failLinkWriteAtCall && linkWriteCalls === args.failLinkWriteAtCall) {
          throw args.failLinkWriteError ?? new Error("forced link write failure");
        }

        linkSeq += 1;
        const created: InMemoryLink = {
          id: `link-${linkSeq}`,
          userId: data.userId as string,
          targetType: data.targetType as string,
          targetId: data.targetId as string,
          sourceType: data.sourceType as string,
          sourceId: data.sourceId as string,
          role: data.role as string,
          snippet: (data.snippet as string | null | undefined) ?? null,
          quote: (data.quote as string | null | undefined) ?? null,
        };

        links.push(created);
        return created;
      }),
    },
    patternClaim: {
      findMany: vi.fn(),
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
        if (!affectedObjectOwned) {
          return null;
        }
        if (where.userId === "user-1" && where.id.startsWith("claim")) {
          return { id: where.id };
        }
        return null;
      }),
    },
    message: {
      findMany: vi.fn(),
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
        if (where.userId === "user-1" && where.id.startsWith("msg")) {
          return { id: where.id };
        }
        return null;
      }),
    },
    contradictionNode: {
      findMany: vi.fn(),
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
        if (where.userId === "user-1" && where.id.startsWith("node-")) {
          return { id: where.id };
        }
        return null;
      }),
    },
    contradictionEvidence: { findMany: vi.fn(), findFirst: vi.fn(async () => null) },
    patternClaimEvidence: { findMany: vi.fn(), findFirst: vi.fn(async () => null) },
    profileArtifact: { findMany: vi.fn(), findFirst: vi.fn(async () => null) },
    evidenceSpan: { findMany: vi.fn(), findFirst: vi.fn(async () => null) },
    referenceItem: { findMany: vi.fn(), findFirst: vi.fn(async () => null) },
    surfacedAction: { findMany: vi.fn(), findFirst: vi.fn(async () => null) },
    quickCheckIn: { findMany: vi.fn(), findFirst: vi.fn(async () => null) },
    journalEntry: { findMany: vi.fn(), findFirst: vi.fn(async () => null) },
    session: { findMany: vi.fn(), findFirst: vi.fn(async () => null) },
    importUploadSession: { findMany: vi.fn(), findFirst: vi.fn(async () => null) },
    importUploadChunk: { findMany: vi.fn(), findFirst: vi.fn(async () => null) },
    profileArtifactEvidenceLink: { findMany: vi.fn() },
    derivationRun: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        runSeq += 1;
        const row = {
          id: `run-${runSeq}`,
          userId: data.userId,
          scope: data.scope,
          processorVersion: data.processorVersion,
          inputMessageSetHash: data.inputMessageSetHash,
          status: "created",
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
      findMany: vi.fn(async () => []),
    },
    derivationArtifact: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        artifactSeq += 1;
        const row = {
          id: `artifact-${artifactSeq}`,
          ...data,
          createdAt: new Date(),
        };
        artifacts.push(row);
        return { id: row.id };
      }),
    },
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg !== "function") {
        return Promise.all(arg as Promise<unknown>[]);
      }

      const modelUpdateSnapshot = modelUpdates.map((row) => ({ ...row }));
      const linkSnapshot = links.map((row) => ({ ...row }));

      try {
        return await (arg as (tx: ModelUpdateDb) => Promise<unknown>)(db);
      } catch (error) {
        modelUpdates.splice(0, modelUpdates.length, ...modelUpdateSnapshot);
        links.splice(0, links.length, ...linkSnapshot);
        throw error;
      }
    }),
  } as unknown as ModelUpdateDb;

  return {
    db,
    runs,
    artifacts,
    modelUpdates,
    links,
    forbiddenWrites,
  };
}

describe("ModelUpdate candidate persistence (manual/internal)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists an internal_only candidate with isMeaningful false and evidence links", async () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "claim-1",
        role: "signal",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
      {
        sourceType: "pattern_claim",
        sourceId: "claim-2",
        role: "signal",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
      {
        sourceType: "message",
        sourceId: "msg-1",
        role: "receipt",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
        messageId: "msg-1",
        sessionId: "session-1",
      },
    ]);

    const mock = createModelUpdateDbMock();

    const result = await persistInternalModelUpdateCandidate({
      userId: "user-1",
      proposal: buildProposal(),
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    expect(result.payload.candidatesWritten).toBe(1);
    expect(result.payload.evidenceLinksAttempted).toBe(3);
    expect(result.payload.evidenceLinksWritten).toBe(3);
    expect(result.payload.evidenceLinksSelectedBeforeCap).toBe(3);
    expect(result.payload.evidenceLinksSelectedAfterCap).toBe(3);
    expect(result.payload.evidenceLinkCapApplied).toBe(false);
    expect(result.payload.evidenceLinkCapLimit).toBe(
      USERMAP_CANDIDATE_PERSISTED_EVIDENCE_LINK_CAP
    );
    expect(result.payload.blockedWriteReasons).toHaveLength(0);
    expect(result.payload.persistedModelUpdateId).toBeTruthy();
    expect(result.persistedModelUpdateId).toBe(result.payload.persistedModelUpdateId);

    expect(mock.modelUpdates).toHaveLength(1);
    expect(mock.modelUpdates[0]).toMatchObject({
      userId: "user-1",
      visibility: "internal_only",
      isMeaningful: false,
      updateType: "link_detected",
      affectedObjectType: "pattern_claim",
      affectedObjectId: "claim-1",
    });
    expect(mock.modelUpdates[0]?.sourceRunId).toBe(result.runId);

    expect(mock.links).toHaveLength(3);
    expect(mock.links.every((link) => link.targetType === "model_update")).toBe(true);
    expect(mock.links.every((link) => link.snippet == null && link.quote == null)).toBe(
      true
    );
    expect(mock.runs).toHaveLength(1);
    expect(mock.runs[0]?.status).toBe("completed");
    expect(mock.artifacts).toHaveLength(1);

    expect(mock.forbiddenWrites.userMapConclusionCreate).not.toHaveBeenCalled();
    expect(mock.forbiddenWrites.fieldworkAssignmentCreate).not.toHaveBeenCalled();
    expect(mock.forbiddenWrites.investigationCreate).not.toHaveBeenCalled();
  });

  it("excludes internal_only rows from public filters while user_visible and candidate rows match API default visibility", () => {
    const apiDefaultWhere = buildModelUpdatesApiDefaultWhere("user-1");
    const internalRow: InMemoryModelUpdate = {
      id: "mu-internal",
      userId: "user-1",
      updateType: "link_detected",
      visibility: ModelUpdateVisibility.internal_only,
      affectedObjectType: "pattern_claim",
      affectedObjectId: "claim-1",
      userFacingSummary: "There is early evidence that energy drops after meetings.",
      isMeaningful: false,
      sourceRunId: "run-1",
      internalNotes: null,
    };
    const userVisibleRow: InMemoryModelUpdate = {
      ...internalRow,
      id: "mu-visible",
      visibility: ModelUpdateVisibility.user_visible,
      isMeaningful: true,
    };
    const candidateRow: InMemoryModelUpdate = {
      ...internalRow,
      id: "mu-candidate",
      visibility: ModelUpdateVisibility.candidate,
      isMeaningful: false,
    };

    expect(matchesModelUpdateWhere(internalRow, apiDefaultWhere)).toBe(false);
    expect(matchesModelUpdateWhere(userVisibleRow, apiDefaultWhere)).toBe(true);
    expect(matchesModelUpdateWhere(candidateRow, apiDefaultWhere)).toBe(true);
    expect(
      matchesModelUpdateWhere(internalRow, buildWhatChangedPublicWhere("user-1"))
    ).toBe(false);
    expect(
      matchesModelUpdateWhere(userVisibleRow, buildWhatChangedPublicWhere("user-1"))
    ).toBe(true);
  });

  it("excludes persisted internal_only rows from public What Changed / Today / Timeline filters", async () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "claim-1",
        role: "signal",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
      {
        sourceType: "pattern_claim",
        sourceId: "claim-2",
        role: "signal",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
      {
        sourceType: "message",
        sourceId: "msg-1",
        role: "receipt",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
    ]);

    const mock = createModelUpdateDbMock();

    await persistInternalModelUpdateCandidate({
      userId: "user-1",
      proposal: buildProposal(),
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    const persisted = mock.modelUpdates[0]!;

    expect(persisted.visibility).toBe(ModelUpdateVisibility.internal_only);
    expect(persisted.isMeaningful).toBe(false);
    expect(
      matchesModelUpdateWhere(persisted, buildWhatChangedPublicWhere("user-1"))
    ).toBe(false);
    expect(matchesModelUpdateWhere(persisted, buildTodayPublicWhere("user-1"))).toBe(
      false
    );
    expect(
      matchesModelUpdateWhere(persisted, buildTimelinePublicWhere("user-1"))
    ).toBe(false);
    expect(
      matchesModelUpdateWhere(persisted, buildModelUpdatesApiDefaultWhere("user-1"))
    ).toBe(false);
  });

  it("blocks write when affected object ownership cannot be verified", async () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "claim-1",
        role: "signal",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
      {
        sourceType: "pattern_claim",
        sourceId: "claim-2",
        role: "signal",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
      {
        sourceType: "message",
        sourceId: "msg-1",
        role: "receipt",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
    ]);

    const mock = createModelUpdateDbMock({ affectedObjectOwned: false });

    const result = await persistInternalModelUpdateCandidate({
      userId: "user-1",
      proposal: buildProposal(),
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    expect(result.payload.candidatesWritten).toBe(0);
    expect(result.payload.blockedWriteReasons).toContain(
      "UNRESOLVED_AFFECTED_OBJECT_OWNERSHIP"
    );
    expect(result.payload.rollbackCount).toBe(0);
    expect(mock.modelUpdates).toHaveLength(0);
    expect(mock.links).toHaveLength(0);
  });

  it("records abstain reasons in diagnostics payload when provided", async () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "claim-1",
        role: "signal",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
      {
        sourceType: "pattern_claim",
        sourceId: "claim-2",
        role: "signal",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
      {
        sourceType: "message",
        sourceId: "msg-1",
        role: "receipt",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
    ]);

    const mock = createModelUpdateDbMock();
    const result = await persistInternalModelUpdateCandidate({
      userId: "user-1",
      proposal: buildProposal(),
      abstainReasons: ["PROFILE_ARTIFACT_CAP", "CORRECTION_DOWNGRADE_ACTIVE"],
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    expect(result.payload.candidatesProposed).toBe(1);
    expect(result.payload.abstentions).toBe(2);
    expect(result.payload.rejectionCountsByReason).toEqual({
      PROFILE_ARTIFACT_CAP: 1,
      CORRECTION_DOWNGRADE_ACTIVE: 1,
    });
    expect(result.diagnostics.abstentions).toBe(2);
  });

  it("does not treat matching user_visible ModelUpdate rows as internal duplicates", async () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "claim-1",
        role: "signal",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
      {
        sourceType: "pattern_claim",
        sourceId: "claim-2",
        role: "signal",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
      {
        sourceType: "message",
        sourceId: "msg-1",
        role: "receipt",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
    ]);

    const proposal = buildProposal();
    const mock = createModelUpdateDbMock({
      seedModelUpdates: [
        {
          id: "mu-public-1",
          userId: "user-1",
          updateType: "link_detected",
          visibility: "user_visible",
          affectedObjectType: "pattern_claim",
          affectedObjectId: "claim-1",
          userFacingSummary: proposal.userFacingSummary,
          isMeaningful: true,
          sourceRunId: null,
          internalNotes: null,
        },
      ],
    });

    const result = await persistInternalModelUpdateCandidate({
      userId: "user-1",
      proposal,
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    expect(result.payload.blockedWriteReasons).not.toContain("DUPLICATE_CANDIDATE");
    expect(result.payload.candidatesWritten).toBe(1);
    expect(mock.modelUpdates).toHaveLength(2);
    expect(
      mock.modelUpdates.filter((row) => row.visibility === "internal_only")
    ).toHaveLength(1);
  });

  it("suppresses exact duplicate internal_only candidates and increments duplicate counter", async () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "claim-1",
        role: "signal",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
      {
        sourceType: "pattern_claim",
        sourceId: "claim-2",
        role: "signal",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
      {
        sourceType: "message",
        sourceId: "msg-1",
        role: "receipt",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
    ]);

    const mock = createModelUpdateDbMock({
      seedModelUpdates: [
        {
          id: "mu-existing-1",
          userId: "user-1",
          updateType: "link_detected",
          visibility: "internal_only",
          affectedObjectType: "pattern_claim",
          affectedObjectId: "claim-1",
          userFacingSummary:
            "There is early evidence that   energy drops after meetings.",
          isMeaningful: false,
          sourceRunId: "run-old",
          internalNotes: null,
        },
      ],
    });

    const result = await persistInternalModelUpdateCandidate({
      userId: "user-1",
      proposal: buildProposal(),
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    expect(result.payload.candidatesWritten).toBe(0);
    expect(result.payload.duplicateCandidates).toBe(1);
    expect(result.payload.blockedWriteReasons).toContain("DUPLICATE_CANDIDATE");
    expect(mock.modelUpdates).toHaveLength(1);
    expect(mock.links).toHaveLength(0);
  });

  it("duplicate rerun does not report candidatesWritten as created", async () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "claim-1",
        role: "signal",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
      {
        sourceType: "pattern_claim",
        sourceId: "claim-2",
        role: "signal",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
      {
        sourceType: "message",
        sourceId: "msg-1",
        role: "receipt",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
    ]);

    const mock = createModelUpdateDbMock();
    const proposal = buildProposal();

    const first = await persistInternalModelUpdateCandidate({
      userId: "user-1",
      proposal,
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    expect(first.payload.candidatesWritten).toBe(1);
    expect(mock.modelUpdates).toHaveLength(1);

    const second = await persistInternalModelUpdateCandidate({
      userId: "user-1",
      proposal,
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    expect(second.payload.candidatesWritten).toBe(0);
    expect(second.payload.duplicateCandidates).toBe(1);
    expect(second.payload.blockedWriteReasons).toContain("DUPLICATE_CANDIDATE");
    expect(second.payload.persistedModelUpdateId).toBe(
      first.payload.persistedModelUpdateId
    );
    expect(mock.modelUpdates).toHaveLength(1);
    expect(mock.links).toHaveLength(3);
  });

  it("maps evidence-link ownership validation failures to UNRESOLVED_OWNERSHIP with rollback", async () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "claim-1",
        role: "signal",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
      {
        sourceType: "pattern_claim",
        sourceId: "claim-2",
        role: "signal",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
      {
        sourceType: "message",
        sourceId: "msg-1",
        role: "receipt",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
    ]);
    const mock = createModelUpdateDbMock({
      failLinkWriteAtCall: 2,
      failLinkWriteError: new UnderstandingEvidenceLinkValidationError({
        field: "sourceId",
        message:
          "Source not found for authenticated user or source type is not verifiable in Phase 1B",
      }),
    });

    const result = await persistInternalModelUpdateCandidate({
      userId: "user-1",
      proposal: buildProposal(),
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    expect(result.payload.rollbackCount).toBe(1);
    expectTransactionFailureDiagnostics(result.payload, {
      blockedReason: "UNRESOLVED_OWNERSHIP",
      beforeAnyLinkAttempt: false,
      evidenceLinksAttempted: 2,
      errorName: "UnderstandingEvidenceLinkValidationError",
    });
    expect(result.payload.blockedWriteReasons).not.toContain("LINK_WRITE_FAILED");
    expect(mock.modelUpdates).toHaveLength(0);
    expect(mock.links).toHaveLength(0);
  });

  it("classifies duplicate evidence-link errors separately from generic link failures", async () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "claim-1",
        role: "signal",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
      {
        sourceType: "pattern_claim",
        sourceId: "claim-2",
        role: "signal",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
      {
        sourceType: "message",
        sourceId: "msg-1",
        role: "receipt",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
    ]);
    const mock = createModelUpdateDbMock({
      failLinkWriteAtCall: 1,
      failLinkWriteError: new UnderstandingEvidenceLinkDuplicateError(),
    });

    const result = await persistInternalModelUpdateCandidate({
      userId: "user-1",
      proposal: buildProposal(),
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    expect(result.payload.rollbackCount).toBe(1);
    expectTransactionFailureDiagnostics(result.payload, {
      blockedReason: "EVIDENCE_LINK_DUPLICATE",
      beforeAnyLinkAttempt: false,
      evidenceLinksAttempted: 1,
      errorName: "UnderstandingEvidenceLinkDuplicateError",
    });
    expect(result.payload.blockedWriteReasons).not.toContain("LINK_WRITE_FAILED");
    expect(mock.modelUpdates).toHaveLength(0);
    expect(mock.links).toHaveLength(0);
  });

  it("classifies ModelUpdate create failure separately from link write failure", async () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "claim-1",
        role: "signal",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
      {
        sourceType: "pattern_claim",
        sourceId: "claim-2",
        role: "signal",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
      {
        sourceType: "message",
        sourceId: "msg-1",
        role: "receipt",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
    ]);
    const mock = createModelUpdateDbMock({ failModelUpdateCreate: true });

    const result = await persistInternalModelUpdateCandidate({
      userId: "user-1",
      proposal: buildProposal(),
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    expect(result.payload.candidatesWritten).toBe(0);
    expect(result.payload.rollbackCount).toBe(1);
    expectTransactionFailureDiagnostics(result.payload, {
      blockedReason: "MODEL_UPDATE_WRITE_FAILED",
      beforeAnyLinkAttempt: true,
      evidenceLinksAttempted: 0,
      errorName: "PrismaClientKnownRequestError",
      prismaCode: "P2003",
    });
    expect(result.payload.blockedWriteReasons).not.toContain("LINK_WRITE_FAILED");
    expect(mock.modelUpdates).toHaveLength(0);
    expect(mock.links).toHaveLength(0);
  });

  it("caps persisted evidence links at USERMAP_CANDIDATE_PERSISTED_EVIDENCE_LINK_CAP", async () => {
    const cap = USERMAP_CANDIDATE_PERSISTED_EVIDENCE_LINK_CAP;
    const selectionCount = cap + 2;
    const packetItems: PacketItemInput[] = Array.from(
      { length: selectionCount },
      (_, index) => ({
        sourceType: "pattern_claim",
        sourceId: `claim-${index + 1}`,
        role: "signal",
        linkable: true,
        ownershipResolvable: true,
        origin: "native" as const,
      })
    );
    packetItems.push({
      sourceType: "message",
      sourceId: "msg-1",
      role: "receipt",
      linkable: true,
      ownershipResolvable: true,
      origin: "native",
      messageId: "msg-1",
    });

    const packet = buildPacket(packetItems);
    const evidenceSelections = [
      ...Array.from({ length: selectionCount }, (_, index) => ({
        sourceType: "pattern_claim" as const,
        sourceId: `claim-${index + 1}`,
      })),
      { sourceType: "message" as const, sourceId: "msg-1" },
    ];

    const mock = createModelUpdateDbMock();

    const result = await persistInternalModelUpdateCandidate({
      userId: "user-1",
      proposal: buildProposal({
        affectedObjectId: "claim-1",
        evidenceSelections,
      }),
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    expect(result.payload.evidenceLinksSelectedBeforeCap).toBeGreaterThan(cap);
    expect(result.payload.evidenceLinksSelectedAfterCap).toBe(cap);
    expect(result.payload.evidenceLinkCapApplied).toBe(true);
    expect(result.payload.evidenceLinksWritten).toBe(cap);
    expect(mock.links).toHaveLength(cap);
  });
});
