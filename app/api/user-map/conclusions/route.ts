import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  UserMapConclusionArea,
  UserMapConclusionStatus,
  UserMapConclusionVisibility,
  UserMapConfidenceLevel,
} from "@prisma/client";
import { z } from "zod";

import prismadb from "@/lib/prismadb";
import {
  toUserMapConclusionPublicApiDetailItem,
  toUserMapConclusionPublicApiListItem,
} from "../../../../lib/public-intelligence-safe-slice";
import {
  MAX_LIMIT,
  SortOrder,
  errorResponse,
  listSuccess,
  parseLimit,
  parseSortOrder,
  userMapConclusionCreateSchema,
  zodIssuesToDetails,
} from "../../../../lib/understanding-engine-api";

const USER_MAP_CONCLUSION_PUBLIC_LIST_SELECT = {
  id: true,
  title: true,
  summary: true,
  area: true,
  status: true,
  confidenceLevel: true,
  evidenceCount: true,
  updatedAt: true,
} as const;

const USER_MAP_CONCLUSION_PUBLIC_DETAIL_SELECT = {
  id: true,
  title: true,
  summary: true,
  area: true,
  status: true,
  confidenceLevel: true,
  evidenceCount: true,
  sourceDiversity: true,
  timeSpreadDays: true,
  createdAt: true,
  updatedAt: true,
} as const;

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

function buildUpdatedAtFilter(args: {
  cursor: Date | null;
  updatedBefore: Date | null;
  updatedAfter: Date | null;
  sortOrder: SortOrder;
}) {
  const filter: Record<string, Date> = {};

  if (args.cursor) {
    filter[args.sortOrder === "desc" ? "lt" : "gt"] = args.cursor;
  }
  if (args.updatedBefore) {
    filter.lt = args.updatedBefore;
  }
  if (args.updatedAfter) {
    filter.gt = args.updatedAfter;
  }

  return Object.keys(filter).length ? filter : undefined;
}

function hasOwnProperty(
  value: unknown,
  key: string
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.prototype.hasOwnProperty.call(value, key)
  );
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
  if (sortBy && sortBy !== "updatedAt") {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "sortBy", message: "sortBy must be updatedAt" },
    ]);
  }

  const areaParam = searchParams.get("area");
  const statusParam = searchParams.get("status");
  const confidenceLevelParam = searchParams.get("confidenceLevel");

  const area = areaParam
    ? z.nativeEnum(UserMapConclusionArea).safeParse(areaParam)
    : null;
  const status = statusParam
    ? z.nativeEnum(UserMapConclusionStatus).safeParse(statusParam)
    : null;
  const confidenceLevel = confidenceLevelParam
    ? z.nativeEnum(UserMapConfidenceLevel).safeParse(confidenceLevelParam)
    : null;

  if (area && !area.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "area", message: "Invalid area" },
    ]);
  }
  if (status && !status.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "status", message: "Invalid status" },
    ]);
  }
  if (confidenceLevel && !confidenceLevel.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "confidenceLevel", message: "Invalid confidenceLevel" },
    ]);
  }

  const cursor = parseDateOrError(searchParams.get("cursor"));
  const updatedBefore = parseDateOrError(searchParams.get("updatedBefore"));
  const updatedAfter = parseDateOrError(searchParams.get("updatedAfter"));

  if (cursor === "invalid") {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "cursor", message: "Invalid cursor" },
    ]);
  }
  if (updatedBefore === "invalid") {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "updatedBefore", message: "Invalid updatedBefore" },
    ]);
  }
  if (updatedAfter === "invalid") {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "updatedAfter", message: "Invalid updatedAfter" },
    ]);
  }

  try {
    const updatedAtFilter = buildUpdatedAtFilter({
      cursor,
      updatedBefore,
      updatedAfter,
      sortOrder,
    });

    const rows = await prismadb.userMapConclusion.findMany({
      where: {
        userId,
        visibility: UserMapConclusionVisibility.user_visible,
        ...(area?.success ? { area: area.data } : {}),
        ...(status?.success ? { status: status.data } : {}),
        ...(confidenceLevel?.success
          ? { confidenceLevel: confidenceLevel.data }
          : {}),
        ...(updatedAtFilter ? { updatedAt: updatedAtFilter } : {}),
      },
      select: USER_MAP_CONCLUSION_PUBLIC_LIST_SELECT,
      orderBy: [{ updatedAt: sortOrder }, { id: sortOrder }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const trimmed = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor =
      hasMore && trimmed.length > 0
        ? trimmed[trimmed.length - 1].updatedAt.toISOString()
        : null;
    const items = trimmed
      .map((row) => toUserMapConclusionPublicApiListItem(row))
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return listSuccess(items, limit, hasMore, nextCursor);
  } catch (error) {
    console.error("[USER_MAP_CONCLUSIONS_GET_ERROR]", error);
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

  const parsed = userMapConclusionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", zodIssuesToDetails(parsed.error.issues));
  }
  if (hasOwnProperty(body, "visibility")) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      {
        field: "visibility",
        message: "visibility is not allowed on this route",
      },
    ]);
  }

  if (parsed.data.supersededById) {
    const supersededBy = await prismadb.userMapConclusion.findFirst({
      where: { id: parsed.data.supersededById, userId },
      select: { id: true },
    });
    if (!supersededBy) {
      return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
        { field: "supersededById", message: "Must belong to authenticated user" },
      ]);
    }
  }

  if (parsed.data.supersedesId) {
    const supersedes = await prismadb.userMapConclusion.findFirst({
      where: { id: parsed.data.supersedesId, userId },
      select: { id: true },
    });
    if (!supersedes) {
      return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
        { field: "supersedesId", message: "Must belong to authenticated user" },
      ]);
    }
  }

  try {
    const created = await prismadb.userMapConclusion.create({
      data: {
        userId,
        visibility: UserMapConclusionVisibility.user_visible,
        ...parsed.data,
      },
      select: USER_MAP_CONCLUSION_PUBLIC_DETAIL_SELECT,
    });

    const item = toUserMapConclusionPublicApiDetailItem(created);
    if (!item) {
      return errorResponse(500, "Internal Error", "INTERNAL_ERROR");
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("[USER_MAP_CONCLUSIONS_POST_ERROR]", error);
    return errorResponse(500, "Internal Error", "INTERNAL_ERROR");
  }
}
