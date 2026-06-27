import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { buildWhatChangedInspectorDetail } from "@/lib/what-changed-reality-report";

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
    const detail = await buildWhatChangedInspectorDetail({
      userId,
      modelUpdateId: id,
    });

    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error("[WHAT_CHANGED_DETAIL_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
