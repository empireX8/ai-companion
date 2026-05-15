import { auth } from "@clerk/nextjs/server";
import {
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
import {
  UnderstandingEvidenceLinkDuplicateError,
  UnderstandingEvidenceLinkValidationError,
  createUnderstandingEvidenceLinkForUser,
} from "../../../../lib/understanding-evidence-link-writer";

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

  try {
    const created = await createUnderstandingEvidenceLinkForUser({
      userId,
      input: parsed.data,
    });

    return Response.json({ item: created }, { status: 201 });
  } catch (error) {
    if (error instanceof UnderstandingEvidenceLinkValidationError) {
      return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
        {
          field: error.field,
          message: error.message,
        },
      ]);
    }
    if (error instanceof UnderstandingEvidenceLinkDuplicateError) {
      return errorResponse(409, "Duplicate evidence link", "DUPLICATE_LINK");
    }

    console.error("[UNDERSTANDING_EVIDENCE_LINKS_POST_ERROR]", error);
    return errorResponse(500, "Internal Error", "INTERNAL_ERROR");
  }
}
