import {
  ModelUpdateVisibility,
  Prisma,
  UnderstandingLinkTargetType,
  type PrismaClient,
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
  UnderstandingEvidenceLinkDuplicateError,
  UnderstandingEvidenceLinkValidationError,
  createUnderstandingEvidenceLinkForUser,
  verifyUnderstandingEvidenceLinkTargetOwnership,
  type UnderstandingEvidenceLinkWriteInput,
  type UnderstandingEvidenceLinkWriterDb,
} from "../understanding-evidence-link-writer";
import {
  createDarkRunDiagnosticsFromPacket,
  incrementRejectionReasonCounts,
} from "./diagnostics";
import {
  assembleEvidencePacketV1,
  type AssembleEvidencePacketInput,
} from "./evidence-packet";
import type { StructuredModelUpdateCandidateProposal } from "./model-update-candidate-proposal";
import { usesModelUpdateCandidateSafeWording } from "./model-update-candidate-proposal";
import type { RejectionReasonCode } from "./constants";
import type { DarkRunDiagnostics, EvidencePacket, EvidencePacketMetrics } from "./types";
import {
  applyPersistableEvidenceLinkPolicyChecks,
  buildPersistableEvidenceLinksFromPacket,
  curatePersistableEvidenceLinksForCandidate,
} from "./user-map-candidate-persistence";

const DEFAULT_PROCESSOR_VERSION = "understanding-dark-engine-v1";
const USER_FACING_SUMMARY_MAX_LENGTH = 600;

type ModelUpdatePersistenceDb = PrismaClient &
  NonNullable<AssembleEvidencePacketInput["db"]> &
  UnderstandingEvidenceLinkWriterDb & {
    modelUpdate: {
      findMany: (args: unknown) => Promise<
        Array<{
          id: string;
          userFacingSummary: string;
          affectedObjectType: string;
          affectedObjectId: string;
        }>
      >;
      create: (args: unknown) => Promise<{ id: string }>;
    };
  };

export type PersistInternalModelUpdateCandidateInput = {
  userId: string;
  proposal: StructuredModelUpdateCandidateProposal;
  db?: ModelUpdatePersistenceDb;
  now?: Date;
  windowDays?: number;
  processorVersion?: string;
  packet?: EvidencePacket;
  abstainReasons?: RejectionReasonCode[];
};

export type ModelUpdateCandidatePersistencePayload = {
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
  evidenceLinksSelectedBeforeCap: number;
  evidenceLinksSelectedAfterCap: number;
  evidenceLinkCapApplied: boolean;
  evidenceLinkCapLimit: number;
  blockedWriteReasons: string[];
  transactionFailureErrorName: string | null;
  transactionFailureErrorMessage: string | null;
  transactionFailurePrismaCode: string | null;
  transactionFailureBeforeAnyLinkAttempt: boolean | null;
  transactionFailureEvidenceLinksAttempted: number | null;
  duplicateCandidates: number;
  rollbackCount: number;
  persistedModelUpdateId: string | null;
  dryRunOnly: false;
  candidateWritesEnabled: true;
  evidenceLinkWritesEnabled: true;
};

export type PersistInternalModelUpdateCandidateResult = {
  runId: string;
  artifactId: string;
  artifactType: string;
  processorVersion: string;
  runCreatedAt: string;
  persistedAt: string;
  diagnostics: DarkRunDiagnostics;
  payload: ModelUpdateCandidatePersistencePayload;
  persistedModelUpdateId: string | null;
};

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

const TRANSACTION_FAILURE_NOTE_MESSAGE_MAX_LENGTH = 500;

type TransactionPersistenceFailureClassification = {
  blockedReason: string;
  errorName: string;
  errorMessage: string;
  prismaCode: string | null;
  beforeAnyLinkAttempt: boolean;
};

function sanitizeTransactionFailureNoteValue(value: string): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= TRANSACTION_FAILURE_NOTE_MESSAGE_MAX_LENGTH) {
    return collapsed;
  }
  return collapsed.slice(0, TRANSACTION_FAILURE_NOTE_MESSAGE_MAX_LENGTH);
}

function classifyTransactionPersistenceFailure(
  error: unknown,
  evidenceLinksAttemptedAtFailure: number
): TransactionPersistenceFailureClassification {
  const errorName = error instanceof Error ? error.name : "UnknownError";
  const errorMessage =
    error instanceof Error ? error.message : String(error);
  const prismaCode =
    error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null;
  const beforeAnyLinkAttempt = evidenceLinksAttemptedAtFailure === 0;

  if (error instanceof UnderstandingEvidenceLinkValidationError) {
    return {
      blockedReason: "UNRESOLVED_OWNERSHIP",
      errorName,
      errorMessage,
      prismaCode,
      beforeAnyLinkAttempt,
    };
  }

  if (error instanceof UnderstandingEvidenceLinkDuplicateError) {
    return {
      blockedReason: "EVIDENCE_LINK_DUPLICATE",
      errorName,
      errorMessage,
      prismaCode,
      beforeAnyLinkAttempt,
    };
  }

  if (beforeAnyLinkAttempt) {
    return {
      blockedReason: "MODEL_UPDATE_WRITE_FAILED",
      errorName,
      errorMessage,
      prismaCode,
      beforeAnyLinkAttempt: true,
    };
  }

  return {
    blockedReason: "LINK_WRITE_FAILED",
    errorName,
    errorMessage,
    prismaCode,
    beforeAnyLinkAttempt: false,
  };
}

