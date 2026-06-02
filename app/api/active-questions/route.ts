import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import {
  ACTIVE_QUESTIONS_LIMIT,
  buildPublicActiveInvestigationWhere,
  toActiveQuestionItem,
} from "../../../lib/active-questions";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await prismadb.investigation.findMany({
      where: buildPublicActiveInvestigationWhere({ userId }),
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: ACTIVE_QUESTIONS_LIMIT,
      select: {
        id: true,
        title: true,
        organizingQuestion: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const items = rows
      .map((row) => toActiveQuestionItem(row))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[ACTIVE_QUESTIONS_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
