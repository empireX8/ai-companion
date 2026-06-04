import {
  InvestigationSeedType,
  InvestigationVisibility,
  Prisma,
  type UnderstandingLinkSourceType,
} from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildPublicActiveInvestigationWhere,
  isPublicActiveInvestigationCandidateLifecycle,
} from "../investigation-public-visibility";
import {
  UnderstandingEvidenceLinkDuplicateError,
  UnderstandingEvidenceLinkValidationError,
} from "../understanding-evidence-link-writer";
import {
  persistInternalInvestigationCandidate,
  type PersistInternalInvestigationCandidateInput,
} from "../understanding-dark-engine/investigation-candidate-persistence";
import { USERMAP_CANDIDATE_PERSISTED_EVIDENCE_LINK_CAP } from "../understanding-dark-engine/user-map-candidate-persistence";
import type { StructuredInvestigationCandidateProposal } from "../understanding-dark-engine/investigation-candidate-proposal";

const FIXED_NOW = new Date("2026-05-16T10:00:00.000Z");

type InvestigationDb = NonNullable<
  PersistInternalInvestigationCandidateInput["db"]
>;

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

type InMemoryInvestigation = {
  id: string;
  userId: string;
  title: string;
  organizingQuestion: string;
  status: string;
  visibility: string;
  candidateLifecycleStatus: string | null;
  seedType: string;
  evidenceNeeded: string[];
};

type InMemoryLink = {
  id: string;
  userId: string;
  targetType: string;
  targetId: string;
  sourceType: string;
  sourceId: string;
  role: string;
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
  overrides?: Partial<StructuredInvestigationCandidateProposal>
): StructuredInvestigationCandidateProposal {
  return {
    seedType: InvestigationSeedType.pattern,
    title: "Worth exploring: Conflict shutdown pattern",
    organizingQuestion: "What would clarify whether conflict shutdown pattern?",
    summary:
      "This looks worth watching as an open question. Candidate pattern across multiple owned sources.",
    abstainReasons: ["INSUFFICIENT_EVIDENCE_COUNT"],
    evidenceSelections: [
      { sourceType: "pattern_claim", sourceId: "claim-1" },
      { sourceType: "message", sourceId: "msg-1" },
    ],
    ...overrides,
  };
}

function expectTransactionFailureDiagnostics(
  payload: Awaited<
    ReturnType<typeof persistInternalInvestigationCandidate>
  >["payload"],
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

function matchesPublicActiveInvestigationWhere(
  row: InMemoryInvestigation,
  where: ReturnType<typeof buildPublicActiveInvestigationWhere>
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

function createInvestigationDbMock(args?: {
  seedInvestigations?: InMemoryInvestigation[];
  failInvestigationCreate?: boolean;
  failLinkWriteAtCall?: number;
  failLinkWriteError?: Error;
}) {
  const runs: Array<Record<string, unknown>> = [];
  const artifacts: Array<Record<string, unknown>> = [];
  const investigations: InMemoryInvestigation[] = [
    ...(args?.seedInvestigations ?? []),
  ];
  const links: InMemoryLink[] = [];

  let runSeq = 0;
  let artifactSeq = 0;
  let linkSeq = 0;
  let linkWriteCalls = 0;

  const forbiddenWrites = {
    userMapConclusionCreate: vi.fn(),
    modelUpdateCreate: vi.fn(),
    fieldworkCreate: vi.fn(),
  };

  const db: InvestigationDb = {
    investigation: {
      findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
        return investigations.filter((row) => {
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
          return investigations[0] ?? null;
        }

        return (
          investigations.find((row) => {
            if (where.id && row.id !== where.id) return false;
            if (where.userId && row.userId !== where.userId) return false;
            return true;
          }) ?? null
        );
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (args?.failInvestigationCreate) {
          throw new Prisma.PrismaClientKnownRequestError(
            "Foreign key constraint failed on Investigation.create",
            {
              code: "P2003",
              clientVersion: "test",
            }
          );
        }

        const created: InMemoryInvestigation = {
          id: `inv-${investigations.length + 1}`,
          userId: data.userId as string,
          title: data.title as string,
          organizingQuestion: data.organizingQuestion as string,
          status: data.status as string,
          visibility: data.visibility as string,
          candidateLifecycleStatus:
            (data.candidateLifecycleStatus as string | null | undefined) ?? null,
          seedType: data.seedType as string,
          evidenceNeeded: data.evidenceNeeded as string[],
        };
        investigations.push(created);
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
        };

        links.push(created);
        return created;
      }),
    },
    patternClaim: {
      findMany: vi.fn(),
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
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
    fieldworkAssignment: {
      create: forbiddenWrites.fieldworkCreate,
      findFirst: vi.fn(async () => null),
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

      const investigationSnapshot = investigations.map((row) => ({ ...row }));
      const linkSnapshot = links.map((row) => ({ ...row }));

      try {
        return await (arg as (tx: InvestigationDb) => Promise<unknown>)(db);
      } catch (error) {
        investigations.splice(0, investigations.length, ...investigationSnapshot);
        links.splice(0, links.length, ...linkSnapshot);
        throw error;
      }
    }),
  } as unknown as InvestigationDb;

  return {
    db,
    runs,
    artifacts,
    investigations,
    links,
    forbiddenWrites,
  };
}

