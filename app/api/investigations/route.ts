import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { InvestigationSeedType, InvestigationStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import prismadb from "@/lib/prismadb";
import {
  MAX_LIMIT,
  SortOrder,
  errorResponse,
  investigationCreateSchema,
  listSuccess,
  parseLimit,
  parseSortOrder,
  zodIssuesToDetails,
} from "../../../lib/understanding-engine-api";

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

function isResolvedAtCompatibleStatus(status: InvestigationStatus): boolean {
  return status === "resolving" || status === "resolved" || status === "reopened";
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
  const seedTypeParam = searchParams.get("seedType");
  const priorityParam = searchParams.get("priority");

  const status = statusParam
    ? z.nativeEnum(InvestigationStatus).safeParse(statusParam)
    : null;
  const seedType = seedTypeParam
    ? z.nativeEnum(InvestigationSeedType).safeParse(seedTypeParam)
    : null;

  if (status && !status.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "status", message: "Invalid status" },
    ]);
  }
  if (seedType && !seedType.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      { field: "seedType", message: "Invalid seedType" },
    ]);
  }

  let priority: number | undefined;
  if (priorityParam !== null) {
    const parsedPriority = Number.parseInt(priorityParam, 10);
    if (!Number.isInteger(parsedPriority)) {
      return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
        { field: "priority", message: "priority must be an integer" },
      ]);
    }
    priority = parsedPriority;
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

    const items = await prismadb.investigation.findMany({
      where: {
        userId,
        ...(status?.success ? { status: status.data } : {}),
        ...(seedType?.success ? { seedType: seedType.data } : {}),
        ...(typeof priority === "number" ? { priority } : {}),
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
    console.error("[INVESTIGATIONS_GET_ERROR]", error);
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

  const parsed = investigationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", zodIssuesToDetails(parsed.error.issues));
  }

  if (
    parsed.data.resolvedAt &&
    !isResolvedAtCompatibleStatus(parsed.data.status)
  ) {
    return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
      {
        field: "resolvedAt",
        message: "resolvedAt requires resolving, resolved, or reopened status",
      },
    ]);
  }

  if (parsed.data.resolvedIntoUserMapConclusionId) {
    const linkedConclusion = await prismadb.userMapConclusion.findFirst({
      where: { id: parsed.data.resolvedIntoUserMapConclusionId, userId },
      select: { id: true },
    });

    if (!linkedConclusion) {
      return errorResponse(400, "Validation failed", "VALIDATION_ERROR", [
        {
          field: "resolvedIntoUserMapConclusionId",
          message: "Must belong to authenticated user",
        },
      ]);
    }
  }

  try {
    const createData: Prisma.InvestigationUncheckedCreateInput = {
      userId,
      title: parsed.data.title,
      organizingQuestion: parsed.data.organizingQuestion,
      status: parsed.data.status,
      seedType: parsed.data.seedType,
      competingTheories: parsed.data.competingTheories as Prisma.InputJsonValue,
      evidenceNeeded: parsed.data.evidenceNeeded as Prisma.InputJsonValue,
      resolutionSummary: parsed.data.resolutionSummary,
      resolvedAt: parsed.data.resolvedAt,
      resolvedIntoUserMapConclusionId: parsed.data.resolvedIntoUserMapConclusionId,
      reopenedAt: parsed.data.reopenedAt,
      reopenReason: parsed.data.reopenReason,
      priority: parsed.data.priority,
    };

    const created = await prismadb.investigation.create({
      data: createData,
    });

    return NextResponse.json({ item: created }, { status: 201 });
  } catch (error) {
    console.error("[INVESTIGATIONS_POST_ERROR]", error);
    return errorResponse(500, "Internal Error", "INTERNAL_ERROR");
  }
}
