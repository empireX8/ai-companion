import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";

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

    const run = await prismadb.derivationRun.findFirst({
      where: { id, userId },
      select: {
        id: true,
        scope: true,
        processorVersion: true,
        inputMessageSetHash: true,
        status: true,
        createdAt: true,
        artifacts: {
          select: {
            id: true,
            type: true,
            status: true,
            payload: true,
            confidenceScore: true,
            temporalStart: true,
            temporalEnd: true,
            createdAt: true,
            evidenceLinks: {
              select: {
                role: true,
                span: {
                  select: {
                    id: true,
                    messageId: true,
                    charStart: true,
                    charEnd: true,
                    contentHash: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!run) {
      return new NextResponse("Not Found", { status: 404 });
    }

    return NextResponse.json(run);
  } catch (error) {
    console.log("[DERIVATION_RUN_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
