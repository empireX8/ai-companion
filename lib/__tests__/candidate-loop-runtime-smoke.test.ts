/**
 * Runtime smoke: candidate loop seams without live DB or credentials.
 *
 * Validates bridge persistence → lifecycle → publish → public visibility
 * for UserMap (full loop) and Investigation (publish-only companion path).
 */
import {
  CandidateLifecycleStatus,
  InvestigationSeedType,
  InvestigationStatus,
  InvestigationVisibility,
  ModelUpdateType,
  ModelUpdateVisibility,
  PatternClaimStatus,
  UserMapConclusionStatus,
  UserMapConclusionVisibility,
  type UnderstandingLinkSourceType,
} from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { updateCandidateLifecycleStatus } from "../candidate-lifecycle-persistence";
import { publishCandidate } from "../candidate-publish-helper";
import { buildPublicActiveInvestigationWhere } from "../investigation-public-visibility";
import { updateInvestigationCandidateLifecycleStatus } from "../investigation-candidate-lifecycle-persistence";
import { publishInvestigationCandidate } from "../investigation-publish-helper";
import { listYourMapPublicEvidenceContinuity } from "../public-evidence-continuity";
import {
  toActiveQuestionListItem,
  toYourMapListItem,
} from "../public-intelligence-safe-slice";
import { persistInternalCandidateFromNoWriteDarkRunOutput } from "../understanding-dark-engine/candidate-bridge-dark-run-persistence";
import type { RunNoWriteUnderstandingDarkRunResult } from "../understanding-dark-engine/dark-run-orchestrator";
import * as evidencePacketModule from "../understanding-dark-engine/evidence-packet";
import { extractStructuredUserMapCandidateProposal } from "../understanding-dark-engine/app-message-candidate-bridge";
import type { StructuredInvestigationCandidateProposal } from "../understanding-dark-engine/investigation-candidate-proposal";
import type { PersistInternalUserMapConclusionCandidateInput } from "../understanding-dark-engine/user-map-candidate-persistence";

const FIXED_NOW = new Date("2026-06-02T12:00:00.000Z");

vi.mock("server-only", () => ({}));

const prismaState = vi.hoisted(() => ({
  db: null as unknown,
}));

vi.mock("@/lib/prismadb", () => ({
  get default() {
    return prismaState.db;
  },
}));

vi.mock("../prismadb", () => ({
  get default() {
    return prismaState.db;
  },
}));

function wirePrismaMock(db: SmokeDb): void {
  prismaState.db = db;
}

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

type InMemoryConclusion = {
  id: string;
  userId: string;
  area: string;
  status: string;
  visibility: string;
  candidateLifecycleStatus: string | null;
  title: string;
  summary: string;
  confidenceLevel: string;
  confidenceScore: number;
  evidenceCount: number;
  sourceDiversity: number;
  timeSpreadDays: number;
  createdAt: Date;
  updatedAt: Date;
  supersededById: string | null;
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
  priority: number | null;
  createdAt: Date;
  updatedAt: Date;
  competingTheories: string[];
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
  snippet: string | null;
  quote: string | null;
  createdAt: Date;
};

type SmokeDb = NonNullable<PersistInternalUserMapConclusionCandidateInput["db"]>;

