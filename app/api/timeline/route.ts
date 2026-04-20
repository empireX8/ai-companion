import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import { toQuickCheckInView } from "../../../lib/quick-check-ins";
import {
  getWindowStartDate,
  resolveTimelineWindow,
  type ImportedConversationActivityItem,
} from "../../../lib/timeline-aggregation";

export const dynamic = "force-dynamic";

const TIMELINE_MAX_RESULTS = 200;

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const window = resolveTimelineWindow(searchParams.get("window"));

  const windowStart = getWindowStartDate(window, new Date());

  try {
    const [checkIns, importedSessions] = await Promise.all([
      prismadb.quickCheckIn.findMany({
        where: {
          userId,
          createdAt: { gte: windowStart },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: TIMELINE_MAX_RESULTS,
        select: {
          id: true,
          stateTag: true,
          eventTags: true,
          note: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prismadb.session.findMany({
        where: {
          userId,
          origin: "IMPORTED_ARCHIVE",
          startedAt: { gte: windowStart },
        },
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          label: true,
          startedAt: true,
          messages: {
            where: { role: "user" },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { content: true },
          },
          _count: {
            select: { messages: true },
          },
        },
      }),
    ]);

    const importedActivity: ImportedConversationActivityItem[] = importedSessions.map(
      (session) => ({
        id: session.id,
        startedAt: session.startedAt.toISOString(),
        label: session.label,
        preview: session.messages[0]?.content ?? null,
        messageCount: session._count.messages,
      })
    );

    return NextResponse.json({
      checkIns: checkIns.map(toQuickCheckInView),
      importedActivity,
    });
  } catch (error) {
    console.log("[TIMELINE_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
