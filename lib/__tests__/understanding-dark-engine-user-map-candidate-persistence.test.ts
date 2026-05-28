import {
  UserMapConclusionStatus,
  type UnderstandingLinkSourceType,
} from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  persistInternalUserMapConclusionCandidate,
  type PersistInternalUserMapConclusionCandidateInput,
} from "../understanding-dark-engine/user-map-candidate-persistence";

const FIXED_NOW = new Date("2026-05-16T10:00:00.000Z");

type CandidateDb = NonNullable<
  PersistInternalUserMapConclusionCandidateInput["db"]
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
  episodeKey?: string | null;
};

type InMemoryConclusion = {
  id: string;
  userId: string;
  area: string;
  status: string;
  visibility: string;
  candidateLifecycleStatus: string | null;
  title: string;
  summary: string;
  supersededById: string | null;
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
      episodeKey: item.episodeKey ?? null,
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
      distinctEpisodeCount: new Set(
        items.map((item) => item.episodeKey).filter((value): value is string => Boolean(value))
      ).size,
    },
  };
}

function buildEvaluation(args: {
  packet: ReturnType<typeof buildPacket>;
  decision: "pass" | "pass_with_cap" | "abstain";
  confidenceCap?: number;
  reasons?: string[];
  warnings?: string[];
}) {
  return {
    result: {
      decision: args.decision,
      allowedStatus:
        args.decision === "pass_with_cap"
          ? UserMapConclusionStatus.tentative
          : UserMapConclusionStatus.emerging,
      confidenceCap: args.confidenceCap ?? 0.5,
      reasons: (args.reasons ?? []) as Array<
        | "INSUFFICIENT_EVIDENCE_COUNT"
        | "INSUFFICIENT_SOURCE_DIVERSITY"
        | "INSUFFICIENT_TIME_SPREAD"
        | "HIGH_EMOTION_DOMINANCE_CAP"
        | "HIGH_EMOTION_IDENTITY_BLOCK"
        | "SINGLE_EPISODE_SUPPORTED_BLOCK"
        | "MISSING_PROVENANCE"
        | "NON_LINKABLE_CONTEXT_ONLY"
        | "LOW_QUOTE_QUALITY"
        | "PROFILE_ARTIFACT_CAP"
        | "DISCONFIRMATION_UNRESOLVED"
        | "CORRECTION_DOWNGRADE_ACTIVE"
        | "NO_MEANINGFUL_DELTA"
        | "SYNTHETIC_INSIGHT_BLOCKED"
        | "LANGUAGE_OVERCLAIMING_BLOCKED"
      >,
      warnings: (args.warnings ?? []) as Array<
        | "INSUFFICIENT_EVIDENCE_COUNT"
        | "INSUFFICIENT_SOURCE_DIVERSITY"
        | "INSUFFICIENT_TIME_SPREAD"
        | "HIGH_EMOTION_DOMINANCE_CAP"
        | "HIGH_EMOTION_IDENTITY_BLOCK"
        | "SINGLE_EPISODE_SUPPORTED_BLOCK"
        | "MISSING_PROVENANCE"
        | "NON_LINKABLE_CONTEXT_ONLY"
        | "LOW_QUOTE_QUALITY"
        | "PROFILE_ARTIFACT_CAP"
        | "DISCONFIRMATION_UNRESOLVED"
        | "CORRECTION_DOWNGRADE_ACTIVE"
        | "NO_MEANINGFUL_DELTA"
        | "SYNTHETIC_INSIGHT_BLOCKED"
        | "LANGUAGE_OVERCLAIMING_BLOCKED"
      >,
      metrics: {
        evidenceCount: args.packet.metrics.linkableEvidenceCount,
        sourceDiversity: args.packet.metrics.sourceDiversity,
        timeSpreadDays: args.packet.metrics.timeSpreadDays,
        highEmotionDominanceRatio: 0,
        distinctEpisodeCount: args.packet.metrics.distinctEpisodeCount,
      },
    },
    diagnostics: {
      packetsAssembled: 1,
      candidatesProposed: 1,
      candidatesWritten: 0,
      abstentions: args.decision === "abstain" ? 1 : 0,
      rejectionCountsByReason: {},
      sourceCounts: args.packet.metrics.sourceCounts,
      sourceDiversity: args.packet.metrics.sourceDiversity,
      timeSpreadDays: args.packet.metrics.timeSpreadDays,
      importedVsNative: {
        imported: args.packet.metrics.importedCount,
        native: args.packet.metrics.nativeCount,
        mixed: args.packet.metrics.mixedCount,
        unknown: args.packet.metrics.unknownOriginCount,
      },
      highEmotionCaps: 0,
      singleEpisodeBlocks: 0,
      nonLinkableContextItems: args.packet.metrics.nonLinkableContextItems,
      linkIntegrityWarnings: [],
      notes: [],
    },
  };
}

