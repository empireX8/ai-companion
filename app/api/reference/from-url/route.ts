import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const body = await req.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const sourceSessionId =
      typeof body?.sourceSessionId === "string" ? body.sourceSessionId.trim() : "";
    const sourceMessageId =
      typeof body?.sourceMessageId === "string" ? body.sourceMessageId.trim() : "";

    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      return new NextResponse("Valid http(s) URL required", { status: 400 });
    }

    if (sourceSessionId && !UUID_PATTERN.test(sourceSessionId)) {
      return new NextResponse("Invalid source session id", { status: 400 });
    }

    if (sourceMessageId && !UUID_PATTERN.test(sourceMessageId)) {
      return new NextResponse("Invalid source message id", { status: 400 });
    }

    const statement = title || url;

    const item = await prismadb.referenceItem.create({
      data: {
        userId,
        type: "pattern",
        confidence: "medium",
        status: "active",
        statement,
        sourceSessionId: sourceSessionId || null,
        sourceMessageId: sourceMessageId || null,
      },
      select: { id: true, statement: true, type: true, status: true },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.log("[REFERENCE_FROM_URL_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
