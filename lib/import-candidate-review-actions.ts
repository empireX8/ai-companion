/**
 * Persisted accept/reject + accepted-candidate materialisation for import review.
 *
 * Accept destinations (truthful, no PatternClaim forcing):
 * - ReferenceItem → status active (the typed model object). ModelUpdate cannot
 *   target reference_item under UnderstandingLinkTargetType — gap recorded.
 * - ContradictionNode → status open + optional UEL lineage + ModelUpdate when
 *   no prior MU exists for that node.
 *
 * Reject:
 * - ReferenceItem → dismissed (record preserved)
 * - ContradictionNode → archived_tension (record preserved)
 *
 * Never mutates PatternClaim / existing import-linked UserMap / ModelUpdate rows
 * except creating a new MU for a newly accepted contradiction when schema allows.
 */

import {
  type PrismaClient,
  ModelUpdateType,
  ModelUpdateVisibility,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
} from "@prisma/client";

import prismadb from "./prismadb";
import {
  encodeImportCandidateReviewKey,
  parseImportCandidateReviewKey,
  type ImportCandidateKey,
} from "./import-candidate-review-query";
import {
  createUnderstandingEvidenceLinkForUser,
  UnderstandingEvidenceLinkDuplicateError,
  UnderstandingEvidenceLinkValidationError,
  type UnderstandingEvidenceLinkWriterDb,
} from "./understanding-evidence-link-writer";