function appendTransactionFailureDiagnostics(args: {
  notes: string[];
  failure: TransactionPersistenceFailureClassification;
  evidenceLinksAttemptedAtFailure: number;
}): void {
  const { failure, evidenceLinksAttemptedAtFailure, notes } = args;

  notes.push(`transactionFailureErrorName:${failure.errorName}`);
  notes.push(
    `transactionFailureErrorMessage:${sanitizeTransactionFailureNoteValue(failure.errorMessage)}`
  );
  if (failure.prismaCode) {
    notes.push(`transactionFailurePrismaCode:${failure.prismaCode}`);
  }
  notes.push(
    `transactionFailureBeforeAnyLinkAttempt:${failure.beforeAnyLinkAttempt ? "true" : "false"}`
  );
  notes.push(
    `transactionFailureEvidenceLinksAttempted:${evidenceLinksAttemptedAtFailure}`
  );
}

function isUnderstandingLinkTargetType(
  value: string
): value is UnderstandingLinkTargetType {
  return Object.values(UnderstandingLinkTargetType).includes(
    value as UnderstandingLinkTargetType
  );
}

export async function persistInternalModelUpdateCandidate(
  input: PersistInternalModelUpdateCandidateInput
): Promise<PersistInternalModelUpdateCandidateResult> {
  const db = (input.db ?? prismadb) as unknown as ModelUpdatePersistenceDb;
  const now = input.now ?? new Date();
  const processorVersion = input.processorVersion ?? DEFAULT_PROCESSOR_VERSION;
  const proposal = input.proposal;

  const packet =
    input.packet ??
    (await assembleEvidencePacketV1({
      userId: input.userId,
      now,
      windowDays: input.windowDays,
      db,
    }));

  const diagnostics = createDarkRunDiagnosticsFromPacket(packet);
  diagnostics.candidatesProposed += 1;
  const abstainReasons = input.abstainReasons ?? [];
  if (abstainReasons.length > 0) {
    diagnostics.abstentions = abstainReasons.length;
    incrementRejectionReasonCounts(diagnostics, abstainReasons);
  }

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
    let persistedModelUpdateId: string | null = null;
    let createdCandidate = false;
    let transactionFailure: TransactionPersistenceFailureClassification | null =
      null;
    let transactionFailureEvidenceLinksAttempted: number | null = null;

    const userFacingSummary = proposal.userFacingSummary.trim();
    const affectedObjectType = proposal.affectedObjectType;
    const affectedObjectId = proposal.affectedObjectId.trim();

    if (!userFacingSummary) {
      addBlockedReason(blockedWriteReasons, "MISSING_USER_FACING_SUMMARY");
    }
    if (!affectedObjectId) {
      addBlockedReason(blockedWriteReasons, "MISSING_AFFECTED_OBJECT_ID");
    }
    if (!isUnderstandingLinkTargetType(affectedObjectType)) {
      addBlockedReason(blockedWriteReasons, "MISSING_AFFECTED_OBJECT_TYPE");
    }
    if (userFacingSummary.length > USER_FACING_SUMMARY_MAX_LENGTH) {
      addBlockedReason(blockedWriteReasons, "USER_FACING_SUMMARY_TOO_LONG");
    }
    if (!usesModelUpdateCandidateSafeWording(proposal)) {
      addBlockedReason(blockedWriteReasons, "UNSAFE_MODEL_UPDATE_WORDING");
    }

    if (
      blockedWriteReasons.length === 0 &&
      isUnderstandingLinkTargetType(affectedObjectType)
    ) {
      const affectedObjectOwned = await verifyUnderstandingEvidenceLinkTargetOwnership({
        userId: input.userId,
        targetType: affectedObjectType,
        targetId: affectedObjectId,
        db,
      });
      if (!affectedObjectOwned) {
        addBlockedReason(blockedWriteReasons, "UNRESOLVED_AFFECTED_OBJECT_OWNERSHIP");
      }
    }

    const builtLinks = buildPersistableEvidenceLinksFromPacket({
      packet,
      evidenceSelections: proposal.evidenceSelections,
      blockedWriteReasons,
    });

    const curatedLinks = curatePersistableEvidenceLinksForCandidate(builtLinks);
    const links = curatedLinks.links;
    const evidenceLinksSelectedBeforeCap = curatedLinks.selectedBeforeCap;
    const evidenceLinksSelectedAfterCap = curatedLinks.selectedAfterCap;
    const evidenceLinkCapApplied = curatedLinks.capApplied;
    const evidenceLinkCapLimit = curatedLinks.capLimit;

    applyPersistableEvidenceLinkPolicyChecks({
      links,
      blockedWriteReasons,
    });

    if (blockedWriteReasons.length === 0) {
      const normalizedSummary = normalizeForDedupe(userFacingSummary);
      const normalizedAffectedObjectId = normalizeForDedupe(affectedObjectId);

      try {
        await db.$transaction(async (tx) => {
          const transactionalDb = tx as unknown as ModelUpdatePersistenceDb;

          // Duplicate lookup stays inside the transaction; no DB uniqueness in this slice.
          const existingInternalCandidates =
            await transactionalDb.modelUpdate.findMany({
              where: {
                userId: input.userId,
                visibility: ModelUpdateVisibility.internal_only,
              },
              select: {
                id: true,
                userFacingSummary: true,
                affectedObjectType: true,
                affectedObjectId: true,
              },
            });

          const duplicate = existingInternalCandidates.find(
            (row) =>
              normalizeForDedupe(row.userFacingSummary) === normalizedSummary &&
              row.affectedObjectType === affectedObjectType &&
              normalizeForDedupe(row.affectedObjectId) === normalizedAffectedObjectId
          );

          if (duplicate) {
            duplicateCandidates += 1;
            addBlockedReason(blockedWriteReasons, "DUPLICATE_CANDIDATE");
            persistedModelUpdateId = duplicate.id;
            return;
          }

          const created = await transactionalDb.modelUpdate.create({
            data: {
              userId: input.userId,
              updateType: proposal.updateType,
              visibility: ModelUpdateVisibility.internal_only,
              affectedObjectType,
              affectedObjectId,
              userFacingSummary: truncateText(
                userFacingSummary,
                USER_FACING_SUMMARY_MAX_LENGTH
              ),
              isMeaningful: false,
              sourceRunId: run.id,
              internalNotes: `candidateLane:internal_only;processorVersion:${processorVersion}`,
            },
            select: { id: true },
          });

          persistedModelUpdateId = created.id;
          createdCandidate = true;

          const targetType = UnderstandingLinkTargetType.model_update;

          for (const link of links) {
            evidenceLinksAttempted += 1;
            const linkInput: UnderstandingEvidenceLinkWriteInput = {
              targetType,
              targetId: created.id,
              sourceType: link.sourceType,
              sourceId: link.sourceId,
              role: link.role,
              summary: link.summary,
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
        const evidenceLinksAttemptedAtFailure = evidenceLinksAttempted;
        const failure = classifyTransactionPersistenceFailure(
          error,
          evidenceLinksAttemptedAtFailure
        );

        rollbackCount += 1;
        evidenceLinksWritten = 0;
        createdCandidate = false;
        addBlockedReason(blockedWriteReasons, failure.blockedReason);
        persistedModelUpdateId = null;

        transactionFailure = failure;
        transactionFailureEvidenceLinksAttempted = evidenceLinksAttemptedAtFailure;
      }
    }

    if (createdCandidate) {
      diagnostics.candidatesWritten += 1;
    }

    persistedAt = new Date();
    const notes = [...diagnostics.notes];
    if (blockedWriteReasons.length > 0) {
      notes.push(`blockedWriteReasons:${blockedWriteReasons.join(",")}`);
    }
    if (transactionFailure) {
      appendTransactionFailureDiagnostics({
        notes,
        failure: transactionFailure,
        evidenceLinksAttemptedAtFailure: transactionFailureEvidenceLinksAttempted ?? 0,
      });
    }
    if (persistedModelUpdateId) {
      notes.push(`persistedModelUpdateId:${persistedModelUpdateId}`);
    }
    notes.push(`evidenceLinksSelectedBeforeCap:${evidenceLinksSelectedBeforeCap}`);
    notes.push(`evidenceLinksSelectedAfterCap:${evidenceLinksSelectedAfterCap}`);
    notes.push(`evidenceLinkCapApplied:${evidenceLinkCapApplied ? "true" : "false"}`);
    notes.push(`evidenceLinkCapLimit:${evidenceLinkCapLimit}`);

    const payload: ModelUpdateCandidatePersistencePayload = {
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
      warnings: [],
      notes,
      evidenceLinksAttempted,
      evidenceLinksWritten,
      evidenceLinksSelectedBeforeCap,
      evidenceLinksSelectedAfterCap,
      evidenceLinkCapApplied,
      evidenceLinkCapLimit,
      blockedWriteReasons,
      transactionFailureErrorName: transactionFailure?.errorName ?? null,
      transactionFailureErrorMessage: transactionFailure?.errorMessage ?? null,
      transactionFailurePrismaCode: transactionFailure?.prismaCode ?? null,
      transactionFailureBeforeAnyLinkAttempt:
        transactionFailure?.beforeAnyLinkAttempt ?? null,
      transactionFailureEvidenceLinksAttempted,
      duplicateCandidates,
      rollbackCount,
      persistedModelUpdateId,
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
        confidenceScore: undefined,
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
      persistedModelUpdateId,
    };
  } catch (error) {
    await failDerivationRun(run.id, db).catch(() => {
      // best-effort failure transition
    });
    throw error;
  }
}
