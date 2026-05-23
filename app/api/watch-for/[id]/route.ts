import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import { resolvePublicLinkedObjectHref } from "@/lib/public-linked-object-continuity";
import {
  WATCH_FOR_SAFE_VISIBLE_STATUSES,
  toWatchForDetailItem,
} from "../../../../lib/watch-for";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const row = await prismadb.fieldworkAssignment.findFirst({
      where: {
        id,
        userId,
        status: { in: WATCH_FOR_SAFE_VISIBLE_STATUSES },
      },
      select: {
        id: true,
        prompt: true,
        reason: true,
        status: true,
        linkedObjectType: true,
        linkedObjectId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const item = toWatchForDetailItem(row);
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const linkedObjectHref = await resolvePublicLinkedObjectHref({
      userId,
      linkedObjectType: item.linkedObjectType,
      linkedObjectId: item.linkedObjectId,
    });

    return NextResponse.json({
      item: {
        id: item.id,
        prompt: item.prompt,
        reason: item.reason,
        status: item.status,
        statusLabel: item.statusLabel,
        linkedObjectType: item.linkedObjectType,
        linkedObjectId: item.linkedObjectId,
        linkedObjectHref,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
    });
  } catch (error) {
    console.error("[WATCH_FOR_DETAIL_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
