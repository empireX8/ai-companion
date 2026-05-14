import { auth } from "@clerk/nextjs/server";
import {
  Prisma,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
} from "@prisma/client";
import { z } from "zod";

import prismadb from "@/lib/prismadb";
import {
  MAX_LIMIT,
  SortOrder,
  errorResponse,
  evidenceLinkCreateSchema,
  listSuccess,
  parseLimit,
  parseSortOrder,
  zodIssuesToDetails,
} from "../../../../lib/understanding-engine-api";

export const dynamic = "force-dynamic";

function parseDateOrError(value: string | null): Date | null | "invalid" {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "invalid";
  }
  return parsed;
}

function buildCreatedAtFilter(args: {
  cursor: Date | null;
  createdBefore: Date | null;
  createdAfter: Date | null;
  sortOrder: SortOrder;
}) {
  const filter: Record<string, Date> = {};

  if (args.cursor) {
    filter[args.sortOrder === "desc" ? "lt" : "gt"] = args.cursor;
  }
  if (args.createdBefore) {
    filter.lt = args.createdBefore;
  }
  if (args.createdAfter) {
    filter.gt = args.createdAfter;
  }

  return Object.keys(filter).length ? filter : undefined;
}

async function verifyTargetOwnership(args: {
  userId: string;
  targetType: UnderstandingLinkTargetType;
  targetId: string;
}) {
  const { userId, targetType, targetId } = args;

  switch (targetType) {
    case "usermap_conclusion": {
      const row = await prismadb.userMapConclusion.findFirst({
        where: { id: targetId, userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "investigation": {
      const row = await prismadb.investigation.findFirst({
        where: { id: targetId, userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "model_update": {
      const row = await prismadb.modelUpdate.findFirst({
        where: { id: targetId, userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "fieldwork_assignment": {
      const row = await prismadb.fieldworkAssignment.findFirst({
        where: { id: targetId, userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "surfaced_action": {
      const row = await prismadb.surfacedAction.findFirst({
        where: { id: targetId, userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "pattern_claim": {
      const row = await prismadb.patternClaim.findFirst({
        where: { id: targetId, userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "contradiction_node": {
      const row = await prismadb.contradictionNode.findFirst({
        where: { id: targetId, userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    default:
      return false;
  }
}

async function verifySourceOwnership(args: {
  userId: string;
  sourceType: UnderstandingLinkSourceType;
  sourceId: string;
}) {
  const { userId, sourceType, sourceId } = args;

  switch (sourceType) {
    case "pattern_claim": {
      const row = await prismadb.patternClaim.findFirst({
        where: { id: sourceId, userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "pattern_claim_evidence": {
      const row = await prismadb.patternClaimEvidence.findFirst({
        where: { id: sourceId, claim: { userId } },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "contradiction_node": {
      const row = await prismadb.contradictionNode.findFirst({
        where: { id: sourceId, userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "contradiction_evidence": {
      const row = await prismadb.contradictionEvidence.findFirst({
        where: { id: sourceId, node: { userId } },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "profile_artifact": {
      const row = await prismadb.profileArtifact.findFirst({
        where: { id: sourceId, userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "evidence_span": {
      const row = await prismadb.evidenceSpan.findFirst({
        where: { id: sourceId, userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "reference_item": {
      const row = await prismadb.referenceItem.findFirst({
        where: { id: sourceId, userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "surfaced_action": {
      const row = await prismadb.surfacedAction.findFirst({
        where: { id: sourceId, userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "quick_check_in": {
      const row = await prismadb.quickCheckIn.findFirst({
        where: { id: sourceId, userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "journal_entry": {
      const row = await prismadb.journalEntry.findFirst({
        where: { id: sourceId, userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "session": {
      const row = await prismadb.session.findFirst({
        where: { id: sourceId, userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "message": {
      const row = await prismadb.message.findFirst({
        where: { id: sourceId, userId },
        select: { id: true },
      });
      return Boolean(row);
    }
    case "import_record": {
      const sessionRow = await prismadb.importUploadSession.findFirst({
        where: { id: sourceId, userId },
        select: { id: true },
      });
      if (sessionRow) {
        return true;
      }

      const chunkRow = await prismadb.importUploadChunk.findFirst({
        where: {
          id: sourceId,
          session: { userId },
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

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return errorResponse(401, "Unauthorized", "UNAUTHORIZED");
  }

  const { searchParams } = new URL(req.url);

  const limit = parseLimit(searchParams.get("limit"));
  if (limit === null) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "limit", message: `limit must be between 1 and ${MAX_LIMIT}` },
    ]);
  }

  const sortOrder = parseSortOrder(searchParams.get("sortOrder"));
  if (sortOrder === null) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "sortOrder", message: "sortOrder must be asc or desc" },
    ]);
  }

  const sortBy = searchParams.get("sortBy");
  if (sortBy && sortBy !== "createdAt") {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "sortBy", message: "sortBy must be createdAt" },
    ]);
  }

  const targetTypeParam = searchParams.get("targetType");
  const targetId = searchParams.get("targetId") ?? undefined;
  const sourceTypeParam = searchParams.get("sourceType");
  const sourceId = searchParams.get("sourceId") ?? undefined;
  const roleParam = searchParams.get("role");

  const targetType = targetTypeParam
    ? z.nativeEnum(UnderstandingLinkTargetType).safeParse(targetTypeParam)
    : null;
  const sourceType = sourceTypeParam
    ? z.nativeEnum(UnderstandingLinkSourceType).safeParse(sourceTypeParam)
    : null;
  const role = roleParam ? z.nativeEnum(UnderstandingLinkRole).safeParse(roleParam) : null;

  if (targetType && !targetType.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "targetType", message: "Invalid targetType" },
    ]);
  }
  if (sourceType && !sourceType.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "sourceType", message: "Invalid sourceType" },
    ]);
  }
  if (role && !role.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "role", message: "Invalid role" },
    ]);
  }

  if (targetId && !targetTypeParam) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "targetType", message: "targetType is required when targetId is provided" },
    ]);
  }
  if (sourceId && !sourceTypeParam) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "sourceType", message: "sourceType is required when sourceId is provided" },
    ]);
  }
  if (targetTypeParam && !targetId) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "targetId", message: "targetId is required when targetType is provided" },
    ]);
  }
  if (sourceTypeParam && !sourceId) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "sourceId", message: "sourceId is required when sourceType is provided" },
    ]);
  }
  const hasTargetAnchor = Boolean(targetTypeParam && targetId);
  const hasSourceAnchor = Boolean(sourceTypeParam && sourceId);

  if (!hasTargetAnchor && !hasSourceAnchor) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      {
        field: "targetType+targetId|sourceType+sourceId",
        message: "Provide targetType+targetId or sourceType+sourceId",
      },
    ]);
  }

  const cursor = parseDateOrError(searchParams.get("cursor"));
  const createdBefore = parseDateOrError(searchParams.get("createdBefore"));
  const createdAfter = parseDateOrError(searchParams.get("createdAfter"));

  if (cursor === "invalid") {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "cursor", message: "Invalid cursor" },
    ]);
  }
  if (createdBefore === "invalid") {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "createdBefore", message: "Invalid createdBefore" },
    ]);
  }
  if (createdAfter === "invalid") {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "createdAfter", message: "Invalid createdAfter" },
    ]);
  }

  try {
    const createdAtFilter = buildCreatedAtFilter({
      cursor,
      createdBefore,
      createdAfter,
      sortOrder,
    });

    const items = await prismadb.understandingEvidenceLink.findMany({
      where: {
        userId,
        ...(targetType?.success ? { targetType: targetType.data } : {}),
        ...(targetId ? { targetId } : {}),
        ...(sourceType?.success ? { sourceType: sourceType.data } : {}),
        ...(sourceId ? { sourceId } : {}),
        ...(role?.success ? { role: role.data } : {}),
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      },
      orderBy: [{ createdAt: sortOrder }, { id: sortOrder }],
      take: limit + 1,
    });

    const hasMore = items.length > limit;
    const trimmed = hasMore ? items.slice(0, limit) : items;
    const nextCursor =
      hasMore && trimmed.length > 0
        ? trimmed[trimmed.length - 1].createdAt.toISOString()
        : null;

    return listSuccess(trimmed, limit, hasMore, nextCursor);
  } catch (error) {
    console.error("[UNDERSTANDING_EVIDENCE_LINKS_GET_ERROR]", error);
    return errorResponse(500, "Internal Error", "INTERNAL_ERROR");
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return errorResponse(401, "Unauthorized", "UNAUTHORIZED");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "body", message: "Invalid JSON" },
    ]);
  }

  const parsed = evidenceLinkCreateSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", zodIssuesToDetails(parsed.error.issues));
  }

  const targetOwned = await verifyTargetOwnership({
    userId,
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId,
  });
  if (!targetOwned) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      {
        field: "targetId",
        message: "Target not found for authenticated user",
      },
    ]);
  }

  const sourceOwned = await verifySourceOwnership({
    userId,
    sourceType: parsed.data.sourceType,
    sourceId: parsed.data.sourceId,
  });

  if (!sourceOwned) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      {
        field: "sourceId",
        message:
          "Source not found for authenticated user or source type is not verifiable in Phase 1B",
      },
    ]);
  }

  try {
    const createData: Prisma.UnderstandingEvidenceLinkUncheckedCreateInput = {
      userId,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      sourceType: parsed.data.sourceType,
      sourceId: parsed.data.sourceId,
      role: parsed.data.role,
      summary: parsed.data.summary,
      snippet: parsed.data.snippet,
      quote: parsed.data.quote,
      weight: parsed.data.weight ?? null,
      confidenceContribution: parsed.data.confidenceContribution ?? null,
      meta: parsed.data.meta as Prisma.InputJsonValue | undefined,
    };

    const created = await prismadb.understandingEvidenceLink.create({
      data: createData,
    });

    return Response.json({ item: created }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return errorResponse(409, "Duplicate evidence link", "DUPLICATE_LINK");
    }

    console.error("[UNDERSTANDING_EVIDENCE_LINKS_POST_ERROR]", error);
    return errorResponse(500, "Internal Error", "INTERNAL_ERROR");
  }
}
