import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope") ?? undefined;

    const runs = await prismadb.derivationRun.findMany({
      where: { userId, ...(scope ? { scope } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        scope: true,
        processorVersion: true,
        inputMessageSetHash: true,
        status: true,
        createdAt: true,
        _count: { select: { artifacts: true } },
      },
    });

    return NextResponse.json(runs);
  } catch (error) {
    console.log("[DERIVATION_RUNS_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
