import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import { resolvePublicLinkedObjectHref } from "@/lib/public-linked-object-continuity";
import {
  buildPublicActiveInvestigationWhere,
  toActiveQuestionDetailItem,
} from "../../../../lib/active-questions";

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
    const row = await prismadb.investigation.findFirst({
      where: buildPublicActiveInvestigationWhere({ userId, id }),
      select: {
        id: true,
        title: true,
        organizingQuestion: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        resolvedIntoUserMapConclusionId: true,
      },
    });

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const item = toActiveQuestionDetailItem(row);
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const resolvedIntoUserMapConclusionHref =
      item.resolvedIntoUserMapConclusionId === null
        ? null
        : await resolvePublicLinkedObjectHref({
            userId,
            linkedObjectType: "usermap_conclusion",
            linkedObjectId: item.resolvedIntoUserMapConclusionId,
          });

    return NextResponse.json({
      item: {
        id: item.id,
        title: item.title,
        organizingQuestion: item.organizingQuestion,
        status: item.status,
        statusLabel: item.statusLabel,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        resolvedIntoUserMapConclusionId: item.resolvedIntoUserMapConclusionId,
        resolvedIntoUserMapConclusionHref,
      },
    });
  } catch (error) {
    console.error("[ACTIVE_QUESTION_DETAIL_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
