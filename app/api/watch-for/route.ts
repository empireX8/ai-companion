import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import {
  linkedObjectHrefMapKey,
  resolvePublicLinkedObjectHrefs,
} from "../../../lib/public-linked-object-continuity";
import { buildPublicWatchForWhere } from "../../../lib/fieldwork-public-visibility";
import { WATCH_FOR_LIMIT, toWatchForItem } from "../../../lib/watch-for";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await prismadb.fieldworkAssignment.findMany({
      where: buildPublicWatchForWhere({ userId }),
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: WATCH_FOR_LIMIT,
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

    const items = rows
      .map((row) => toWatchForItem(row))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const verifiedLinkedObjectHrefByKey = await resolvePublicLinkedObjectHrefs({
      userId,
      targets: items.map((item) => ({
        linkedObjectType: item.linkedObjectType,
        linkedObjectId: item.linkedObjectId,
      })),
    });

    const verifiedItems = items.map((item) => {
      const mapKey = linkedObjectHrefMapKey({
        linkedObjectType: item.linkedObjectType,
        linkedObjectId: item.linkedObjectId,
      });

      return {
        ...item,
        linkedObjectHref: mapKey
          ? verifiedLinkedObjectHrefByKey.get(mapKey) ?? null
          : null,
      };
    });

    const safeItems = verifiedItems.map((item) => ({
      id: item.id,
      prompt: item.prompt,
      reason: item.reason,
      status: item.status,
      statusLabel: item.statusLabel,
      linkedObjectHref: item.linkedObjectHref,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    return NextResponse.json({ items: safeItems });
  } catch (error) {
    console.error("[WATCH_FOR_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
