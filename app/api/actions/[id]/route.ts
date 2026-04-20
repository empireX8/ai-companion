import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import type { ActionStatus } from "@/lib/actions-api";
import { updateSurfacedActionState } from "@/lib/actions-v1";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set<ActionStatus>([
  "not_started",
  "done",
  "helped",
  "didnt_help",
]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: { status?: unknown; note?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    body.status !== undefined &&
    !VALID_STATUSES.has(body.status as ActionStatus)
  ) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  if (
    body.note !== undefined &&
    body.note !== null &&
    typeof body.note !== "string"
  ) {
    return NextResponse.json({ error: "Invalid note" }, { status: 400 });
  }

  const updated = await updateSurfacedActionState(
    {
      actionId: id,
      userId,
      status: body.status as ActionStatus | undefined,
      note:
        body.note === undefined ? undefined : (body.note as string | null),
    },
    prismadb
  );

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    note: updated.note,
    updatedAt: updated.updatedAt.toISOString(),
  });
}
