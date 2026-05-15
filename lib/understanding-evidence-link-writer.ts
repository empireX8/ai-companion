import {
  Prisma,
  type PrismaClient,
  type UnderstandingLinkRole,
  type UnderstandingLinkSourceType,
  type UnderstandingLinkTargetType,
} from "@prisma/client";

import prismadb from "./prismadb";

export type UnderstandingEvidenceLinkWriteInput = {
  targetType: UnderstandingLinkTargetType;
  targetId: string;
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

type EntityLookupModel = {
  findFirst: (args: unknown) => Promise<{ id: string } | null>;
};

export type UnderstandingEvidenceLinkWriterDb = Pick<
  PrismaClient,
  "understandingEvidenceLink"
> & {
  userMapConclusion: EntityLookupModel;
  investigation: EntityLookupModel;
  modelUpdate: EntityLookupModel;
  fieldworkAssignment: EntityLookupModel;
  surfacedAction: EntityLookupModel;
  patternClaim: EntityLookupModel;
  contradictionNode: EntityLookupModel;
  patternClaimEvidence: EntityLookupModel;
  contradictionEvidence: EntityLookupModel;
  profileArtifact: EntityLookupModel;
  evidenceSpan: EntityLookupModel;
  referenceItem: EntityLookupModel;
  quickCheckIn: EntityLookupModel;
  journalEntry: EntityLookupModel;
  session: EntityLookupModel;
  message: EntityLookupModel;
  importUploadSession: EntityLookupModel;
  importUploadChunk: EntityLookupModel;
};

export class UnderstandingEvidenceLinkValidationError extends Error {
  readonly field: "targetId" | "sourceId";

  constructor(args: { field: "targetId" | "sourceId"; message: string }) {
    super(args.message);
    this.name = "UnderstandingEvidenceLinkValidationError";
    this.field = args.field;
  }
}

export class UnderstandingEvidenceLinkDuplicateError extends Error {
  constructor() {
    super("Duplicate evidence link");
    this.name = "UnderstandingEvidenceLinkDuplicateError";
  }
}

export async function verifyUnderstandingEvidenceLinkTargetOwnership(args: {
  userId: string;
  targetType: UnderstandingLinkTargetType;
  targetId: string;
  db?: UnderstandingEvidenceLinkWriterDb;
}): Promise<boolean> {
  const db = (args.db ??
    (prismadb as unknown as UnderstandingEvidenceLinkWriterDb)) as UnderstandingEvidenceLinkWriterDb;

  switch (args.targetType) {
    case "usermap_conclusion": {
      const row = await db.userMapConclusion.findFirst({
        where: { id: args.targetId, userId: args.userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "investigation": {
      const row = await db.investigation.findFirst({
        where: { id: args.targetId, userId: args.userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "model_update": {
      const row = await db.modelUpdate.findFirst({
        where: { id: args.targetId, userId: args.userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "fieldwork_assignment": {
      const row = await db.fieldworkAssignment.findFirst({
        where: { id: args.targetId, userId: args.userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "surfaced_action": {
      const row = await db.surfacedAction.findFirst({
        where: { id: args.targetId, userId: args.userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "pattern_claim": {
      const row = await db.patternClaim.findFirst({
        where: { id: args.targetId, userId: args.userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "contradiction_node": {
      const row = await db.contradictionNode.findFirst({
        where: { id: args.targetId, userId: args.userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    default:
      return false;
  }
}

export async function verifyUnderstandingEvidenceLinkSourceOwnership(args: {
  userId: string;
  sourceType: UnderstandingLinkSourceType;
  sourceId: string;
  db?: UnderstandingEvidenceLinkWriterDb;
}): Promise<boolean> {
  const db = (args.db ??
    (prismadb as unknown as UnderstandingEvidenceLinkWriterDb)) as UnderstandingEvidenceLinkWriterDb;

  switch (args.sourceType) {
    case "pattern_claim": {
      const row = await db.patternClaim.findFirst({
        where: { id: args.sourceId, userId: args.userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "pattern_claim_evidence": {
      const row = await db.patternClaimEvidence.findFirst({
        where: { id: args.sourceId, claim: { userId: args.userId } },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "contradiction_node": {
      const row = await db.contradictionNode.findFirst({
        where: { id: args.sourceId, userId: args.userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "contradiction_evidence": {
      const row = await db.contradictionEvidence.findFirst({
        where: { id: args.sourceId, node: { userId: args.userId } },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "profile_artifact": {
      const row = await db.profileArtifact.findFirst({
        where: { id: args.sourceId, userId: args.userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "evidence_span": {
      const row = await db.evidenceSpan.findFirst({
        where: { id: args.sourceId, userId: args.userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "reference_item": {
      const row = await db.referenceItem.findFirst({
        where: { id: args.sourceId, userId: args.userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "surfaced_action": {
      const row = await db.surfacedAction.findFirst({
        where: { id: args.sourceId, userId: args.userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "quick_check_in": {
      const row = await db.quickCheckIn.findFirst({
        where: { id: args.sourceId, userId: args.userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "journal_entry": {
      const row = await db.journalEntry.findFirst({
        where: { id: args.sourceId, userId: args.userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "session": {
      const row = await db.session.findFirst({
        where: { id: args.sourceId, userId: args.userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "message": {
      const row = await db.message.findFirst({
        where: { id: args.sourceId, userId: args.userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "import_record": {
      const sessionRow = await db.importUploadSession.findFirst({
        where: { id: args.sourceId, userId: args.userId },
        select: { id: true },
      });
      if (sessionRow) {
        return true;
      }

      const chunkRow = await db.importUploadChunk.findFirst({
        where: {
          id: args.sourceId,
          session: { userId: args.userId },
        },
        select: { id: true },
      });
      return Boolean(chunkRow);
    }
    case "timeline_aggregation":
    case "user_correction":
      return false;
    default:
      return false;
  }
}

export async function createUnderstandingEvidenceLinkForUser(args: {
  userId: string;
  input: UnderstandingEvidenceLinkWriteInput;
  db?: UnderstandingEvidenceLinkWriterDb;
}) {
  const db = (args.db ??
    (prismadb as unknown as UnderstandingEvidenceLinkWriterDb)) as UnderstandingEvidenceLinkWriterDb;

  const targetOwned = await verifyUnderstandingEvidenceLinkTargetOwnership({
    userId: args.userId,
    targetType: args.input.targetType,
    targetId: args.input.targetId,
    db,
  });
  if (!targetOwned) {
    throw new UnderstandingEvidenceLinkValidationError({
      field: "targetId",
      message: "Target not found for authenticated user",
    });
  }

  const sourceOwned = await verifyUnderstandingEvidenceLinkSourceOwnership({
    userId: args.userId,
    sourceType: args.input.sourceType,
    sourceId: args.input.sourceId,
    db,
  });
  if (!sourceOwned) {
    throw new UnderstandingEvidenceLinkValidationError({
      field: "sourceId",
      message:
        "Source not found for authenticated user or source type is not verifiable in Phase 1B",
    });
  }

  try {
    const createData: Prisma.UnderstandingEvidenceLinkUncheckedCreateInput = {
      userId: args.userId,
      targetType: args.input.targetType,
      targetId: args.input.targetId,
      sourceType: args.input.sourceType,
      sourceId: args.input.sourceId,
      role: args.input.role,
      summary: args.input.summary,
      snippet: args.input.snippet,
      quote: args.input.quote,
      weight: args.input.weight ?? null,
      confidenceContribution: args.input.confidenceContribution ?? null,
      meta: args.input.meta as Prisma.InputJsonValue | undefined,
    };

    return await db.understandingEvidenceLink.create({
      data: createData,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new UnderstandingEvidenceLinkDuplicateError();
    }
    throw error;
  }
}
