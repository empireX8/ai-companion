import {
  CandidateLifecycleStatus,
  InvestigationSeedType,
  InvestigationStatus,
  InvestigationVisibility,
  Prisma,
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
import type { StructuredInvestigationCandidateProposal } from "./investigation-candidate-proposal";
import { usesInvestigationCandidateSafeWording } from "./investigation-candidate-proposal";
import type { DarkRunDiagnostics, EvidencePacket, EvidencePacketMetrics } from "./types";
import {
  applyPersistableEvidenceLinkPolicyChecks,
  buildPersistableEvidenceLinksFromPacket,
  curatePersistableEvidenceLinksForCandidate,
  type UserMapCandidateEvidenceSelection,
} from "./user-map-candidate-persistence";

const DEFAULT_PROCESSOR_VERSION = "understanding-dark-engine-v1";
const TITLE_MAX_LENGTH = 120;
const ORGANIZING_QUESTION_MAX_LENGTH = 240;
const SUMMARY_MAX_LENGTH = 600;

type InvestigationPersistenceDb = PrismaClient &
  NonNullable<AssembleEvidencePacketInput["db"]> &
  UnderstandingEvidenceLinkWriterDb & {
    investigation: {
      findMany: (args: unknown) => Promise<
        Array<{ id: string; title: string; organizingQuestion: string }>
      >;
      create: (args: unknown) => Promise<{ id: string }>;
    };
  };

export type PersistInternalInvestigationCandidateInput = {
  userId: string;
  proposal: StructuredInvestigationCandidateProposal;
  db?: InvestigationPersistenceDb;
  now?: Date;
  windowDays?: number;
  processorVersion?: string;
  packet?: EvidencePacket;
};

export type InvestigationCandidatePersistencePayload = {
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
  persistedInvestigationId: string | null;
  dryRunOnly: false;
  candidateWritesEnabled: true;
  evidenceLinkWritesEnabled: true;
};

export type PersistInternalInvestigationCandidateResult = {
  runId: string;
  artifactId: string;
  artifactType: string;
  processorVersion: string;
  runCreatedAt: string;
  persistedAt: string;
  diagnostics: DarkRunDiagnostics;
  payload: InvestigationCandidatePersistencePayload;
  persistedInvestigationId: string | null;
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
      blockedReason: "INVESTIGATION_WRITE_FAILED",
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

function isInvestigationSeedType(value: string): value is InvestigationSeedType {
  return Object.values(InvestigationSeedType).includes(value as InvestigationSeedType);
}

export async function persistInternalInvestigationCandidate(
  input: PersistInternalInvestigationCandidateInput
): Promise<PersistInternalInvestigationCandidateResult> {
  const db = (input.db ?? prismadb) as unknown as InvestigationPersistenceDb;
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
  if (proposal.abstainReasons.length > 0) {
    diagnostics.abstentions = proposal.abstainReasons.length;
    incrementRejectionReasonCounts(diagnostics, proposal.abstainReasons);
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
    let persistedInvestigationId: string | null = null;
    let createdCandidate = false;
    let transactionFailure: TransactionPersistenceFailureClassification | null =
      null;
    let transactionFailureEvidenceLinksAttempted: number | null = null;

    const title = proposal.title.trim();
    const organizingQuestion = proposal.organizingQuestion.trim();
    const summary = proposal.summary.trim();

    if (!title) {
      addBlockedReason(blockedWriteReasons, "MISSING_TITLE");
    }
    if (!organizingQuestion) {
      addBlockedReason(blockedWriteReasons, "MISSING_ORGANIZING_QUESTION");
    }
    if (!summary) {
      addBlockedReason(blockedWriteReasons, "MISSING_SUMMARY");
    }
    if (title.length > TITLE_MAX_LENGTH) {
      addBlockedReason(blockedWriteReasons, "TITLE_TOO_LONG");
    }
    if (organizingQuestion.length > ORGANIZING_QUESTION_MAX_LENGTH) {
      addBlockedReason(blockedWriteReasons, "ORGANIZING_QUESTION_TOO_LONG");
    }
    if (summary.length > SUMMARY_MAX_LENGTH) {
      addBlockedReason(blockedWriteReasons, "SUMMARY_TOO_LONG");
    }
    if (!isInvestigationSeedType(proposal.seedType)) {
      addBlockedReason(blockedWriteReasons, "MISSING_SEED_TYPE");
    }
    if (!usesInvestigationCandidateSafeWording(proposal)) {
      addBlockedReason(blockedWriteReasons, "UNSAFE_INVESTIGATION_WORDING");
    }
    if (organizingQuestion && !organizingQuestion.endsWith("?")) {
      addBlockedReason(blockedWriteReasons, "ORGANIZING_QUESTION_NOT_A_QUESTION");
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
      const normalizedTitle = normalizeForDedupe(title);
      const normalizedOrganizingQuestion = normalizeForDedupe(organizingQuestion);

      try {
        await db.$transaction(async (tx) => {
          const transactionalDb = tx as unknown as InvestigationPersistenceDb;

          const existingInternalCandidates =
            await transactionalDb.investigation.findMany({
              where: {
                userId: input.userId,
                visibility: InvestigationVisibility.internal_only,
                candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
              },
              select: {
                id: true,
                title: true,
                organizingQuestion: true,
              },
            });

          const duplicate = existingInternalCandidates.find(
            (row) =>
              normalizeForDedupe(row.title) === normalizedTitle &&
              normalizeForDedupe(row.organizingQuestion) ===
                normalizedOrganizingQuestion
          );

          if (duplicate) {
            duplicateCandidates += 1;
            addBlockedReason(blockedWriteReasons, "DUPLICATE_CANDIDATE");
            persistedInvestigationId = duplicate.id;
            return;
          }

          const created = await transactionalDb.investigation.create({
            data: {
              userId: input.userId,
              title: truncateText(title, TITLE_MAX_LENGTH),
              organizingQuestion: truncateText(
                organizingQuestion,
                ORGANIZING_QUESTION_MAX_LENGTH
              ),
              status: InvestigationStatus.open,
              visibility: InvestigationVisibility.internal_only,
              candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
              seedType: proposal.seedType,
              competingTheories: [],
              evidenceNeeded: [truncateText(summary, SUMMARY_MAX_LENGTH)],
            },
            select: { id: true },
          });

          persistedInvestigationId = created.id;
          createdCandidate = true;

          const targetType = "investigation" as const;

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
        persistedInvestigationId = null;

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
    if (persistedInvestigationId) {
      notes.push(`persistedInvestigationId:${persistedInvestigationId}`);
    }
    notes.push(`evidenceLinksSelectedBeforeCap:${evidenceLinksSelectedBeforeCap}`);
    notes.push(`evidenceLinksSelectedAfterCap:${evidenceLinksSelectedAfterCap}`);
    notes.push(`evidenceLinkCapApplied:${evidenceLinkCapApplied ? "true" : "false"}`);
    notes.push(`evidenceLinkCapLimit:${evidenceLinkCapLimit}`);

    const payload: InvestigationCandidatePersistencePayload = {
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
      persistedInvestigationId,
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
      persistedInvestigationId,
    };
  } catch (error) {
    await failDerivationRun(run.id, db).catch(() => {
      // best-effort failure transition
    });
    throw error;
  }
}
