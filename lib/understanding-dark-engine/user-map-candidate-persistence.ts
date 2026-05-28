import {
  CandidateLifecycleStatus,
  type PrismaClient,
  UserMapConfidenceLevel,
  UserMapConclusionArea,
  UserMapConclusionStatus,
  UserMapConclusionVisibility,
  type UnderstandingLinkRole,
  type UnderstandingLinkSourceType,
} from "@prisma/client";

import {
  UNDERSTANDING_DARK_ENGINE_DIAGNOSTICS_ARTIFACT_TYPE,
  completeDerivationRun,
  createDerivationArtifact,
  createDerivationRun,
  failDerivationRun,
  startDerivationRun,
} from "../derivation-layer";
import prismadb from "../prismadb";
import {
  UnderstandingEvidenceLinkValidationError,
  createUnderstandingEvidenceLinkForUser,
  type UnderstandingEvidenceLinkWriteInput,
  type UnderstandingEvidenceLinkWriterDb,
} from "../understanding-evidence-link-writer";
import { createDarkRunDiagnosticsFromPacket } from "./diagnostics";
import {
  evaluateDarkRunUserMapCandidate,
  type DarkRunUserMapEvaluation,
} from "./dark-run-evaluator";
import {
  assembleEvidencePacketV1,
  type AssembleEvidencePacketInput,
} from "./evidence-packet";
import type {
  DarkRunDiagnostics,
  EvidencePacket,
  EvidencePacketItem,
  EvidencePacketMetrics,
  GateEvaluationTarget,
} from "./types";

const DEFAULT_PROCESSOR_VERSION = "understanding-dark-engine-v1";
const TITLE_MAX_LENGTH = 120;
const SUMMARY_MAX_LENGTH = 600;

const DISALLOWED_PERSISTED_SOURCE_TYPES = new Set<UnderstandingLinkSourceType>([
  "timeline_aggregation",
  "user_correction",
]);

type CandidatePersistenceDb = PrismaClient &
  NonNullable<AssembleEvidencePacketInput["db"]> &
  UnderstandingEvidenceLinkWriterDb;

export type UserMapCandidateEvidenceSelection = {
  sourceType: UnderstandingLinkSourceType;
  sourceId: string;
  role?: UnderstandingLinkRole;
  summary?: string;
  snippet?: string;
  quote?: string;
  weight?: number | null;
  confidenceContribution?: number | null;
  meta?: Record<string, unknown>;
};

export type PersistInternalUserMapConclusionCandidateInput = {
  userId: string;
  area: UserMapConclusionArea;
  title: string;
  summary: string;
  target: GateEvaluationTarget;
  db?: CandidatePersistenceDb;
  now?: Date;
  windowDays?: number;
  processorVersion?: string;
  requestedConfidenceScore?: number;
  packet?: EvidencePacket;
  evaluation?: DarkRunUserMapEvaluation;
  evidenceSelections?: UserMapCandidateEvidenceSelection[];
};

export type UnderstandingDarkRunCandidatePersistencePayload = {
  runId: string;
  userId: string;
  runCreatedAt: string;
  persistedAt: string;
  processorVersion: string;
  packetMetrics: EvidencePacketMetrics;
  candidatesProposed: number;
  candidatesWritten: number;
  abstentions: number;
  rejectionCountsByReason: DarkRunDiagnostics["rejectionCountsByReason"];
  sourceCounts: DarkRunDiagnostics["sourceCounts"];
  sourceDiversity: number;
  timeSpreadDays: number;
  importedVsNative: DarkRunDiagnostics["importedVsNative"];
  highEmotionCaps: number;
  singleEpisodeBlocks: number;
  nonLinkableContextItems: number;
  linkIntegrityWarnings: string[];
  warnings: string[];
  notes: string[];
  evidenceLinksAttempted: number;
  evidenceLinksWritten: number;
  blockedWriteReasons: string[];
  duplicateCandidates: number;
  rollbackCount: number;
  persistedConclusionId: string | null;
  dryRunOnly: false;
  candidateWritesEnabled: true;
  evidenceLinkWritesEnabled: true;
};