function buildPacket(items: PacketItemInput[]) {
  const sourceCounts: Record<string, number> = {};
  for (const item of items) {
    sourceCounts[item.sourceType] = (sourceCounts[item.sourceType] ?? 0) + 1;
  }

  const linkableEvidenceCount = items.filter((item) => item.linkable).length;
  const ownershipResolvableCount = items.filter(
    (item) => item.ownershipResolvable
  ).length;

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
      snippet: `private-snippet-${item.sourceId}`,
      quote: `private-quote-${item.sourceId}`,
      publicSafetyLevel: "safe_summary" as const,
      publicSafeSummary: "Safe public summary only.",
      containsRawPrivateText: true,
      provenanceRefs: {
        messageId: item.messageId,
        sessionId: item.sessionId,
      },
      qualityFlags: ["HAS_PROVENANCE"],
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
      importedCount: 0,
      nativeCount: items.length,
      mixedCount: 0,
      unknownOriginCount: 0,
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

const SMOKE_PACKET = buildPacket([
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

function makeUserMapBridgeDarkRunOutput(): RunNoWriteUnderstandingDarkRunResult {
  return {
    mode: "no_write_dark_run",
    userId: "user-1",
    packet: {
      assembledAt: FIXED_NOW.toISOString(),
      windowStart: SMOKE_PACKET.windowStart.toISOString(),
      windowEnd: SMOKE_PACKET.windowEnd.toISOString(),
      metrics: SMOKE_PACKET.metrics,
      items: SMOKE_PACKET.items.map((item) => ({
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        timestamp: item.timestamp.toISOString(),
        authoredAt: null,
        role: item.role,
        weightClass: item.weightClass,
        sourceFamily: item.sourceFamily,
        publicSafetyLevel: item.publicSafetyLevel,
        containsRawPrivateText: item.containsRawPrivateText,
        provenanceRefs: item.provenanceRefs,
        qualityFlags: item.qualityFlags,
        linkable: item.linkable,
        ownershipResolvable: item.ownershipResolvable,
        highEmotionSignal: item.highEmotionSignal,
        origin: item.origin,
        episodeKey: item.episodeKey,
      })),
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
        timeSpreadDays: 7,
        highEmotionDominanceRatio: 0,
        distinctEpisodeCount: 1,
      },
    },
    diagnostics: {
      packetsAssembled: 1,
      candidatesProposed: 1,
      candidatesWritten: 0,
      abstentions: 0,
      rejectionCountsByReason: {},
      sourceCounts: SMOKE_PACKET.metrics.sourceCounts,
      sourceDiversity: 2,
      timeSpreadDays: 7,
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
    userMapCandidateProposal: {
      area: "operating_logic",
      title: "Conflict shutdown pattern",
      summary: "Candidate pattern across multiple owned sources.",
      target: {
        requestedStatus: UserMapConclusionStatus.emerging,
        identityLevelClaim: false,
        proposedSummary: "Candidate pattern across multiple owned sources.",
        requiresReceipt: true,
      },
      evidenceSelections: [
        { sourceType: "pattern_claim", sourceId: "claim-1" },
        { sourceType: "message", sourceId: "msg-1" },
      ],
    },
    investigationCandidateProposal: null,
    fieldworkCandidateProposal: null,
    modelUpdateCandidateProposal: null,
  };
}

function makeInvestigationBridgeDarkRunOutput(): RunNoWriteUnderstandingDarkRunResult {
  const proposal: StructuredInvestigationCandidateProposal = {
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
  };

  return {
    mode: "no_write_dark_run",
    userId: "user-1",
    packet: makeUserMapBridgeDarkRunOutput().packet,
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
    diagnostics: {
      packetsAssembled: 1,
      candidatesProposed: 1,
      candidatesWritten: 0,
      abstentions: 1,
      rejectionCountsByReason: { INSUFFICIENT_EVIDENCE_COUNT: 1 },
      sourceCounts: SMOKE_PACKET.metrics.sourceCounts,
      sourceDiversity: 2,
      timeSpreadDays: 7,
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
    userMapCandidateProposal: null,
    investigationCandidateProposal: proposal,
    fieldworkCandidateProposal: null,
    modelUpdateCandidateProposal: null,
  };
}

function matchesPublicYourMapWhere(
  row: InMemoryConclusion,
  userId: string
): boolean {
  return row.userId === userId && row.visibility === "user_visible";
}

function matchesPublicInvestigationWhere(
  row: InMemoryInvestigation,
  userId: string
): boolean {
  const where = buildPublicActiveInvestigationWhere({ userId });
  if (row.userId !== where.userId) {
    return false;
  }
  if (row.visibility !== InvestigationVisibility.user_visible) {
    return false;
  }
  const statusFilter = where.status;
  const statusIn: InvestigationStatus[] =
    statusFilter &&
    typeof statusFilter === "object" &&
    "in" in statusFilter &&
    Array.isArray(statusFilter.in)
      ? statusFilter.in
      : typeof statusFilter === "string"
        ? [statusFilter]
        : [];
  if (!statusIn.includes(row.status as InvestigationStatus)) {
    return false;
  }
  const lifecycleAllowed = (where.OR ?? []).some(
    (clause) =>
      "candidateLifecycleStatus" in clause &&
      clause.candidateLifecycleStatus === row.candidateLifecycleStatus
  );
  return lifecycleAllowed;
}

async function promoteLifecycleManagedCandidate(
  userId: string,
  objectId: string,
  db: SmokeDb,
  family: "usermap" | "investigation"
): Promise<void> {
  if (family === "usermap") {
    await updateCandidateLifecycleStatus(
      userId,
      objectId,
      CandidateLifecycleStatus.held_for_more_evidence,
      { db: db as never, now: FIXED_NOW }
    );
    await updateCandidateLifecycleStatus(
      userId,
      objectId,
      CandidateLifecycleStatus.promoted,
      { db: db as never, now: FIXED_NOW }
    );
    return;
  }

  await updateInvestigationCandidateLifecycleStatus(
    userId,
    objectId,
    CandidateLifecycleStatus.held_for_more_evidence,
    { db: db as never, now: FIXED_NOW }
  );
  await updateInvestigationCandidateLifecycleStatus(
    userId,
    objectId,
    CandidateLifecycleStatus.promoted,
    { db: db as never, now: FIXED_NOW }
  );
}

function createCandidateLoopSmokeDb() {
  const conclusions: InMemoryConclusion[] = [];
  const investigations: InMemoryInvestigation[] = [];
  const links: InMemoryLink[] = [];
  const modelUpdates: Array<Record<string, unknown>> = [];

  const runs: Array<Record<string, unknown>> = [];
  let runSeq = 0;
  let artifactSeq = 0;
  let linkSeq = 0;

  const ownershipLookup = {
    patternClaim: (id: string) => id.startsWith("claim"),
    message: (id: string) => id.startsWith("msg"),
  };

  const db = {
    userMapConclusion: {
      findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
        return conclusions.filter((row) => {
          if (where?.userId && row.userId !== where.userId) return false;
          if (where?.visibility && row.visibility !== where.visibility) return false;
          if (where?.area && row.area !== where.area) return false;
          if (where?.supersededById === null && row.supersededById !== null) {
            return false;
          }
          return true;
        });
      }),
      findFirst: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
        return (
          conclusions.find((row) => {
            if (where?.id && row.id !== where.id) return false;
            if (where?.userId && row.userId !== where.userId) return false;
            if (where?.visibility && row.visibility !== where.visibility) return false;
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
          candidateLifecycleStatus:
            (data.candidateLifecycleStatus as string | null | undefined) ?? null,
          title: data.title as string,
          summary: data.summary as string,
          confidenceLevel: (data.confidenceLevel as string) ?? "medium",
          confidenceScore: (data.confidenceScore as number) ?? 0.5,
          evidenceCount: (data.evidenceCount as number) ?? 0,
          sourceDiversity: (data.sourceDiversity as number) ?? 0,
          timeSpreadDays: (data.timeSpreadDays as number) ?? 0,
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
          supersededById: null,
        };
        conclusions.push(created);
        return { id: created.id };
      }),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const idx = conclusions.findIndex((row) => row.id === where.id);
          if (idx < 0) {
            throw new Error("conclusion not found");
          }
          conclusions[idx] = {
            ...conclusions[idx],
            candidateLifecycleStatus:
              (data.candidateLifecycleStatus as string | undefined) ??
              conclusions[idx].candidateLifecycleStatus,
            visibility: (data.visibility as string | undefined) ?? conclusions[idx].visibility,
            updatedAt: (data.updatedAt as Date | undefined) ?? conclusions[idx].updatedAt,
          };
          return {
            id: conclusions[idx].id,
            userId: conclusions[idx].userId,
            candidateLifecycleStatus: conclusions[idx].candidateLifecycleStatus,
            updatedAt: conclusions[idx].updatedAt,
          };
        }
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: {
            id: string;
            userId: string;
            visibility: string;
            candidateLifecycleStatus: string;
          };
          data: { visibility: string; updatedAt: Date };
        }) => {
          const idx = conclusions.findIndex(
            (row) =>
              row.id === where.id &&
              row.userId === where.userId &&
              row.visibility === where.visibility &&
              row.candidateLifecycleStatus === where.candidateLifecycleStatus
          );
          if (idx < 0) {
            return { count: 0 };
          }
          conclusions[idx] = {
            ...conclusions[idx],
            visibility: data.visibility,
            updatedAt: data.updatedAt,
          };
          return { count: 1 };
        }
      ),
    },
    investigation: {
      findMany: vi.fn(async () => investigations),
      findFirst: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
        return (
          investigations.find((row) => {
            if (where?.id && row.id !== where.id) return false;
            if (where?.userId && row.userId !== where.userId) return false;
            if (where?.visibility && row.visibility !== where.visibility) return false;
            return true;
          }) ?? null
        );
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
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
          priority: (data.priority as number | null | undefined) ?? null,
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
          competingTheories: (data.competingTheories as string[] | undefined) ?? [],
          evidenceNeeded: (data.evidenceNeeded as string[] | undefined) ?? [],
        };
        investigations.push(created);
        return { id: created.id };
      }),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const idx = investigations.findIndex((row) => row.id === where.id);
          if (idx < 0) {
            throw new Error("investigation not found");
          }
          investigations[idx] = {
            ...investigations[idx],
            candidateLifecycleStatus:
              (data.candidateLifecycleStatus as string | undefined) ??
              investigations[idx].candidateLifecycleStatus,
            updatedAt: (data.updatedAt as Date | undefined) ?? investigations[idx].updatedAt,
          };
          return {
            id: investigations[idx].id,
            userId: investigations[idx].userId,
            candidateLifecycleStatus: investigations[idx].candidateLifecycleStatus,
            status: investigations[idx].status,
            visibility: investigations[idx].visibility,
            updatedAt: investigations[idx].updatedAt,
          };
        }
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: {
            id: string;
            userId: string;
            visibility: InvestigationVisibility;
            candidateLifecycleStatus: string;
            status?: { in: InvestigationStatus[] };
          };
          data: { visibility: InvestigationVisibility; updatedAt: Date };
        }) => {
          const row = investigations.find(
            (candidate) =>
              candidate.id === where.id &&
              candidate.userId === where.userId &&
              candidate.visibility === where.visibility &&
              candidate.candidateLifecycleStatus === where.candidateLifecycleStatus
          );
          if (!row) {
            return { count: 0 };
          }
          if (where.status?.in && !where.status.in.includes(row.status as InvestigationStatus)) {
            return { count: 0 };
          }
          row.visibility = data.visibility;
          row.updatedAt = data.updatedAt;
          return { count: 1 };
        }
      ),
    },
    understandingEvidenceLink: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
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
          createdAt: FIXED_NOW,
        };
        links.push(created);
        return created;
      }),
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: {
            userId: string;
            targetType: string;
            targetId: string;
            sourceType?: { in: string[] };
          };
        }) => {
          return links
            .filter(
              (row) =>
                row.userId === where.userId &&
                row.targetType === where.targetType &&
                row.targetId === where.targetId &&
                (!where.sourceType?.in || where.sourceType.in.includes(row.sourceType))
            )
            .map((row) => ({
              id: row.id,
              sourceType: row.sourceType,
              sourceId: row.sourceId,
              createdAt: row.createdAt,
            }));
        }
      ),
    },
    patternClaim: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: {
            userId: string;
            id?: { in: string[] };
            status?: { not: PatternClaimStatus };
          };
        }) => {
          const ids = where.id?.in ?? ["claim-1"];
          return ids
            .filter((id) => ownershipLookup.patternClaim(id))
            .map((id) => ({
              id,
              userId: where.userId,
              status: PatternClaimStatus.active,
            }));
        }
      ),
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
        return ownershipLookup.patternClaim(where.id) ? { id: where.id } : null;
      }),
    },
    message: {
      findMany: vi.fn(),
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
        return ownershipLookup.message(where.id) ? { id: where.id } : null;
      }),
    },
    contradictionNode: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
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
    fieldworkAssignment: {
      create: vi.fn(),
      findFirst: vi.fn(async () => null),
    },
    modelUpdate: {
      findMany: vi.fn(async () => modelUpdates),
      findFirst: vi.fn(async ({ where }: { where?: { id?: string; userId?: string } }) => {
        return (
          modelUpdates.find(
            (row) =>
              (!where?.id || row.id === where.id) &&
              (!where?.userId || row.userId === where.userId)
          ) ?? null
        );
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `mu-${modelUpdates.length + 1}`,
          ...data,
          createdAt: FIXED_NOW,
        };
        modelUpdates.push(row);
        return row;
      }),
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
          createdAt: FIXED_NOW,
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
      create: vi.fn(async () => {
        artifactSeq += 1;
        return { id: `artifact-${artifactSeq}` };
      }),
    },
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg !== "function") {
        return Promise.all(arg as Promise<unknown>[]);
      }

      const conclusionSnapshot = conclusions.map((row) => ({ ...row }));
      const investigationSnapshot = investigations.map((row) => ({ ...row }));
      const linkSnapshot = links.map((row) => ({ ...row }));
      const modelUpdateSnapshot = modelUpdates.map((row) => ({ ...row }));

      try {
        return await (arg as (tx: typeof db) => Promise<unknown>)(db);
      } catch (error) {
        conclusions.splice(0, conclusions.length, ...conclusionSnapshot);
        investigations.splice(0, investigations.length, ...investigationSnapshot);
        links.splice(0, links.length, ...linkSnapshot);
        modelUpdates.splice(0, modelUpdates.length, ...modelUpdateSnapshot);
        throw error;
      }
    }),
  } as unknown as SmokeDb;

  return {
    db,
    conclusions,
    investigations,
    links,
    modelUpdates,
  };
}

