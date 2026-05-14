import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  ModelUpdateType,
  ModelUpdateVisibility,
  UnderstandingLinkTargetType,
} from "@prisma/client";
import { z } from "zod";

import prismadb from "@/lib/prismadb";
import {
  MAX_LIMIT,
  SortOrder,
  errorResponse,
  listSuccess,
  modelUpdateCreateSchema,
  parseLimit,
  parseSortOrder,
  zodIssuesToDetails,
} from "../../../lib/understanding-engine-api";

export const dynamic = "force-dynamic";

const MODEL_UPDATE_SAFE_SELECT = {
  id: true,
  userId: true,
  updateType: true,
  visibility: true,
  affectedObjectType: true,
  affectedObjectId: true,
  userFacingSummary: true,
  isMeaningful: true,
  beforeSummary: true,
  afterSummary: true,
  confidenceDelta: true,
  meaningfulDeltaScore: true,
  sourceRunId: true,
  createdAt: true,
} as const;

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

  const visibilityParam = searchParams.get("visibility");
  const updateTypeParam = searchParams.get("updateType");
  const affectedObjectTypeParam = searchParams.get("affectedObjectType");
  const affectedObjectId = searchParams.get("affectedObjectId") ?? undefined;

  const visibility = visibilityParam
    ? z.nativeEnum(ModelUpdateVisibility).safeParse(visibilityParam)
    : null;
  const updateType = updateTypeParam
    ? z.nativeEnum(ModelUpdateType).safeParse(updateTypeParam)
    : null;
  const affectedObjectType = affectedObjectTypeParam
    ? z.nativeEnum(UnderstandingLinkTargetType).safeParse(affectedObjectTypeParam)
    : null;

  if (visibility && !visibility.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "visibility", message: "Invalid visibility" },
    ]);
  }
  if (updateType && !updateType.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "updateType", message: "Invalid updateType" },
    ]);
  }
  if (affectedObjectType && !affectedObjectType.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "affectedObjectType", message: "Invalid affectedObjectType" },
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

    const where = {
      userId,
      ...(visibility?.success
        ? { visibility: visibility.data }
        : { visibility: { not: "internal_only" as const } }),
      ...(updateType?.success ? { updateType: updateType.data } : {}),
      ...(affectedObjectType?.success
        ? { affectedObjectType: affectedObjectType.data }
        : {}),
      ...(affectedObjectId ? { affectedObjectId } : {}),
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    };

    const items = await prismadb.modelUpdate.findMany({
      where,
      orderBy: [{ createdAt: sortOrder }, { id: sortOrder }],
      take: limit + 1,
      select: MODEL_UPDATE_SAFE_SELECT,
    });

    const hasMore = items.length > limit;
    const trimmed = hasMore ? items.slice(0, limit) : items;
    const nextCursor =
      hasMore && trimmed.length > 0
        ? trimmed[trimmed.length - 1].createdAt.toISOString()
        : null;

    return listSuccess(trimmed, limit, hasMore, nextCursor);
  } catch (error) {
    console.error("[MODEL_UPDATES_GET_ERROR]", error);
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

  const parsed = modelUpdateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", zodIssuesToDetails(parsed.error.issues));
  }

  try {
    const created = await prismadb.modelUpdate.create({
      data: {
        userId,
        ...parsed.data,
      },
      select: MODEL_UPDATE_SAFE_SELECT,
    });

    return NextResponse.json({ item: created }, { status: 201 });
  } catch (error) {
    console.error("[MODEL_UPDATES_POST_ERROR]", error);
    return errorResponse(500, "Internal Error", "INTERNAL_ERROR");
  }
}
