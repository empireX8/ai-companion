import {
  FieldworkAssignmentVisibility,
  Prisma,
  UnderstandingLinkTargetType,
  type UnderstandingLinkSourceType,
} from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildPublicWatchForWhere,
  isPublicWatchForCandidateLifecycle,
} from "../fieldwork-public-visibility";
import {
  UnderstandingEvidenceLinkDuplicateError,
  UnderstandingEvidenceLinkValidationError,
} from "../understanding-evidence-link-writer";
import {
  persistInternalFieldworkCandidate,
  type PersistInternalFieldworkCandidateInput,
} from "../understanding-dark-engine/fieldwork-candidate-persistence";
import type { StructuredFieldworkCandidateProposal } from "../understanding-dark-engine/fieldwork-candidate-proposal";
import { USERMAP_CANDIDATE_PERSISTED_EVIDENCE_LINK_CAP } from "../understanding-dark-engine/user-map-candidate-persistence";

const FIXED_NOW = new Date("2026-05-16T10:00:00.000Z");

type FieldworkDb = NonNullable<PersistInternalFieldworkCandidateInput["db"]>;

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

type InMemoryFieldwork = {
  id: string;
  userId: string;
  prompt: string;
  reason: string;
  status: string;
  visibility: string;
  candidateLifecycleStatus: string | null;
  linkedObjectType: string;
  linkedObjectId: string;
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
  overrides?: Partial<StructuredFieldworkCandidateProposal>
): StructuredFieldworkCandidateProposal {
  return {
    prompt: "Notice whether energy drops after meetings.",
    reason:
      "This may be worth watching in practice. Energy drops after meetings.",
    linkedObjectType: UnderstandingLinkTargetType.pattern_claim,
    linkedObjectId: "claim-1",
    abstainReasons: ["PROFILE_ARTIFACT_CAP"],
    evidenceSelections: [
      { sourceType: "pattern_claim", sourceId: "claim-1" },
      { sourceType: "message", sourceId: "msg-1" },
    ],
    ...overrides,
  };
}