export class ImportCandidateReviewError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus = 400) {
    super(message);
    this.name = "ImportCandidateReviewError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export type ImportCandidateDecision = "accept" | "reject";

export type ImportCandidateMaterialisationGap = {
  code: string;
  detail: string;
};

export type ImportCandidateReviewResult = {
  decision: ImportCandidateDecision;
  reviewKey: string;
  sourceTable: "ReferenceItem" | "ContradictionNode";
  candidateId: string;
  previousStatus: string;
  nextStatus: string;
  reviewedAt: string;
  idempotent: boolean;
  alreadyMaterialised: boolean;
  materialisation: {
    typedObjectCreated: boolean;
    typedObjectType: string;
    typedObjectId: string;
    evidenceLinksCreated: number;
    modelUpdateId: string | null;
    gaps: ImportCandidateMaterialisationGap[];
  } | null;
};

type ReviewDb = PrismaClient;
type ReviewTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

async function assertImportDerivedCandidate(
  db: ReviewDb | ReviewTx,
  key: ImportCandidateKey,
  userId: string,
): Promise<{
  status: string;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
  title: string;
  summary: string;
}> {
  if (key.sourceTable === "ReferenceItem") {
    const row = await db.referenceItem.findFirst({
      where: { id: key.id, userId },
      select: {
        id: true,
        status: true,
        statement: true,
        sourceSessionId: true,
        sourceMessageId: true,
        sourceSession: { select: { origin: true } },
      },
    });
    if (!row) {
      throw new ImportCandidateReviewError(
        "CANDIDATE_NOT_FOUND",
        "Import candidate not found",
        404,
      );
    }
    if (row.sourceSession?.origin !== "IMPORTED_ARCHIVE") {
      throw new ImportCandidateReviewError(
        "NOT_IMPORT_DERIVED",
        "Candidate is not import-derived",
        403,
      );
    }
    return {
      status: row.status,
      sourceSessionId: row.sourceSessionId,
      sourceMessageId: row.sourceMessageId,
      title: row.statement,
      summary: row.statement,
    };
  }

  const row = await db.contradictionNode.findFirst({
    where: { id: key.id, userId },
    select: {
      id: true,
      status: true,
      title: true,
      sideA: true,
      sideB: true,
      sourceSessionId: true,
      sourceMessageId: true,
      sourceSession: { select: { origin: true } },
    },
  });
  if (!row) {
    throw new ImportCandidateReviewError(
      "CANDIDATE_NOT_FOUND",
      "Import candidate not found",
      404,
    );
  }
  if (row.sourceSession?.origin !== "IMPORTED_ARCHIVE") {
    throw new ImportCandidateReviewError(
      "NOT_IMPORT_DERIVED",
      "Candidate is not import-derived",
      403,
    );
  }
  return {
    status: row.status,
    sourceSessionId: row.sourceSessionId,
    sourceMessageId: row.sourceMessageId,
    title: row.title,
    summary: `${row.sideA} ↔ ${row.sideB}`,
  };
}

async function resolveImportBatchId(
  db: ReviewDb | ReviewTx,
  userId: string,
): Promise<string | null> {
  const batches = await db.importUploadSession.findMany({
    where: { userId, status: "complete" },
    select: { id: true },
    orderBy: { createdAt: "desc" },
    take: 2,
  });
  return batches.length === 1 ? batches[0]!.id : batches[0]?.id ?? null;
}

async function linkSourceIfPossible(args: {
  userId: string;
  targetId: string;
  sourceType: UnderstandingLinkSourceType;
  sourceId: string;
  role: UnderstandingLinkRole;
  summary: string;
  db: UnderstandingEvidenceLinkWriterDb;
}): Promise<"created" | "duplicate" | "skipped"> {
  try {
    await createUnderstandingEvidenceLinkForUser({
      userId: args.userId,
      input: {
        targetType: UnderstandingLinkTargetType.contradiction_node,
        targetId: args.targetId,
        sourceType: args.sourceType,
        sourceId: args.sourceId,
        role: args.role,
        summary: args.summary,
      },
      db: args.db,
    });
    return "created";
  } catch (error) {
    if (error instanceof UnderstandingEvidenceLinkDuplicateError) {
      return "duplicate";
    }
    if (error instanceof UnderstandingEvidenceLinkValidationError) {
      return "skipped";
    }
    throw error;
  }
}

async function materialiseAcceptedReference(args: {
  userId: string;
  candidateId: string;
  previousStatus: string;
  db: ReviewDb | ReviewTx;
}): Promise<ImportCandidateReviewResult["materialisation"]> {
  const gaps: ImportCandidateMaterialisationGap[] = [
    {
      code: "MODEL_UPDATE_TARGET_UNSUPPORTED",
      detail:
        "ModelUpdate.affectedObjectType cannot target reference_item; acceptance persists ReferenceItem.status=active without a ModelUpdate row.",
    },
    {
      code: "UEL_TARGET_UNSUPPORTED",
      detail:
        "UnderstandingEvidenceLink cannot target reference_item; lineage remains via sourceSessionId/sourceMessageId FKs.",
    },
  ];

  if (args.previousStatus === "active") {
    return {
      typedObjectCreated: false,
      typedObjectType: "ReferenceItem",
      typedObjectId: args.candidateId,
      evidenceLinksCreated: 0,
      modelUpdateId: null,
      gaps,
    };
  }

  await args.db.referenceItem.update({
    where: { id: args.candidateId },
    data: { status: "active" },
  });

  return {
    typedObjectCreated: true,
    typedObjectType: "ReferenceItem",
    typedObjectId: args.candidateId,
    evidenceLinksCreated: 0,
    modelUpdateId: null,
    gaps,
  };
}

async function materialiseAcceptedContradiction(args: {
  userId: string;
  candidateId: string;
  previousStatus: string;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
  title: string;
  summary: string;
  db: ReviewDb | ReviewTx;
}): Promise<ImportCandidateReviewResult["materialisation"]> {
  const gaps: ImportCandidateMaterialisationGap[] = [];
  let evidenceLinksCreated = 0;

  if (args.previousStatus !== "open") {
    await args.db.contradictionNode.update({
      where: { id: args.candidateId },
      data: { status: "open", lastTouchedAt: new Date() },
    });
  }

  const writerDb = args.db as unknown as UnderstandingEvidenceLinkWriterDb;

  if (args.sourceMessageId) {
    const created = await linkSourceIfPossible({
      userId: args.userId,
      targetId: args.candidateId,
      sourceType: UnderstandingLinkSourceType.message,
      sourceId: args.sourceMessageId,
      role: UnderstandingLinkRole.supports,
      summary: "Import candidate acceptance — source message",
      db: writerDb,
    });
    if (created === "created") evidenceLinksCreated += 1;

    const spans = await args.db.evidenceSpan.findMany({
      where: { userId: args.userId, messageId: args.sourceMessageId },
      select: { id: true },
      take: 5,
      orderBy: { createdAt: "asc" },
    });
    for (const span of spans) {
      const linked = await linkSourceIfPossible({
        userId: args.userId,
        targetId: args.candidateId,
        sourceType: UnderstandingLinkSourceType.evidence_span,
        sourceId: span.id,
        role: UnderstandingLinkRole.supports,
        summary: "Import candidate acceptance — evidence span",
        db: writerDb,
      });
      if (linked === "created") evidenceLinksCreated += 1;
    }
  }

  if (args.sourceSessionId) {
    const created = await linkSourceIfPossible({
      userId: args.userId,
      targetId: args.candidateId,
      sourceType: UnderstandingLinkSourceType.session,
      sourceId: args.sourceSessionId,
      role: UnderstandingLinkRole.context,
      summary: "Import candidate acceptance — source conversation",
      db: writerDb,
    });
    if (created === "created") evidenceLinksCreated += 1;
  }

  const batchId = await resolveImportBatchId(args.db, args.userId);
  if (batchId) {
    const created = await linkSourceIfPossible({
      userId: args.userId,
      targetId: args.candidateId,
      sourceType: UnderstandingLinkSourceType.import_record,
      sourceId: batchId,
      role: UnderstandingLinkRole.context,
      summary: "Import candidate acceptance — import batch",
      db: writerDb,
    });
    if (created === "created") evidenceLinksCreated += 1;
  } else {
    gaps.push({
      code: "IMPORT_BATCH_LINK_UNAVAILABLE",
      detail:
        "No completed ImportUploadSession found to attach as import_record lineage.",
    });
  }

  const existingMu = await args.db.modelUpdate.findFirst({
    where: {
      userId: args.userId,
      affectedObjectType: UnderstandingLinkTargetType.contradiction_node,
      affectedObjectId: args.candidateId,
    },
    select: { id: true },
  });

  let modelUpdateId: string | null = existingMu?.id ?? null;
  if (!existingMu && args.previousStatus !== "open") {
    // Narrowest truthful MU type available: tension entered the linked model graph.
    const created = await args.db.modelUpdate.create({
      data: {
        userId: args.userId,
        updateType: ModelUpdateType.link_detected,
        visibility: ModelUpdateVisibility.user_visible,
        affectedObjectType: UnderstandingLinkTargetType.contradiction_node,
        affectedObjectId: args.candidateId,
        userFacingSummary: `Accepted import tension: ${args.title}`.slice(0, 500),
        isMeaningful: true,
        beforeSummary: "candidate",
        afterSummary: args.summary.slice(0, 500),
        internalNotes:
          "Created by import-candidate-review accept path; ModelUpdateType.link_detected is the narrowest existing enum for contradiction acceptance (no contradiction_opened type).",
      },
      select: { id: true },
    });
    modelUpdateId = created.id;
    gaps.push({
      code: "MODEL_UPDATE_TYPE_NARROWEST_DEFENSIBLE",
      detail:
        "No ModelUpdateType for contradiction acceptance; used link_detected with explicit internalNotes.",
    });
  }

  return {
    typedObjectCreated: args.previousStatus !== "open",
    typedObjectType: "ContradictionNode",
    typedObjectId: args.candidateId,
    evidenceLinksCreated,
    modelUpdateId,
    gaps,
  };
}

export async function decideImportCandidate(args: {
  userId: string;
  reviewKey: string;
  decision: ImportCandidateDecision;
  db?: PrismaClient;
}): Promise<ImportCandidateReviewResult> {
  const db = args.db ?? prismadb;
  const key = parseImportCandidateReviewKey(args.reviewKey);
  if (!key) {
    throw new ImportCandidateReviewError(
      "INVALID_REVIEW_KEY",
      "Invalid import candidate review key",
      400,
    );
  }

  return db.$transaction(async (tx) => {
    const existing = await assertImportDerivedCandidate(tx, key, args.userId);
    const reviewedAt = new Date();
    const reviewKey = encodeImportCandidateReviewKey(key);

    if (args.decision === "reject") {
      if (key.sourceTable === "ReferenceItem") {
        if (existing.status === "dismissed") {
          return {
            decision: "reject" as const,
            reviewKey,
            sourceTable: key.sourceTable,
            candidateId: key.id,
            previousStatus: existing.status,
            nextStatus: "dismissed",
            reviewedAt: reviewedAt.toISOString(),
            idempotent: true,
            alreadyMaterialised: false,
            materialisation: null,
          };
        }
        if (existing.status !== "candidate") {
          throw new ImportCandidateReviewError(
            "INVALID_STATUS_FOR_REJECT",
            `Reject requires status=candidate, got ${existing.status}`,
            422,
          );
        }
        await tx.referenceItem.update({
          where: { id: key.id },
          data: { status: "dismissed" },
        });
        return {
          decision: "reject" as const,
          reviewKey,
          sourceTable: key.sourceTable,
          candidateId: key.id,
          previousStatus: existing.status,
          nextStatus: "dismissed",
          reviewedAt: reviewedAt.toISOString(),
          idempotent: false,
          alreadyMaterialised: false,
          materialisation: null,
        };
      }

      if (existing.status === "archived_tension") {
        return {
          decision: "reject" as const,
          reviewKey,
          sourceTable: key.sourceTable,
          candidateId: key.id,
          previousStatus: existing.status,
          nextStatus: "archived_tension",
          reviewedAt: reviewedAt.toISOString(),
          idempotent: true,
          alreadyMaterialised: false,
          materialisation: null,
        };
      }
      if (existing.status !== "candidate") {
        throw new ImportCandidateReviewError(
          "INVALID_STATUS_FOR_REJECT",
          `Reject requires status=candidate, got ${existing.status}`,
          422,
        );
      }
      await tx.contradictionNode.update({
        where: { id: key.id },
        data: { status: "archived_tension", lastTouchedAt: reviewedAt },
      });
      return {
        decision: "reject" as const,
        reviewKey,
        sourceTable: key.sourceTable,
        candidateId: key.id,
        previousStatus: existing.status,
        nextStatus: "archived_tension",
        reviewedAt: reviewedAt.toISOString(),
        idempotent: false,
        alreadyMaterialised: false,
        materialisation: null,
      };
    }

    // accept
    if (key.sourceTable === "ReferenceItem") {
      if (existing.status === "active") {
        const materialisation = await materialiseAcceptedReference({
          userId: args.userId,
          candidateId: key.id,
          previousStatus: "active",
          db: tx,
        });
        return {
          decision: "accept" as const,
          reviewKey,
          sourceTable: key.sourceTable,
          candidateId: key.id,
          previousStatus: "active",
          nextStatus: "active",
          reviewedAt: reviewedAt.toISOString(),
          idempotent: true,
          alreadyMaterialised: true,
          materialisation,
        };
      }
      if (existing.status !== "candidate") {
        throw new ImportCandidateReviewError(
          "INVALID_STATUS_FOR_ACCEPT",
          `Accept requires status=candidate, got ${existing.status}`,
          422,
        );
      }
      const materialisation = await materialiseAcceptedReference({
        userId: args.userId,
        candidateId: key.id,
        previousStatus: existing.status,
        db: tx,
      });
      return {
        decision: "accept" as const,
        reviewKey,
        sourceTable: key.sourceTable,
        candidateId: key.id,
        previousStatus: existing.status,
        nextStatus: "active",
        reviewedAt: reviewedAt.toISOString(),
        idempotent: false,
        alreadyMaterialised: false,
        materialisation,
      };
    }

    if (existing.status === "open") {
      const materialisation = await materialiseAcceptedContradiction({
        userId: args.userId,
        candidateId: key.id,
        previousStatus: "open",
        sourceSessionId: existing.sourceSessionId,
        sourceMessageId: existing.sourceMessageId,
        title: existing.title,
        summary: existing.summary,
        db: tx,
      });
      return {
        decision: "accept" as const,
        reviewKey,
        sourceTable: key.sourceTable,
        candidateId: key.id,
        previousStatus: "open",
        nextStatus: "open",
        reviewedAt: reviewedAt.toISOString(),
        idempotent: true,
        alreadyMaterialised: true,
        materialisation,
      };
    }
    if (existing.status !== "candidate") {
      throw new ImportCandidateReviewError(
        "INVALID_STATUS_FOR_ACCEPT",
        `Accept requires status=candidate, got ${existing.status}`,
        422,
      );
    }

    const materialisation = await materialiseAcceptedContradiction({
      userId: args.userId,
      candidateId: key.id,
      previousStatus: existing.status,
      sourceSessionId: existing.sourceSessionId,
      sourceMessageId: existing.sourceMessageId,
      title: existing.title,
      summary: existing.summary,
      db: tx,
    });

    return {
      decision: "accept" as const,
      reviewKey,
      sourceTable: key.sourceTable,
      candidateId: key.id,
      previousStatus: existing.status,
      nextStatus: "open",
      reviewedAt: reviewedAt.toISOString(),
      idempotent: false,
      alreadyMaterialised: false,
      materialisation,
    };
  });
}