function createCandidateDbMock(args?: {
  seedConclusions?: InMemoryConclusion[];
  failLinkWriteAtCall?: number;
}) {
  const runs: Array<Record<string, unknown>> = [];
  const artifacts: Array<Record<string, unknown>> = [];
  const conclusions: InMemoryConclusion[] = [...(args?.seedConclusions ?? [])];
  const links: InMemoryLink[] = [];

  let runSeq = 0;
  let artifactSeq = 0;
  let linkSeq = 0;
  let linkWriteCalls = 0;

  const forbiddenWrites = {
    investigationCreate: vi.fn(),
    modelUpdateCreate: vi.fn(),
    fieldworkCreate: vi.fn(),
  };

  const db: CandidateDb = {
    userMapConclusion: {
      findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
        if (!where) {
          return conclusions;
        }

        return conclusions.filter((row) => {
          if (where.userId && row.userId !== where.userId) return false;
          if (where.area && row.area !== where.area) return false;
          if (where.supersededById === null && row.supersededById !== null) return false;
          return true;
        });
      }),
      findFirst: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
        if (!where) return conclusions[0] ?? null;

        return (
          conclusions.find((row) => {
            if (where.id && row.id !== where.id) return false;
            if (where.userId && row.userId !== where.userId) return false;
            if (where.visibility && row.visibility !== where.visibility) return false;
            return true;
          }) ?? null
        );
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const created: InMemoryConclusion = {
          id: `umc-${conclusions.length + 1}`,
          userId: data.userId as string,
          area: data.area as string,
          status: data.status as string,
          visibility: data.visibility as string,
          candidateLifecycleStatus: (data.candidateLifecycleStatus as string | null | undefined) ?? null,
          title: data.title as string,
          summary: data.summary as string,
          supersededById: (data.supersededById as string | null | undefined) ?? null,
        };
        conclusions.push(created);
        return { id: created.id };
      }),
      update: vi.fn(),
    },
    understandingEvidenceLink: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        linkWriteCalls += 1;

        if (args?.failLinkWriteAtCall && linkWriteCalls === args.failLinkWriteAtCall) {
          throw new Error("forced link write failure");
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
    contradictionNode: { findMany: vi.fn(), findFirst: vi.fn(async () => null) },
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
    investigation: {
      create: forbiddenWrites.investigationCreate,
      findFirst: vi.fn(async () => null),
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

      const conclusionSnapshot = conclusions.map((row) => ({ ...row }));
      const linkSnapshot = links.map((row) => ({ ...row }));

      try {
        return await (arg as (tx: CandidateDb) => Promise<unknown>)(db);
      } catch (error) {
        conclusions.splice(0, conclusions.length, ...conclusionSnapshot);
        links.splice(0, links.length, ...linkSnapshot);
        throw error;
      }
    }),
  } as unknown as CandidateDb;

  return {
    db,
    runs,
    artifacts,
    conclusions,
    links,
    forbiddenWrites,
  };
}