function expectTransactionFailureDiagnostics(
  payload: Awaited<ReturnType<typeof persistInternalFieldworkCandidate>>["payload"],
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

function matchesPublicWatchForWhere(
  row: InMemoryFieldwork,
  where: ReturnType<typeof buildPublicWatchForWhere>
): boolean {
  if (row.userId !== where.userId) {
    return false;
  }
  if ("id" in where && where.id && row.id !== where.id) {
    return false;
  }
  if (row.visibility !== where.visibility) {
    return false;
  }
  const statusFilter = where.status;
  if (
    statusFilter &&
    typeof statusFilter === "object" &&
    "in" in statusFilter &&
    Array.isArray(statusFilter.in)
  ) {
    if (!statusFilter.in.includes(row.status as (typeof statusFilter.in)[number])) {
      return false;
    }
  }
  const lifecycleAllowed = (where.OR ?? []).some(
    (clause) =>
      "candidateLifecycleStatus" in clause &&
      clause.candidateLifecycleStatus === row.candidateLifecycleStatus
  );
  return lifecycleAllowed;
}

function createFieldworkDbMock(args?: {
  seedFieldwork?: InMemoryFieldwork[];
  failFieldworkCreate?: boolean;
  failLinkWriteAtCall?: number;
  failLinkWriteError?: Error;
  linkedObjectOwned?: boolean;
}) {
  const runs: Array<Record<string, unknown>> = [];
  const artifacts: Array<Record<string, unknown>> = [];
  const fieldwork: InMemoryFieldwork[] = [...(args?.seedFieldwork ?? [])];
  const links: InMemoryLink[] = [];

  let runSeq = 0;
  let artifactSeq = 0;
  let linkSeq = 0;
  let linkWriteCalls = 0;

  const linkedObjectOwned = args?.linkedObjectOwned ?? true;

  const forbiddenWrites = {
    userMapConclusionCreate: vi.fn(),
    modelUpdateCreate: vi.fn(),
    investigationCreate: vi.fn(),
  };

  const db: FieldworkDb = {
    fieldworkAssignment: {
      findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
        return fieldwork.filter((row) => {
          if (where?.userId && row.userId !== where.userId) return false;
          if (where?.visibility && row.visibility !== where.visibility) return false;
          if (
            where?.candidateLifecycleStatus &&
            row.candidateLifecycleStatus !== where.candidateLifecycleStatus
          ) {
            return false;
          }
          return true;
        });
      }),
      findFirst: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
        if (!where) {
          return fieldwork[0] ?? null;
        }

        return (
          fieldwork.find((row) => {
            if (where.id && row.id !== where.id) return false;
            if (where.userId && row.userId !== where.userId) return false;
            return true;
          }) ?? null
        );
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (args?.failFieldworkCreate) {
          throw new Prisma.PrismaClientKnownRequestError(
            "Foreign key constraint failed on FieldworkAssignment.create",
            {
              code: "P2003",
              clientVersion: "test",
            }
          );
        }

        const created: InMemoryFieldwork = {
          id: `fw-${fieldwork.length + 1}`,
          userId: data.userId as string,
          prompt: data.prompt as string,
          reason: data.reason as string,
          status: data.status as string,
          visibility: data.visibility as string,
          candidateLifecycleStatus:
            (data.candidateLifecycleStatus as string | null | undefined) ?? null,
          linkedObjectType: data.linkedObjectType as string,
          linkedObjectId: data.linkedObjectId as string,
        };
        fieldwork.push(created);
        return { id: created.id };
      }),
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
        if (!linkedObjectOwned) {
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
    modelUpdate: {
      findMany: vi.fn(),
      findFirst: vi.fn(async () => null),
      create: forbiddenWrites.modelUpdateCreate,
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

      const fieldworkSnapshot = fieldwork.map((row) => ({ ...row }));
      const linkSnapshot = links.map((row) => ({ ...row }));

      try {
        return await (arg as (tx: FieldworkDb) => Promise<unknown>)(db);
      } catch (error) {
        fieldwork.splice(0, fieldwork.length, ...fieldworkSnapshot);
        links.splice(0, links.length, ...linkSnapshot);
        throw error;
      }
    }),
  } as unknown as FieldworkDb;

  return {
    db,
    runs,
    artifacts,
    fieldwork,
    links,
    forbiddenWrites,
  };
}