export type PersistInternalUserMapConclusionCandidateResult = {
  runId: string;
  artifactId: string;
  artifactType: string;
  processorVersion: string;
  runCreatedAt: string;
  persistedAt: string;
  diagnostics: DarkRunDiagnostics;
  payload: UnderstandingDarkRunCandidatePersistencePayload;
  persistedConclusionId: string | null;
};

type PersistableLink = {
  sourceType: UnderstandingLinkSourceType;
  sourceId: string;
  role: UnderstandingLinkRole;
  summary?: string;
  snippet?: string;
  quote?: string;
  weight?: number | null;
  confidenceContribution?: number | null;
  meta?: Record<string, unknown>;
};

function defaultGateTarget(): GateEvaluationTarget {
  return {
    requestedStatus: UserMapConclusionStatus.emerging,
    identityLevelClaim: false,
    proposedSummary: "Manual internal candidate persistence run.",
    requiresReceipt: true,
  };
}

function normalizeForDedupe(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function truncateText(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return trimmed.slice(0, maxLength);
}

function mapPacketRoleToLinkRole(role: EvidencePacketItem["role"]): UnderstandingLinkRole {
  switch (role) {
    case "context":
    case "container":
      return "context";
    case "outcome":
      return "outcome";
    case "calibration":
      return "correction";
    case "signal":
    case "receipt":
    default:
      return "supports";
  }
}

function mapDecisionToPersistedStatus(
  decision: "pass" | "pass_with_cap" | "abstain"
): UserMapConclusionStatus | null {
  if (decision === "abstain") {
    return null;
  }
  if (decision === "pass_with_cap") {
    return UserMapConclusionStatus.tentative;
  }
  return UserMapConclusionStatus.emerging;
}

function mapConfidenceLevel(args: {
  confidenceScore: number;
  evidenceCount: number;
  sourceDiversity: number;
}): UserMapConfidenceLevel {
  if (args.confidenceScore <= 0.3) {
    return UserMapConfidenceLevel.low;
  }

  const hasMinimumEvidence = args.evidenceCount >= 2 && args.sourceDiversity >= 2;
  if (hasMinimumEvidence) {
    return UserMapConfidenceLevel.medium;
  }

  return UserMapConfidenceLevel.low;
}

function buildRunMessageIdsFromPacket(packet: EvidencePacket): string[] {
  return [
    ...new Set(
      packet.items
        .map((item) => item.provenanceRefs.messageId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
}

function buildRunSessionCountFromPacket(packet: EvidencePacket): number {
  return new Set(
    packet.items
      .map((item) => item.provenanceRefs.sessionId)
      .filter((id): id is string => Boolean(id))
  ).size;
}

function addBlockedReason(blockedWriteReasons: string[], reason: string): void {
  if (!blockedWriteReasons.includes(reason)) {
    blockedWriteReasons.push(reason);
  }
}

function dedupeLinks(links: PersistableLink[]): PersistableLink[] {
  const seen = new Set<string>();
  const deduped: PersistableLink[] = [];

  for (const link of links) {
    const key = `${link.sourceType}|${link.sourceId}|${link.role}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(link);
  }

  return deduped;
}

function buildPersistableLinks(args: {
  packet: EvidencePacket;
  evidenceSelections?: UserMapCandidateEvidenceSelection[];
  blockedWriteReasons: string[];
}): PersistableLink[] {
  const packetLookup = new Map<string, EvidencePacketItem>();
  for (const item of args.packet.items) {
    packetLookup.set(`${item.sourceType}|${item.sourceId}`, item);
  }

  const selected: PersistableLink[] = [];

  if (args.evidenceSelections && args.evidenceSelections.length > 0) {
    for (const selection of args.evidenceSelections) {
      const packetItem = packetLookup.get(`${selection.sourceType}|${selection.sourceId}`);
      if (!packetItem) {
        addBlockedReason(args.blockedWriteReasons, "MISSING_PROVENANCE");
        continue;
      }
      if (!packetItem.linkable) {
        addBlockedReason(args.blockedWriteReasons, "NON_LINKABLE_CONTEXT_ONLY");
        continue;
      }
      if (!packetItem.ownershipResolvable) {
        addBlockedReason(args.blockedWriteReasons, "UNRESOLVED_OWNERSHIP");
        continue;
      }
      if (DISALLOWED_PERSISTED_SOURCE_TYPES.has(selection.sourceType)) {
        addBlockedReason(args.blockedWriteReasons, "DISALLOWED_SOURCE_TYPE");
        continue;
      }

      selected.push({
        sourceType: selection.sourceType,
        sourceId: selection.sourceId,
        role: selection.role ?? mapPacketRoleToLinkRole(packetItem.role),
        summary: selection.summary,
        snippet: selection.snippet,
        quote: selection.quote,
        weight: selection.weight,
        confidenceContribution: selection.confidenceContribution,
        meta: selection.meta,
      });
    }
  } else {
    for (const item of args.packet.items) {
      if (!item.linkable || !item.ownershipResolvable) {
        continue;
      }
      if (DISALLOWED_PERSISTED_SOURCE_TYPES.has(item.sourceType)) {
        continue;
      }
      selected.push({
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        role: mapPacketRoleToLinkRole(item.role),
        snippet: item.snippet ?? undefined,
        quote: item.quote ?? undefined,
      });
    }
  }

  return dedupeLinks(selected);
}

function applyEvidencePolicyChecks(args: {
  links: PersistableLink[];
  blockedWriteReasons: string[];
}): void {
  if (args.links.length === 0) {
    addBlockedReason(args.blockedWriteReasons, "NO_VALID_LINKABLE_EVIDENCE_SOURCES");
    return;
  }

  if (args.links.length < 2) {
    addBlockedReason(args.blockedWriteReasons, "INSUFFICIENT_LINKABLE_EVIDENCE_COUNT");
  }

  const sourceTypeCount = new Set(args.links.map((link) => link.sourceType)).size;
  if (sourceTypeCount < 2) {
    addBlockedReason(
      args.blockedWriteReasons,
      "INSUFFICIENT_LINKABLE_SOURCE_DIVERSITY"
    );
  }
}

function cloneDiagnostics(diagnostics: DarkRunDiagnostics): DarkRunDiagnostics {
  return {
    packetsAssembled: diagnostics.packetsAssembled,
    candidatesProposed: diagnostics.candidatesProposed,
    candidatesWritten: diagnostics.candidatesWritten,
    abstentions: diagnostics.abstentions,
    rejectionCountsByReason: { ...diagnostics.rejectionCountsByReason },
    sourceCounts: { ...diagnostics.sourceCounts },
    sourceDiversity: diagnostics.sourceDiversity,
    timeSpreadDays: diagnostics.timeSpreadDays,
    importedVsNative: { ...diagnostics.importedVsNative },
    highEmotionCaps: diagnostics.highEmotionCaps,
    singleEpisodeBlocks: diagnostics.singleEpisodeBlocks,
    nonLinkableContextItems: diagnostics.nonLinkableContextItems,
    linkIntegrityWarnings: [...diagnostics.linkIntegrityWarnings],
    notes: [...diagnostics.notes],
  };
}

function isUserMapConclusionArea(value: string): value is UserMapConclusionArea {
  return Object.values(UserMapConclusionArea).includes(value as UserMapConclusionArea);
}

export async function persistInternalUserMapConclusionCandidate(
  input: PersistInternalUserMapConclusionCandidateInput
): Promise<PersistInternalUserMapConclusionCandidateResult> {
  const db = (input.db ?? prismadb) as unknown as CandidatePersistenceDb;
  const now = input.now ?? new Date();
  const processorVersion = input.processorVersion ?? DEFAULT_PROCESSOR_VERSION;
  const target = input.target ?? defaultGateTarget();

  const packet =
    input.packet ??
    (await assembleEvidencePacketV1({
      userId: input.userId,
      now,
      windowDays: input.windowDays,
      db,
    }));

  const evaluation =
    input.evaluation ??
    evaluateDarkRunUserMapCandidate({
      packet,
      target,
    });

  const diagnostics = input.evaluation
    ? cloneDiagnostics(input.evaluation.diagnostics)
    : evaluation.diagnostics;

  const messageIds = buildRunMessageIdsFromPacket(packet);
  const sessionCount = buildRunSessionCountFromPacket(packet);

  const run = await createDerivationRun(
    {
      userId: input.userId,
      scope: "manual",
      processorVersion,
      messageIds,
      batchMeta: {
        messageCount: messageIds.length,
        sessionCount,
        windowStart: packet.windowStart,
        windowEnd: packet.windowEnd,
      },
    },
    db
  );

  let persistedAt = new Date();

  try {
    await startDerivationRun(run.id, db);

    const blockedWriteReasons: string[] = [];
    let duplicateCandidates = 0;
    let evidenceLinksAttempted = 0;
    let evidenceLinksWritten = 0;
    let rollbackCount = 0;
    let persistedConclusionId: string | null = null;
    let createdCandidate = false;

    const title = input.title.trim();
    const summary = input.summary.trim();

    if (!isUserMapConclusionArea(input.area)) {
      addBlockedReason(blockedWriteReasons, "MISSING_AREA");
    }
    if (!title) {
      addBlockedReason(blockedWriteReasons, "MISSING_TITLE");
    }
    if (!summary) {
      addBlockedReason(blockedWriteReasons, "MISSING_SUMMARY");
    }
    if (title.length > TITLE_MAX_LENGTH) {
      addBlockedReason(blockedWriteReasons, "TITLE_TOO_LONG");
    }
    if (summary.length > SUMMARY_MAX_LENGTH) {
      addBlockedReason(blockedWriteReasons, "SUMMARY_TOO_LONG");
    }

    if (evaluation.result.decision === "abstain") {
      for (const reason of evaluation.result.reasons) {
        addBlockedReason(blockedWriteReasons, reason);
      }
    }

    if (
      evaluation.result.warnings.includes("CORRECTION_DOWNGRADE_ACTIVE") &&
      typeof input.requestedConfidenceScore === "number" &&
      input.requestedConfidenceScore > evaluation.result.confidenceCap
    ) {
      addBlockedReason(blockedWriteReasons, "CORRECTION_DOWNGRADE_ACTIVE");
    }

    const links = buildPersistableLinks({
      packet,
      evidenceSelections: input.evidenceSelections,
      blockedWriteReasons,
    });

    applyEvidencePolicyChecks({
      links,
      blockedWriteReasons,
    });

    const canAttemptCreate = blockedWriteReasons.length === 0;

    if (canAttemptCreate) {
      const normalizedTitle = normalizeForDedupe(title);
      const normalizedSummary = normalizeForDedupe(summary);

      const existingCandidates = await db.userMapConclusion.findMany({
        where: {
          userId: input.userId,
          area: input.area,
          supersededById: null,
        },
        select: {
          id: true,
          title: true,
          summary: true,
        },
      });

      const duplicate = existingCandidates.find(
        (row) =>
          normalizeForDedupe(row.title) === normalizedTitle &&
          normalizeForDedupe(row.summary) === normalizedSummary
      );

      if (duplicate) {
        duplicateCandidates += 1;
        addBlockedReason(blockedWriteReasons, "DUPLICATE_CANDIDATE");
        persistedConclusionId = duplicate.id;
      }
    }

    if (blockedWriteReasons.length === 0) {
      const persistedStatus = mapDecisionToPersistedStatus(evaluation.result.decision);
      if (!persistedStatus) {
        addBlockedReason(blockedWriteReasons, "ABSTAIN");
      } else {
        const boundedConfidence = Math.min(
          evaluation.result.confidenceCap,
          typeof input.requestedConfidenceScore === "number"
            ? input.requestedConfidenceScore
            : evaluation.result.confidenceCap
        );

        const confidenceScore = Number(boundedConfidence.toFixed(4));
        const confidenceLevel = mapConfidenceLevel({
          confidenceScore,
          evidenceCount: links.length,
          sourceDiversity: new Set(links.map((link) => link.sourceType)).size,
        });

        if (persistedStatus === UserMapConclusionStatus.supported) {
          addBlockedReason(blockedWriteReasons, "SUPPORTED_STATUS_FORBIDDEN");
        }

        if (blockedWriteReasons.length === 0) {
          try {
            await db.$transaction(async (tx) => {
              const transactionalDb = tx as unknown as CandidatePersistenceDb;

              const created = await transactionalDb.userMapConclusion.create({
                data: {
                  userId: input.userId,
                  area: input.area,
                  status: persistedStatus,
                  visibility: UserMapConclusionVisibility.internal_only,
                  candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
                  title: truncateText(title, TITLE_MAX_LENGTH),
                  summary: truncateText(summary, SUMMARY_MAX_LENGTH),
                  confidenceScore,
                  confidenceLevel,
                  evidenceCount: links.length,
                  sourceDiversity: new Set(links.map((link) => link.sourceType)).size,
                  timeSpreadDays: evaluation.result.metrics.timeSpreadDays,
                  firstEvidenceAt: packet.windowStart,
                  lastEvidenceAt: packet.windowEnd,
                  notes: `sourceRun:${run.id}; decision:${evaluation.result.decision}`,
                },
                select: { id: true },
              });

              persistedConclusionId = created.id;
              createdCandidate = true;

              const targetType = "usermap_conclusion" as const;

              for (const link of links) {
                evidenceLinksAttempted += 1;
                const linkInput: UnderstandingEvidenceLinkWriteInput = {
                  targetType,
                  targetId: created.id,
                  sourceType: link.sourceType,
                  sourceId: link.sourceId,
                  role: link.role,
                  summary: link.summary,
                  snippet: link.snippet,
                  quote: link.quote,
                  weight: link.weight,
                  confidenceContribution: link.confidenceContribution,
                  meta: link.meta,
                };

                await createUnderstandingEvidenceLinkForUser({
                  userId: input.userId,
                  input: linkInput,
                  db: transactionalDb,
                });

                evidenceLinksWritten += 1;
              }
            });
          } catch (error) {
            rollbackCount += 1;
            evidenceLinksWritten = 0;
            createdCandidate = false;

            if (error instanceof UnderstandingEvidenceLinkValidationError) {
              addBlockedReason(blockedWriteReasons, "UNRESOLVED_OWNERSHIP");
            } else {
              addBlockedReason(blockedWriteReasons, "LINK_WRITE_FAILED");
            }
            persistedConclusionId = null;
          }
        }
      }
    }

    if (createdCandidate) {
      diagnostics.candidatesWritten += 1;
    }

    persistedAt = new Date();
    const notes = [...diagnostics.notes];
    notes.push(`decision:${evaluation.result.decision}`);
    notes.push(`allowedStatus:${evaluation.result.allowedStatus}`);
    if (blockedWriteReasons.length > 0) {
      notes.push(`blockedWriteReasons:${blockedWriteReasons.join(",")}`);
    }
    if (persistedConclusionId) {
      notes.push(`persistedConclusionId:${persistedConclusionId}`);
    }

    const payload: UnderstandingDarkRunCandidatePersistencePayload = {
      runId: run.id,
      userId: input.userId,
      runCreatedAt: run.createdAt.toISOString(),
      persistedAt: persistedAt.toISOString(),
      processorVersion,
      packetMetrics: packet.metrics,
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
      linkIntegrityWarnings: [...diagnostics.linkIntegrityWarnings],
      warnings: [...evaluation.result.warnings],
      notes,
      evidenceLinksAttempted,
      evidenceLinksWritten,
      blockedWriteReasons,
      duplicateCandidates,
      rollbackCount,
      persistedConclusionId,
      dryRunOnly: false,
      candidateWritesEnabled: true,
      evidenceLinkWritesEnabled: true,
    };

    const artifactId = await createDerivationArtifact(
      {
        userId: input.userId,
        runId: run.id,
        type: UNDERSTANDING_DARK_ENGINE_DIAGNOSTICS_ARTIFACT_TYPE,
        payload,
        confidenceScore: evaluation.result.confidenceCap,
        temporalStart: packet.windowStart,
        temporalEnd: packet.windowEnd,
      },
      db
    );

    await completeDerivationRun(run.id, db);

    return {
      runId: run.id,
      artifactId,
      artifactType: UNDERSTANDING_DARK_ENGINE_DIAGNOSTICS_ARTIFACT_TYPE,
      processorVersion,
      runCreatedAt: run.createdAt.toISOString(),
      persistedAt: persistedAt.toISOString(),
      diagnostics,
      payload,
      persistedConclusionId,
    };
  } catch (error) {
    await failDerivationRun(run.id, db).catch(() => {
      // best-effort failure transition
    });
    throw error;
  }
}

export function createDefaultManualCandidateGateTarget(): GateEvaluationTarget {
  return defaultGateTarget();
}

export function createDarkRunDiagnosticsBaselineFromPacket(
  packet: EvidencePacket
): DarkRunDiagnostics {
  return createDarkRunDiagnosticsFromPacket(packet);
}