describe("user-map candidate persistence (manual/internal)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists an internal_only candidate + required evidence links on gate pass", async () => {
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
    const evaluation = buildEvaluation({
      packet,
      decision: "pass",
      confidenceCap: 0.5,
    });

    const mock = createCandidateDbMock();

    const result = await persistInternalUserMapConclusionCandidate({
      userId: "user-1",
      area: "operating_logic",
      title: "Conflict shutdown pattern",
      summary: "Candidate pattern across multiple owned sources.",
      target: {
        requestedStatus: UserMapConclusionStatus.emerging,
        identityLevelClaim: false,
        proposedSummary: "Candidate pattern across multiple owned sources.",
        requiresReceipt: true,
      },
      db: mock.db,
      now: FIXED_NOW,
      packet,
      evaluation,
      evidenceSelections: [
        { sourceType: "pattern_claim", sourceId: "claim-1" },
        { sourceType: "message", sourceId: "msg-1" },
      ],
    });

    expect(result.payload.candidatesWritten).toBe(1);
    expect(result.payload.evidenceLinksAttempted).toBe(2);
    expect(result.payload.evidenceLinksWritten).toBe(2);
    expect(result.payload.blockedWriteReasons).toHaveLength(0);
    expect(result.payload.dryRunOnly).toBe(false);
    expect(result.payload.candidateWritesEnabled).toBe(true);
    expect(result.payload.evidenceLinkWritesEnabled).toBe(true);

    expect(mock.conclusions).toHaveLength(1);
    expect(mock.conclusions[0]).toMatchObject({
      userId: "user-1",
      visibility: "internal_only",
      status: "emerging",
      area: "operating_logic",
      candidateLifecycleStatus: "proposed",
    });

    expect(mock.links).toHaveLength(2);
    expect(mock.runs).toHaveLength(1);
    expect(mock.runs[0]?.status).toBe("completed");
    expect(mock.artifacts).toHaveLength(1);

    expect(mock.forbiddenWrites.investigationCreate).not.toHaveBeenCalled();
    expect(mock.forbiddenWrites.modelUpdateCreate).not.toHaveBeenCalled();
    expect(mock.forbiddenWrites.fieldworkCreate).not.toHaveBeenCalled();
  });

  it("blocks write on abstain and does not create conclusion or links", async () => {
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
    const evaluation = buildEvaluation({
      packet,
      decision: "abstain",
      reasons: ["INSUFFICIENT_EVIDENCE_COUNT"],
      confidenceCap: 0.3,
    });

    const mock = createCandidateDbMock();

    const result = await persistInternalUserMapConclusionCandidate({
      userId: "user-1",
      area: "operating_logic",
      title: "Blocked candidate",
      summary: "Should abstain from write.",
      target: {
        requestedStatus: UserMapConclusionStatus.emerging,
        identityLevelClaim: false,
        proposedSummary: "Should abstain from write.",
        requiresReceipt: true,
      },
      db: mock.db,
      now: FIXED_NOW,
      packet,
      evaluation,
    });

    expect(result.payload.candidatesWritten).toBe(0);
    expect(result.payload.blockedWriteReasons).toContain(
      "INSUFFICIENT_EVIDENCE_COUNT"
    );
    expect(mock.conclusions).toHaveLength(0);
    expect(mock.links).toHaveLength(0);
  });

  it("blocks write when required fields are missing", async () => {
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
    const evaluation = buildEvaluation({ packet, decision: "pass" });

    const mock = createCandidateDbMock();

    const result = await persistInternalUserMapConclusionCandidate({
      userId: "user-1",
      area: "operating_logic",
      title: "",
      summary: "",
      target: {
        requestedStatus: UserMapConclusionStatus.emerging,
        identityLevelClaim: false,
        proposedSummary: "",
        requiresReceipt: true,
      },
      db: mock.db,
      now: FIXED_NOW,
      packet,
      evaluation,
    });

    expect(result.payload.blockedWriteReasons).toContain("MISSING_TITLE");
    expect(result.payload.blockedWriteReasons).toContain("MISSING_SUMMARY");
    expect(mock.conclusions).toHaveLength(0);
    expect(mock.links).toHaveLength(0);
  });

  it("blocks write for non-linkable context-only evidence selection", async () => {
    const packet = buildPacket([
      {
        sourceType: "timeline_aggregation",
        sourceId: "agg-1",
        role: "context",
        linkable: false,
        ownershipResolvable: false,
        origin: "mixed",
      },
      {
        sourceType: "user_correction",
        sourceId: "corr-1",
        role: "calibration",
        linkable: false,
        ownershipResolvable: false,
        origin: "unknown",
      },
    ]);
    const evaluation = buildEvaluation({ packet, decision: "pass", confidenceCap: 0.2 });
    const mock = createCandidateDbMock();

    const result = await persistInternalUserMapConclusionCandidate({
      userId: "user-1",
      area: "operating_logic",
      title: "Context-only candidate",
      summary: "Should not persist from non-linkable context.",
      target: {
        requestedStatus: UserMapConclusionStatus.emerging,
        identityLevelClaim: false,
        proposedSummary: "Should not persist from non-linkable context.",
        requiresReceipt: true,
      },
      db: mock.db,
      now: FIXED_NOW,
      packet,
      evaluation,
      evidenceSelections: [
        {
          sourceType: "timeline_aggregation",
          sourceId: "agg-1",
        },
      ],
    });

    expect(result.payload.candidatesWritten).toBe(0);
    expect(result.payload.blockedWriteReasons).toContain("NON_LINKABLE_CONTEXT_ONLY");
    expect(mock.conclusions).toHaveLength(0);
    expect(mock.links).toHaveLength(0);
  });

  it("blocks write when linkable evidence is insufficient", async () => {
    const packet = buildPacket([
      {
        sourceType: "pattern_claim",
        sourceId: "claim-1",
        role: "signal",
        linkable: true,
        ownershipResolvable: true,
        origin: "native",
      },
    ]);
    const evaluation = buildEvaluation({ packet, decision: "pass" });
    const mock = createCandidateDbMock();

    const result = await persistInternalUserMapConclusionCandidate({
      userId: "user-1",
      area: "operating_logic",
      title: "Insufficient evidence candidate",
      summary: "Only one source available.",
      target: {
        requestedStatus: UserMapConclusionStatus.emerging,
        identityLevelClaim: false,
        proposedSummary: "Only one source available.",
        requiresReceipt: true,
      },
      db: mock.db,
      now: FIXED_NOW,
      packet,
      evaluation,
    });

    expect(result.payload.candidatesWritten).toBe(0);
    expect(result.payload.blockedWriteReasons).toContain(
      "INSUFFICIENT_LINKABLE_EVIDENCE_COUNT"
    );
    expect(result.payload.blockedWriteReasons).toContain(
      "INSUFFICIENT_LINKABLE_SOURCE_DIVERSITY"
    );
    expect(mock.conclusions).toHaveLength(0);
    expect(mock.links).toHaveLength(0);
  });

  it("rolls back candidate write when evidence-link creation fails", async () => {
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
    const evaluation = buildEvaluation({ packet, decision: "pass" });
    const mock = createCandidateDbMock({ failLinkWriteAtCall: 2 });

    const result = await persistInternalUserMapConclusionCandidate({
      userId: "user-1",
      area: "operating_logic",
      title: "Rollback candidate",
      summary: "Second link fails and should rollback.",
      target: {
        requestedStatus: UserMapConclusionStatus.emerging,
        identityLevelClaim: false,
        proposedSummary: "Second link fails and should rollback.",
        requiresReceipt: true,
      },
      db: mock.db,
      now: FIXED_NOW,
      packet,
      evaluation,
      evidenceSelections: [
        { sourceType: "pattern_claim", sourceId: "claim-1" },
        { sourceType: "message", sourceId: "msg-1" },
      ],
    });

    expect(result.payload.candidatesWritten).toBe(0);
    expect(result.payload.rollbackCount).toBe(1);
    expect(result.payload.blockedWriteReasons).toContain("LINK_WRITE_FAILED");
    expect(result.payload.evidenceLinksWritten).toBe(0);
    expect(mock.conclusions).toHaveLength(0);
    expect(mock.links).toHaveLength(0);
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
    const evaluation = buildEvaluation({ packet, decision: "pass" });

    const mock = createCandidateDbMock({
      seedConclusions: [
        {
          id: "umc-existing-1",
          userId: "user-1",
          area: "operating_logic",
          status: "emerging",
          visibility: "internal_only",
          candidateLifecycleStatus: null,
          title: "Conflict   Shutdown Pattern",
          summary: "Candidate pattern across multiple owned sources.",
          supersededById: null,
        },
      ],
    });

    const result = await persistInternalUserMapConclusionCandidate({
      userId: "user-1",
      area: "operating_logic",
      title: "  conflict shutdown pattern ",
      summary: "Candidate pattern across multiple owned sources.",
      target: {
        requestedStatus: UserMapConclusionStatus.emerging,
        identityLevelClaim: false,
        proposedSummary: "Candidate pattern across multiple owned sources.",
        requiresReceipt: true,
      },
      db: mock.db,
      now: FIXED_NOW,
      packet,
      evaluation,
    });

    expect(result.payload.candidatesWritten).toBe(0);
    expect(result.payload.duplicateCandidates).toBe(1);
    expect(result.payload.blockedWriteReasons).toContain("DUPLICATE_CANDIDATE");
    expect(mock.conclusions).toHaveLength(1);
    expect(mock.links).toHaveLength(0);
  });

  it("blocks write when correction downgrade is active and requested confidence exceeds cap", async () => {
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

    const evaluation = buildEvaluation({
      packet,
      decision: "pass",
      confidenceCap: 0.25,
      warnings: ["CORRECTION_DOWNGRADE_ACTIVE"],
    });

    const mock = createCandidateDbMock();

    const result = await persistInternalUserMapConclusionCandidate({
      userId: "user-1",
      area: "operating_logic",
      title: "Correction-sensitive candidate",
      summary: "Candidate should remain blocked by corrected cap.",
      target: {
        requestedStatus: UserMapConclusionStatus.emerging,
        identityLevelClaim: false,
        proposedSummary: "Candidate should remain blocked by corrected cap.",
        requiresReceipt: true,
      },
      db: mock.db,
      now: FIXED_NOW,
      requestedConfidenceScore: 0.6,
      packet,
      evaluation,
    });

    expect(result.payload.candidatesWritten).toBe(0);
    expect(result.payload.blockedWriteReasons).toContain(
      "CORRECTION_DOWNGRADE_ACTIVE"
    );
    expect(mock.conclusions).toHaveLength(0);
    expect(mock.links).toHaveLength(0);
  });
});
