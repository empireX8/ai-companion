import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { FieldworkStatus, UnderstandingLinkTargetType } from "@prisma/client";
import { z } from "zod";

import prismadb from "@/lib/prismadb";
import {
  MAX_LIMIT,
  SortOrder,
  errorResponse,
  fieldworkCreateSchema,
  hasFieldworkObservationPayload,
  listSuccess,
  parseLimit,
  parseSortOrder,
  zodIssuesToDetails,
} from "../../../lib/understanding-engine-api";
import { verifyUnderstandingEvidenceLinkTargetOwnership } from "../../../lib/understanding-evidence-link-writer";

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

  const statusParam = searchParams.get("status");
  const linkedObjectTypeParam = searchParams.get("linkedObjectType");
  const linkedObjectId = searchParams.get("linkedObjectId") ?? undefined;
  const activeOnly = searchParams.get("activeOnly");

  const status = statusParam
    ? z.nativeEnum(FieldworkStatus).safeParse(statusParam)
    : null;
  const linkedObjectType = linkedObjectTypeParam
    ? z.nativeEnum(UnderstandingLinkTargetType).safeParse(linkedObjectTypeParam)
    : null;

  if (status && !status.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "status", message: "Invalid status" },
    ]);
  }
  if (linkedObjectType && !linkedObjectType.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "linkedObjectType", message: "Invalid linkedObjectType" },
    ]);
  }

  if (activeOnly && activeOnly !== "0" && activeOnly !== "1") {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "activeOnly", message: "activeOnly must be 0 or 1" },
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

    const items = await prismadb.fieldworkAssignment.findMany({
      where: {
        userId,
        ...(status?.success ? { status: status.data } : {}),
        ...(linkedObjectType?.success
          ? { linkedObjectType: linkedObjectType.data }
          : {}),
        ...(linkedObjectId ? { linkedObjectId } : {}),
        ...(activeOnly === "1"
          ? { status: { in: ["assigned", "active"] as const } }
          : {}),
        ...(updatedAtFilter ? { updatedAt: updatedAtFilter } : {}),
      },
      orderBy: [{ updatedAt: sortOrder }, { id: sortOrder }],
      take: limit + 1,
    });

    const hasMore = items.length > limit;
    const trimmed = hasMore ? items.slice(0, limit) : items;
    const nextCursor =
      hasMore && trimmed.length > 0
        ? trimmed[trimmed.length - 1].updatedAt.toISOString()
        : null;

    return listSuccess(trimmed, limit, hasMore, nextCursor);
  } catch (error) {
    console.error("[FIELDWORK_GET_ERROR]", error);
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

  const parsed = fieldworkCreateSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", zodIssuesToDetails(parsed.error.issues));
  }

  if (parsed.data.expiresAt && parsed.data.expiresAt <= new Date()) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      {
        field: "expiresAt",
        message: "expiresAt must be in the future",
      },
    ]);
  }

  if (
    parsed.data.status === "completed" &&
    !hasFieldworkObservationPayload({
      observationNote: parsed.data.observationNote,
      observationOutcome: parsed.data.observationOutcome,
    })
  ) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      {
        field: "status",
        message:
          "completed status requires observationNote or observationOutcome",
      },
    ]);
  }

  try {
    const linkedObjectOwned = await verifyUnderstandingEvidenceLinkTargetOwnership({
      userId,
      targetType: parsed.data.linkedObjectType,
      targetId: parsed.data.linkedObjectId,
    });
    if (!linkedObjectOwned) {
      return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
        {
          field: "linkedObjectId",
          message: "Linked object not found for authenticated user",
        },
      ]);
    }

    const created = await prismadb.fieldworkAssignment.create({
      data: {
        userId,
        ...parsed.data,
      },
    });

    return NextResponse.json({ item: created }, { status: 201 });
  } catch (error) {
    console.error("[FIELDWORK_POST_ERROR]", error);
    return errorResponse(500, "Internal Error", "INTERNAL_ERROR");
  }
}
