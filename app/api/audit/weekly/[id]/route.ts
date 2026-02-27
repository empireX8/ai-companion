import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;

    const audit = await prismadb.weeklyAudit.findUnique({
      where: { id },
    });

    if (!audit || audit.userId !== userId) {
      return new NextResponse("Not found", { status: 404 });
    }

    return NextResponse.json(audit);
  } catch (error) {
    console.log("[WEEKLY_AUDIT_BY_ID_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