describe("investigation candidate persistence (manual/internal)", () => {
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

    const mock = createInvestigationDbMock();

    const result = await persistInternalInvestigationCandidate({
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
    expect(result.payload.persistedInvestigationId).toBeTruthy();
    expect(result.persistedInvestigationId).toBe(result.payload.persistedInvestigationId);

    expect(mock.investigations).toHaveLength(1);
    expect(mock.investigations[0]).toMatchObject({
      userId: "user-1",
      visibility: "internal_only",
      status: "open",
      candidateLifecycleStatus: "proposed",
      seedType: "pattern",
    });
    expect(mock.investigations[0]?.evidenceNeeded).toEqual([
      "This looks worth watching as an open question. Candidate pattern across multiple owned sources.",
    ]);

    expect(mock.links).toHaveLength(2);
    expect(mock.links.every((link) => link.targetType === "investigation")).toBe(true);
    expect(mock.runs).toHaveLength(1);
    expect(mock.runs[0]?.status).toBe("completed");
    expect(mock.artifacts).toHaveLength(1);

    expect(mock.forbiddenWrites.userMapConclusionCreate).not.toHaveBeenCalled();
    expect(mock.forbiddenWrites.modelUpdateCreate).not.toHaveBeenCalled();
    expect(mock.forbiddenWrites.fieldworkCreate).not.toHaveBeenCalled();
  });

  it("excludes persisted internal candidates from Active Questions public guard", async () => {
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

    const mock = createInvestigationDbMock();

    const result = await persistInternalInvestigationCandidate({
      userId: "user-1",
      proposal: buildProposal(),
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    const persisted = mock.investigations[0]!;
    const publicWhere = buildPublicActiveInvestigationWhere({ userId: "user-1" });

    expect(persisted.visibility).toBe(InvestigationVisibility.internal_only);
    expect(isPublicActiveInvestigationCandidateLifecycle("proposed")).toBe(false);
    expect(matchesPublicActiveInvestigationWhere(persisted, publicWhere)).toBe(false);
    expect(result.payload.candidatesWritten).toBe(1);
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

    const mock = createInvestigationDbMock();

    const result = await persistInternalInvestigationCandidate({
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
    expect(result.payload.rollbackCount).toBe(0);
    expect(mock.investigations).toHaveLength(0);
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

    const mock = createInvestigationDbMock();
    const result = await persistInternalInvestigationCandidate({
      userId: "user-1",
      proposal: buildProposal({
        abstainReasons: [
          "INSUFFICIENT_EVIDENCE_COUNT",
          "INSUFFICIENT_SOURCE_DIVERSITY",
        ],
      }),
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    expect(result.payload.candidatesProposed).toBe(1);
    expect(result.payload.abstentions).toBe(2);
    expect(result.payload.rejectionCountsByReason).toEqual({
      INSUFFICIENT_EVIDENCE_COUNT: 1,
      INSUFFICIENT_SOURCE_DIVERSITY: 1,
    });
    expect(result.diagnostics.abstentions).toBe(2);
  });

  it("does not treat matching user_visible investigations as internal duplicates", async () => {
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
    const mock = createInvestigationDbMock({
      seedInvestigations: [
        {
          id: "inv-public-1",
          userId: "user-1",
          title: proposal.title,
          organizingQuestion: proposal.organizingQuestion,
          status: "open",
          visibility: "user_visible",
          candidateLifecycleStatus: "proposed",
          seedType: "pattern",
          evidenceNeeded: ["public summary"],
        },
      ],
    });

    const result = await persistInternalInvestigationCandidate({
      userId: "user-1",
      proposal,
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    expect(result.payload.blockedWriteReasons).not.toContain("DUPLICATE_CANDIDATE");
    expect(result.payload.candidatesWritten).toBe(1);
    expect(mock.investigations).toHaveLength(2);
    expect(
      mock.investigations.filter((row) => row.visibility === "internal_only")
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

    const mock = createInvestigationDbMock({
      seedInvestigations: [
        {
          id: "inv-existing-1",
          userId: "user-1",
          title: "Worth exploring:   Conflict Shutdown Pattern",
          organizingQuestion:
            "What would clarify whether conflict shutdown pattern?",
          status: "open",
          visibility: "internal_only",
          candidateLifecycleStatus: "proposed",
          seedType: "pattern",
          evidenceNeeded: ["existing summary"],
        },
      ],
    });

    const result = await persistInternalInvestigationCandidate({
      userId: "user-1",
      proposal: buildProposal({
        title: "  worth exploring: conflict shutdown pattern ",
      }),
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    expect(result.payload.candidatesWritten).toBe(0);
    expect(result.payload.duplicateCandidates).toBe(1);
    expect(result.payload.blockedWriteReasons).toContain("DUPLICATE_CANDIDATE");
    expect(mock.investigations).toHaveLength(1);
    expect(mock.links).toHaveLength(0);
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
    const mock = createInvestigationDbMock({
      failLinkWriteAtCall: 2,
      failLinkWriteError: new UnderstandingEvidenceLinkValidationError({
        field: "sourceId",
        message:
          "Source not found for authenticated user or source type is not verifiable in Phase 1B",
      }),
    });

    const result = await persistInternalInvestigationCandidate({
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
    expect(mock.investigations).toHaveLength(0);
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
        sourceType: "message",
        sourceId: "msg-1",
        role: "receipt",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
    ]);
    const mock = createInvestigationDbMock({
      failLinkWriteAtCall: 1,
      failLinkWriteError: new UnderstandingEvidenceLinkDuplicateError(),
    });

    const result = await persistInternalInvestigationCandidate({
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
    expect(mock.investigations).toHaveLength(0);
    expect(mock.links).toHaveLength(0);
  });

  it("classifies investigation create failure separately from link write failure", async () => {
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
    const mock = createInvestigationDbMock({ failInvestigationCreate: true });

    const result = await persistInternalInvestigationCandidate({
      userId: "user-1",
      proposal: buildProposal(),
      db: mock.db,
      now: FIXED_NOW,
      packet,
    });

    expect(result.payload.candidatesWritten).toBe(0);
    expect(result.payload.rollbackCount).toBe(1);
    expectTransactionFailureDiagnostics(result.payload, {
      blockedReason: "INVESTIGATION_WRITE_FAILED",
      beforeAnyLinkAttempt: true,
      evidenceLinksAttempted: 0,
      errorName: "PrismaClientKnownRequestError",
      prismaCode: "P2003",
    });
    expect(result.payload.blockedWriteReasons).not.toContain("LINK_WRITE_FAILED");
    expect(mock.investigations).toHaveLength(0);
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

    const mock = createInvestigationDbMock();

    const result = await persistInternalInvestigationCandidate({
      userId: "user-1",
      proposal: buildProposal({ evidenceSelections }),
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
