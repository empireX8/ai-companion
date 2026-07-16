import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  listAvailableEvidenceSpansForUser,
  loadProductionInvestigationDetail,
} from "@/lib/investigation-production-detail";

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
    const [item, availableEvidence] = await Promise.all([
      loadProductionInvestigationDetail({ userId, id }),
      listAvailableEvidenceSpansForUser({ userId, investigationId: id }),
    ]);
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ item: { ...item, availableEvidence } });
  } catch (error) {
    console.error("[INSPECTOR_INVESTIGATION_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