describe("fieldwork candidate persistence (manual/internal)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists an internal_only candidate + required evidence links", async () => {
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

    const mock = createFieldworkDbMock();

    const result = await persistInternalFieldworkCandidate({
      userId: "user-1",
      proposal: buildProposal(),
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    expect(result.payload.candidatesWritten).toBe(1);
    expect(result.payload.evidenceLinksAttempted).toBe(2);
    expect(result.payload.evidenceLinksWritten).toBe(2);
    expect(result.payload.evidenceLinksSelectedBeforeCap).toBe(2);
    expect(result.payload.evidenceLinksSelectedAfterCap).toBe(2);
    expect(result.payload.evidenceLinkCapApplied).toBe(false);
    expect(result.payload.evidenceLinkCapLimit).toBe(
      USERMAP_CANDIDATE_PERSISTED_EVIDENCE_LINK_CAP
    );
    expect(result.payload.blockedWriteReasons).toHaveLength(0);
    expect(result.payload.persistedFieldworkAssignmentId).toBeTruthy();
    expect(result.persistedFieldworkAssignmentId).toBe(
      result.payload.persistedFieldworkAssignmentId
    );

    expect(mock.fieldwork).toHaveLength(1);
    expect(mock.fieldwork[0]).toMatchObject({
      userId: "user-1",
      visibility: "internal_only",
      status: "assigned",
      candidateLifecycleStatus: "proposed",
      linkedObjectType: "pattern_claim",
      linkedObjectId: "claim-1",
    });

    expect(mock.links).toHaveLength(2);
    expect(mock.links.every((link) => link.targetType === "fieldwork_assignment")).toBe(
      true
    );
    expect(mock.links.every((link) => link.snippet == null && link.quote == null)).toBe(
      true
    );
    expect(mock.runs).toHaveLength(1);
    expect(mock.runs[0]?.status).toBe("completed");
    expect(mock.artifacts).toHaveLength(1);

    expect(mock.forbiddenWrites.userMapConclusionCreate).not.toHaveBeenCalled();
    expect(mock.forbiddenWrites.modelUpdateCreate).not.toHaveBeenCalled();
    expect(mock.forbiddenWrites.investigationCreate).not.toHaveBeenCalled();
  });

  it("excludes persisted internal candidates from Watch For public guard", async () => {
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
        sourceType: "message",
        sourceId: "msg-1",
        role: "receipt",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
    ]);

    const mock = createFieldworkDbMock();

    const result = await persistInternalFieldworkCandidate({
      userId: "user-1",
      proposal: buildProposal(),
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    const persisted = mock.fieldwork[0]!;
    const publicWhere = buildPublicWatchForWhere({ userId: "user-1" });

    expect(persisted.visibility).toBe(FieldworkAssignmentVisibility.internal_only);
    expect(isPublicWatchForCandidateLifecycle("proposed")).toBe(false);
    expect(matchesPublicWatchForWhere(persisted, publicWhere)).toBe(false);
    expect(result.payload.candidatesWritten).toBe(1);
  });

  it("blocks write when linked object ownership cannot be verified", async () => {
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
        sourceType: "message",
        sourceId: "msg-1",
        role: "receipt",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
    ]);

    const mock = createFieldworkDbMock({ linkedObjectOwned: false });

    const result = await persistInternalFieldworkCandidate({
      userId: "user-1",
      proposal: buildProposal(),
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    expect(result.payload.candidatesWritten).toBe(0);
    expect(result.payload.blockedWriteReasons).toContain(
      "UNRESOLVED_LINKED_OBJECT_OWNERSHIP"
    );
    expect(result.payload.rollbackCount).toBe(0);
    expect(mock.fieldwork).toHaveLength(0);
    expect(mock.links).toHaveLength(0);
  });

  it("blocks write when selected evidence has unresolved ownership", async () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "claim-1",
        role: "signal",
        linkable: true,
        ownershipResolvable: false,
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

    const mock = createFieldworkDbMock();

    const result = await persistInternalFieldworkCandidate({
      userId: "user-1",
      proposal: buildProposal({
        evidenceSelections: [
          { sourceType: "pattern_claim", sourceId: "claim-1" },
          { sourceType: "message", sourceId: "msg-1" },
        ],
      }),
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    expect(result.payload.candidatesWritten).toBe(0);
    expect(result.payload.blockedWriteReasons).toContain("UNRESOLVED_OWNERSHIP");
    expect(mock.fieldwork).toHaveLength(0);
    expect(mock.links).toHaveLength(0);
  });

  it("records proposal abstain reasons in diagnostics payload", async () => {
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
        sourceType: "message",
        sourceId: "msg-1",
        role: "receipt",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
    ]);

    const mock = createFieldworkDbMock();
    const result = await persistInternalFieldworkCandidate({
      userId: "user-1",
      proposal: buildProposal({
        abstainReasons: ["PROFILE_ARTIFACT_CAP", "CORRECTION_DOWNGRADE_ACTIVE"],
      }),
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

  it("does not treat matching user_visible fieldwork as internal duplicates", async () => {
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
        sourceType: "message",
        sourceId: "msg-1",
        role: "receipt",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
    ]);

    const proposal = buildProposal();
    const mock = createFieldworkDbMock({
      seedFieldwork: [
        {
          id: "fw-public-1",
          userId: "user-1",
          prompt: proposal.prompt,
          reason: proposal.reason,
          status: "assigned",
          visibility: "user_visible",
          candidateLifecycleStatus: "proposed",
          linkedObjectType: "pattern_claim",
          linkedObjectId: "claim-1",
        },
      ],
    });

    const result = await persistInternalFieldworkCandidate({
      userId: "user-1",
      proposal,
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    expect(result.payload.blockedWriteReasons).not.toContain("DUPLICATE_CANDIDATE");
    expect(result.payload.candidatesWritten).toBe(1);
    expect(mock.fieldwork).toHaveLength(2);
    expect(
      mock.fieldwork.filter((row) => row.visibility === "internal_only")
    ).toHaveLength(1);
  });

  it("suppresses exact duplicate candidates and increments duplicate counter", async () => {
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
        sourceType: "message",
        sourceId: "msg-1",
        role: "receipt",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
    ]);

    const mock = createFieldworkDbMock({
      seedFieldwork: [
        {
          id: "fw-existing-1",
          userId: "user-1",
          prompt: "Notice whether   energy drops after meetings.",
          reason:
            "This may be worth watching in practice. Energy drops after meetings.",
          status: "assigned",
          visibility: "internal_only",
          candidateLifecycleStatus: "proposed",
          linkedObjectType: "pattern_claim",
          linkedObjectId: "claim-1",
        },
      ],
    });

    const result = await persistInternalFieldworkCandidate({
      userId: "user-1",
      proposal: buildProposal(),
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    expect(result.payload.candidatesWritten).toBe(0);
    expect(result.payload.duplicateCandidates).toBe(1);
    expect(result.payload.blockedWriteReasons).toContain("DUPLICATE_CANDIDATE");
    expect(mock.fieldwork).toHaveLength(1);
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
        sourceType: "message",
        sourceId: "msg-1",
        role: "receipt",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
    ]);

    const mock = createFieldworkDbMock();
    const proposal = buildProposal();

    const first = await persistInternalFieldworkCandidate({
      userId: "user-1",
      proposal,
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    expect(first.payload.candidatesWritten).toBe(1);
    expect(mock.fieldwork).toHaveLength(1);

    const second = await persistInternalFieldworkCandidate({
      userId: "user-1",
      proposal,
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    expect(second.payload.candidatesWritten).toBe(0);
    expect(second.payload.duplicateCandidates).toBe(1);
    expect(second.payload.blockedWriteReasons).toContain("DUPLICATE_CANDIDATE");
    expect(second.payload.persistedFieldworkAssignmentId).toBe(
      first.payload.persistedFieldworkAssignmentId
    );
    expect(mock.fieldwork).toHaveLength(1);
    expect(mock.links).toHaveLength(2);
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
        sourceType: "message",
        sourceId: "msg-1",
        role: "receipt",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
    ]);
    const mock = createFieldworkDbMock({
      failLinkWriteAtCall: 2,
      failLinkWriteError: new UnderstandingEvidenceLinkValidationError({
        field: "sourceId",
        message:
          "Source not found for authenticated user or source type is not verifiable in Phase 1B",
      }),
    });

    const result = await persistInternalFieldworkCandidate({
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
    expect(mock.fieldwork).toHaveLength(0);
    expect(mock.links).toHaveLength(0);
  });

  it("classifies fieldwork create failure separately from link write failure", async () => {
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
        sourceType: "message",
        sourceId: "msg-1",
        role: "receipt",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
    ]);
    const mock = createFieldworkDbMock({ failFieldworkCreate: true });

    const result = await persistInternalFieldworkCandidate({
      userId: "user-1",
      proposal: buildProposal(),
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    expect(result.payload.candidatesWritten).toBe(0);
    expect(result.payload.rollbackCount).toBe(1);
    expectTransactionFailureDiagnostics(result.payload, {
      blockedReason: "FIELDWORK_WRITE_FAILED",
      beforeAnyLinkAttempt: true,
      evidenceLinksAttempted: 0,
      errorName: "PrismaClientKnownRequestError",
      prismaCode: "P2003",
    });
    expect(result.payload.blockedWriteReasons).not.toContain("LINK_WRITE_FAILED");
    expect(mock.fieldwork).toHaveLength(0);
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

    const mock = createFieldworkDbMock({
      linkedObjectOwned: true,
    });

    const result = await persistInternalFieldworkCandidate({
      userId: "user-1",
      proposal: buildProposal({
        linkedObjectId: "claim-1",
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