describe("Candidate loop runtime smoke", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    vi.spyOn(evidencePacketModule, "assembleEvidencePacketV1").mockResolvedValue(
      SMOKE_PACKET as never
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("UserMap conclusion family", () => {
    it("connects bridge persistence, lifecycle promote, publish, and Your Map public visibility", async () => {
      const smoke = createCandidateLoopSmokeDb();
      wirePrismaMock(smoke.db);

      const darkRunOutput = makeUserMapBridgeDarkRunOutput();
      const proposal = extractStructuredUserMapCandidateProposal(darkRunOutput);
      expect(proposal).not.toBeNull();

      const bridgeResult = await persistInternalCandidateFromNoWriteDarkRunOutput({
        userId: "user-1",
        darkRunOutput,
        db: smoke.db as never,
        now: FIXED_NOW,
        logTag: "[SMOKE]",
      });

      expect(bridgeResult.decision).toBe("created");
      expect(bridgeResult.persistedConclusionId).toBeTruthy();

      const conclusionId = bridgeResult.persistedConclusionId!;
      const persisted = smoke.conclusions.find((row) => row.id === conclusionId);
      expect(persisted).toMatchObject({
        visibility: UserMapConclusionVisibility.internal_only,
        candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
      });
      expect(
        smoke.links.filter(
          (link) =>
            link.targetType === "usermap_conclusion" && link.targetId === conclusionId
        )
      ).toHaveLength(2);
      expect(smoke.links.every((link) => link.snippet == null && link.quote == null)).toBe(
        true
      );

      expect(matchesPublicYourMapWhere(persisted!, "user-1")).toBe(false);

      await promoteLifecycleManagedCandidate("user-1", conclusionId, smoke.db, "usermap");

      const publishResult = await publishCandidate("user-1", conclusionId, {
        db: smoke.db as never,
        now: FIXED_NOW,
      });
      expect(publishResult.newVisibility).toBe(UserMapConclusionVisibility.user_visible);

      const published = smoke.conclusions.find((row) => row.id === conclusionId)!;
      expect(matchesPublicYourMapWhere(published, "user-1")).toBe(true);

      const listItem = toYourMapListItem({
        id: published.id,
        title: published.title,
        summary: published.summary,
        area: published.area as never,
        status: published.status as never,
        confidenceLevel: published.confidenceLevel as never,
        evidenceCount: published.evidenceCount,
        updatedAt: published.updatedAt,
      });
      expect(listItem?.detailHref).toBe(`/your-map/${conclusionId}`);

      const provenance = await listYourMapPublicEvidenceContinuity({
        userId: "user-1",
        targetId: conclusionId,
      });
      expect(provenance.length).toBeGreaterThan(0);
      expect(provenance[0]?.href).toBe("/patterns/claim-1");

      const serialized = JSON.stringify(provenance);
      expect(serialized).not.toContain("private-snippet");
      expect(serialized).not.toContain("private-quote");
      expect(serialized).not.toContain("internalNotes");

      expect(smoke.modelUpdates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            updateType: ModelUpdateType.conclusion_added,
            visibility: ModelUpdateVisibility.user_visible,
            affectedObjectId: conclusionId,
          }),
        ])
      );
    });

    it("keeps persisted candidates off public surfaces until publish", async () => {
      const smoke = createCandidateLoopSmokeDb();

      const bridgeResult = await persistInternalCandidateFromNoWriteDarkRunOutput({
        userId: "user-1",
        darkRunOutput: makeUserMapBridgeDarkRunOutput(),
        db: smoke.db as never,
        now: FIXED_NOW,
        logTag: "[SMOKE]",
      });

      expect(bridgeResult.decision).toBe("created");
      const conclusionId = bridgeResult.persistedConclusionId!;
      const persisted = smoke.conclusions.find((row) => row.id === conclusionId)!;

      expect(matchesPublicYourMapWhere(persisted, "user-1")).toBe(false);

      await promoteLifecycleManagedCandidate("user-1", conclusionId, smoke.db, "usermap");
      expect(matchesPublicYourMapWhere(persisted, "user-1")).toBe(false);
    });

    it("requires persisted evidence links for public provenance after publish", async () => {
      const smoke = createCandidateLoopSmokeDb();
      wirePrismaMock(smoke.db);

      const bridgeResult = await persistInternalCandidateFromNoWriteDarkRunOutput({
        userId: "user-1",
        darkRunOutput: makeUserMapBridgeDarkRunOutput(),
        db: smoke.db as never,
        now: FIXED_NOW,
        logTag: "[SMOKE]",
      });
      const conclusionId = bridgeResult.persistedConclusionId!;

      await promoteLifecycleManagedCandidate("user-1", conclusionId, smoke.db, "usermap");
      await publishCandidate("user-1", conclusionId, {
        db: smoke.db as never,
        now: FIXED_NOW,
      });

      const linkCount = smoke.links.filter(
        (link) =>
          link.targetType === "usermap_conclusion" && link.targetId === conclusionId
      ).length;
      expect(linkCount).toBeGreaterThanOrEqual(2);

      const provenance = await listYourMapPublicEvidenceContinuity({
        userId: "user-1",
        targetId: conclusionId,
      });
      expect(provenance.length).toBeGreaterThan(0);

      smoke.links.splice(0, smoke.links.length);
      const provenanceAfterLinkRemoval = await listYourMapPublicEvidenceContinuity({
        userId: "user-1",
        targetId: conclusionId,
      });
      expect(provenanceAfterLinkRemoval).toHaveLength(0);
    });
  });

  describe("Investigation family", () => {
    it("connects bridge persistence, publish, and Active Questions public eligibility", async () => {
      const smoke = createCandidateLoopSmokeDb();

      const bridgeResult = await persistInternalCandidateFromNoWriteDarkRunOutput({
        userId: "user-1",
        darkRunOutput: makeInvestigationBridgeDarkRunOutput(),
        db: smoke.db as never,
        now: FIXED_NOW,
        logTag: "[SMOKE]",
      });

      expect(bridgeResult.decision).toBe("created_investigation_candidate");
      expect(bridgeResult.persistedInvestigationId).toBeTruthy();

      const investigationId = bridgeResult.persistedInvestigationId!;
      const persisted = smoke.investigations.find((row) => row.id === investigationId)!;
      expect(persisted).toMatchObject({
        visibility: InvestigationVisibility.internal_only,
        candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
        status: InvestigationStatus.open,
      });
      expect(matchesPublicInvestigationWhere(persisted, "user-1")).toBe(false);

      await promoteLifecycleManagedCandidate(
        "user-1",
        investigationId,
        smoke.db,
        "investigation"
      );

      const publishResult = await publishInvestigationCandidate("user-1", investigationId, {
        db: smoke.db as never,
        now: FIXED_NOW,
      });
      expect(publishResult.newVisibility).toBe(InvestigationVisibility.user_visible);

      const published = smoke.investigations.find((row) => row.id === investigationId)!;
      expect(matchesPublicInvestigationWhere(published, "user-1")).toBe(true);

      const listItem = toActiveQuestionListItem({
        id: published.id,
        title: published.title,
        organizingQuestion: published.organizingQuestion,
        status: published.status as InvestigationStatus,
        seedType: published.seedType as never,
        priority: published.priority,
        updatedAt: published.updatedAt,
      });
      expect(listItem?.detailHref).toBe(`/active-questions/${investigationId}`);

      expect(smoke.modelUpdates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            updateType: ModelUpdateType.investigation_opened,
            visibility: ModelUpdateVisibility.user_visible,
            affectedObjectId: investigationId,
          }),
        ])
      );
    });
  });
});
